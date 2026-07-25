import { internalAction, internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	queryUserByClerkId,
	queryUserByEmail,
	queryUserByPolarCustomerId,
	queryUserByToken,
} from "./userQueries";

// [Phase 3] Convergent Clerk upsert + Polar internal mutations.
//
// upsertFromClerk resolves by clerkId first, then by reconstructed tokenIdentifier,
// so the Clerk webhook and the authenticated getOrCreateUser entry points converge on
// one Convex user. Only the branch that actually inserts schedules the shared idempotent
// Polar customer synchronization. A Polar failure must never roll back signup (spec 3.1).

// Host for the Clerk Backend API. Kept separate from the path so the request
// URL is assembled at call time.
const CLERK_API_HOST = "api.clerk.com";

function reconstructTokenIdentifier(clerkId: string): string {
	const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
	return issuer ? `${issuer}|${clerkId}` : `clerk|${clerkId}`;
}

type ClerkProfile = {
	clerkId: string;
	email: string;
	name: string;
	avatarUrl: string | undefined;
};

// ponytail: `data` is typed by the `v.any()` validator (Convex emits `any`).
// Ceiling: keep until a typed Clerk webhook envelope replaces `v.any()`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractClerkProfile(data: any): ClerkProfile {
	return {
		clerkId: data.id,
		email: data.email_addresses?.[0]?.email_address ?? "",
		name: `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
		avatarUrl: data.image_url,
	};
}

// Resolve by clerkId (canonical), then converge on the reconstructed tokenIdentifier and email
// so the webhook and the authed getOrCreateUser path never create duplicates.
async function resolveExistingUser(
	ctx: MutationCtx,
	profile: ClerkProfile,
): Promise<Doc<"users"> | null> {
	const byClerkId = await queryUserByClerkId(ctx.db, profile.clerkId);
	if (byClerkId) return byClerkId;
	const byToken = await queryUserByToken(ctx.db, reconstructTokenIdentifier(profile.clerkId));
	if (byToken) return byToken;
	if (profile.email) {
		const byEmail = await queryUserByEmail(ctx.db, profile.email);
		if (byEmail && byEmail.clerkId && byEmail.clerkId !== profile.clerkId) {
			console.warn(
				`resolveExistingUser: email ${profile.email} matches user ${byEmail._id} with different clerkId (${byEmail.clerkId} vs ${profile.clerkId}); converging anyway (Clerk enforces unique emails).`,
			);
		}
		return byEmail;
	}
	return null;
}

// Apply only changed profile fields, then schedule the shared Polar profile sync
// after the local write (spec 3.2). If no Polar customer yet, repair via ensure-customer.
async function updateExistingUser(
	ctx: MutationCtx,
	existing: Doc<"users">,
	profile: ClerkProfile,
) {
	const updates: Record<string, string | undefined> = {};
	if (profile.name !== existing.name) updates.name = profile.name;
	if (profile.email !== existing.email) updates.email = profile.email;
	if (profile.avatarUrl !== existing.avatarUrl) updates.avatarUrl = profile.avatarUrl;
	if (existing.clerkId !== profile.clerkId) updates.clerkId = profile.clerkId;
	const tokenIdentifier = reconstructTokenIdentifier(profile.clerkId);
	if (existing.tokenIdentifier !== tokenIdentifier) {
		updates.tokenIdentifier = tokenIdentifier;
	}

	const profileChanged = profile.email !== existing.email || profile.name !== existing.name;
	if (Object.keys(updates).length > 0) {
		await ctx.db.patch(existing._id, updates);
	}
	if (profileChanged && profile.email) {
		const target = existing.polarCustomerId
			? internal.billing.sync.syncPolarCustomerProfile
			: internal.billing.sync.ensurePolarCustomer;
		await ctx.scheduler.runAfter(0, target, {
			clerkId: profile.clerkId,
			email: profile.email,
			name: profile.name || undefined,
		});
	}
}

// Only the insert branch schedules Polar customer sync and the welcome email
// (spec 3.1, 4.1). A Polar failure never rolls back signup (sync action logs + skips).
async function insertNewUser(ctx: MutationCtx, profile: ClerkProfile) {
	const tokenIdentifier = reconstructTokenIdentifier(profile.clerkId);
	await ctx.db.insert("users", {
		name: profile.name,
		email: profile.email,
		avatarUrl: profile.avatarUrl,
		clerkId: profile.clerkId,
		tokenIdentifier,
		plan: "hobby",
	});

	if (profile.email) {
		await ctx.scheduler.runAfter(0, internal.billing.sync.ensurePolarCustomer, {
			clerkId: profile.clerkId,
			email: profile.email,
			name: profile.name || undefined,
		});
		await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
			email: profile.email,
			name: profile.name || undefined,
		});
	} else {
		console.warn("Skipping welcome email and Polar sync: user has no email address.");
	}
}

// ---------------------------------------------------------------------------
// Polar subscription application
//
// applySubscription is the ONLY place a verified Polar subscription is written
// to a user document. Both the live webhook path and the pending-event
// reconciliation path go through it, so the ordering guard cannot be bypassed.
// The steps below are split out so each is independently testable and the
// orchestrator stays readable.
// ---------------------------------------------------------------------------

type SubscriptionUpdate = {
	clerkId?: string;
	polarCustomerId?: string;
	polarSubscriptionId?: string;
	polarSubscriptionStatus?: string;
	plan: "hobby" | "pro";
	eventTimestamp?: number;
};

// clerkId is canonical; polarCustomerId is the fallback for events that arrive
// before the clerkId is known. Never creates a user (spec 3.6 / 4.5).
async function resolveSubscriptionUser(
	ctx: MutationCtx,
	args: SubscriptionUpdate,
): Promise<Doc<"users"> | null> {
	if (args.clerkId) {
		const byClerkId = await queryUserByClerkId(ctx.db, args.clerkId);
		if (byClerkId) return byClerkId;
	}
	if (args.polarCustomerId) {
		return await queryUserByPolarCustomerId(ctx.db, args.polarCustomerId);
	}
	return null;
}

// Ordering + replay guard (Bug #2). Polar delivers at-least-once and does not
// guarantee ordering, so without this a redelivered or delayed
// `subscription.canceled` could land after `subscription.active` and downgrade a
// paying customer. `<=` also makes exact replays a no-op.
// Users with no polarLastEventAt have never had an event applied, so the first
// event after deploy is always accepted.
function isStaleSubscriptionEvent(
	user: Doc<"users">,
	incomingAt: number | undefined,
): boolean {
	if (incomingAt === undefined) return false;
	if (user.polarLastEventAt === undefined) return false;
	return incomingAt <= user.polarLastEventAt;
}

// Fields absent from the event fall back to the user's current values so a
// partial event never blanks out known state.
function buildSubscriptionPatch(
	user: Doc<"users">,
	args: SubscriptionUpdate,
	incomingAt: number | undefined,
) {
	return {
		polarCustomerId: args.polarCustomerId ?? user.polarCustomerId,
		polarSubscriptionId: args.polarSubscriptionId,
		polarSubscriptionStatus: args.polarSubscriptionStatus,
		plan: args.plan,
		polarLastEventAt: incomingAt ?? user.polarLastEventAt,
	};
}

// Only on a genuine hobby -> pro transition, so a replayed granting event for an
// already-Pro user does not resend the email.
async function maybeSendProUpgradeEmail(
	ctx: MutationCtx,
	user: Doc<"users">,
	wasHobby: boolean,
	plan: "hobby" | "pro",
) {
	if (!wasHobby || plan !== "pro") return;
	if (!user.email) {
		console.warn("Skipping Pro upgrade email: user has no email address.");
		return;
	}
	await ctx.scheduler.runAfter(0, internal.emails.sendProUpgradeEmail, {
		email: user.email,
		name: user.name || undefined,
	});
}

// Resolve -> reject stale -> patch -> notify.
// Returns false when no user matches, so the caller can decide whether to park
// the event (webhook) or drop it.
async function applySubscription(
	ctx: MutationCtx,
	args: SubscriptionUpdate,
): Promise<boolean> {
	const user = await resolveSubscriptionUser(ctx, args);
	if (!user) return false;

	const incomingAt = args.eventTimestamp;
	if (isStaleSubscriptionEvent(user, incomingAt)) {
		console.log("applySubscription: ignoring stale or replayed Polar event", {
			subscriptionId: args.polarSubscriptionId,
			status: args.polarSubscriptionStatus,
			incomingAt,
			lastAppliedAt: user.polarLastEventAt,
		});
		return true;
	}

	const wasHobby = user.plan === "hobby";
	await ctx.db.patch(user._id, buildSubscriptionPatch(user, args, incomingAt));
	await maybeSendProUpgradeEmail(ctx, user, wasHobby, args.plan);

	return true;
}

// A single parked row can match both indexes; dedupe before applying.
function dedupePending<T extends { _id: unknown }>(rows: T[]): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];
	for (const row of rows) {
		const key = String(row._id);
		if (seen.has(key)) continue;
		seen.add(key);
		unique.push(row);
	}
	return unique;
}

// Drain subscription events that were parked before the user existed (Bug #1).
// Called after the Clerk upsert and after a Polar customer ID is saved — the two
// moments at which a previously unresolvable event becomes resolvable.
// Events are applied oldest-first so the final state reflects the newest event,
// and each is deleted once applied.
async function reconcilePendingSubscriptions(
	ctx: MutationCtx,
	match: { clerkId?: string; polarCustomerId?: string },
) {
	const { clerkId, polarCustomerId } = match;

	const byClerkId = clerkId
		? await ctx.db
				.query("pendingSubscriptions")
				.withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
				.collect()
		: [];
	const byCustomerId = polarCustomerId
		? await ctx.db
				.query("pendingSubscriptions")
				.withIndex("by_polarCustomerId", (q) => q.eq("polarCustomerId", polarCustomerId))
				.collect()
		: [];

	const pending = dedupePending([...byClerkId, ...byCustomerId]);
	pending.sort((a, b) => a.eventTimestamp - b.eventTimestamp);

	for (const row of pending) {
		await applySubscription(ctx, {
			clerkId: row.clerkId,
			polarCustomerId: row.polarCustomerId,
			polarSubscriptionId: row.polarSubscriptionId,
			polarSubscriptionStatus: row.polarSubscriptionStatus,
			plan: row.plan,
			eventTimestamp: row.eventTimestamp,
		});
		await ctx.db.delete(row._id);
	}
}

export const upsertFromClerk = internalMutation({
	args: { data: v.any() }, // Using v.any() to accept the Clerk webhook event.data payload
	async handler(ctx, { data }) {
		const profile = extractClerkProfile(data);
		const existing = await resolveExistingUser(ctx, profile);
		if (existing) {
			await updateExistingUser(ctx, existing, profile);
		} else {
			await insertNewUser(ctx, profile);
		}

		// The Polar webhook can beat this one. Apply anything that was parked
		// while this user did not exist yet.
		await reconcilePendingSubscriptions(ctx, { clerkId: profile.clerkId });
	},
});

export const deleteFromClerk = internalMutation({
	args: { clerkUserId: v.string() },
	async handler(ctx, { clerkUserId }) {
		const existing = await queryUserByClerkId(ctx.db, clerkUserId);
		if (existing) {
			// Cascade-delete all prompts belonging to this user before deleting
			// the user document. Otherwise orphaned public prompts remain visible
			// in the marketplace with author: 'Anonymous' (Bug #4).
			const prompts = await ctx.db
				.query('prompts')
				.withIndex('by_userId', (q) => q.eq('userId', existing._id))
				.collect();
			for (const prompt of prompts) {
				await ctx.db.delete(prompt._id);
			}

			// Per spec 3.7: delete only the Convex user. Never touch Polar billing records.
			await ctx.db.delete(existing._id);
		}
	},
});

// [Phase 3] Save the real Polar customer ID on the matching Convex user.
// Resolves by clerkId first, then by stored polarCustomerId as a safe fallback.
// Never saves an ID to a different user and never inserts a user from this path.
export const savePolarCustomerId = internalMutation({
	args: { clerkId: v.string(), polarCustomerId: v.string() },
	async handler(ctx, { clerkId, polarCustomerId }) {
		let user = await queryUserByClerkId(ctx.db, clerkId);
		if (!user) {
			// Fallback correlation (webhook may arrive before the clerkId is stored).
			user = await queryUserByPolarCustomerId(ctx.db, polarCustomerId);
		}

		if (!user) {
			throw new Error(
				`Cannot save Polar customer ID: no Convex user matches clerkId=${clerkId} or polarCustomerId=${polarCustomerId}`,
			);
		}

		// Never overwrite a different user's customer ID.
		if (user.polarCustomerId && user.polarCustomerId !== polarCustomerId) {
			throw new Error(
				`Cannot overwrite Polar customer ID for Convex user ${user._id}`,
			);
		}

		await ctx.db.patch(user._id, { polarCustomerId });

		// An event may have been parked against this customer ID before we knew
		// which user it belonged to.
		await reconcilePendingSubscriptions(ctx, {
			clerkId: user.clerkId,
			polarCustomerId,
		});
	},
});

// [Phase 3] Apply a verified Polar subscription event to the Convex user.
// Atomic patch only; never creates a user from a webhook (spec 3.6 / 4.5).
export const updateSubscriptionFromPolar = internalMutation({
	args: {
		clerkId: v.optional(v.string()),
		polarCustomerId: v.optional(v.string()),
		polarSubscriptionId: v.optional(v.string()),
		polarSubscriptionStatus: v.optional(v.string()),
		plan: v.union(v.literal("hobby"), v.literal("pro")),
		// Polar event timestamp in ms. Optional for backwards compatibility with
		// any already-scheduled calls; when absent the ordering guard is skipped.
		eventTimestamp: v.optional(v.number()),
	},
	async handler(ctx, args) {
		const applied = await applySubscription(ctx, args);
		if (!applied) {
			console.warn("updateSubscriptionFromPolar: unknown user; not creating from webhook", args);
		}
	},
});

// Park a verified Polar subscription event that could not be applied because the
// Convex user does not exist yet (Bug #1). This replaces the previous one-shot
// `scheduler.runAfter(5s)` retry, which silently dropped the upgrade whenever
// Clerk sync took longer than five seconds, leaving a paying customer on hobby.
export const recordPendingSubscription = internalMutation({
	args: {
		clerkId: v.optional(v.string()),
		polarCustomerId: v.optional(v.string()),
		polarSubscriptionId: v.optional(v.string()),
		polarSubscriptionStatus: v.optional(v.string()),
		plan: v.union(v.literal("hobby"), v.literal("pro")),
		eventTimestamp: v.number(),
	},
	async handler(ctx, args) {
		// The user may have been created between the route's check and now.
		const applied = await applySubscription(ctx, args);
		if (applied) return;

		await ctx.db.insert("pendingSubscriptions", {
			clerkId: args.clerkId,
			polarCustomerId: args.polarCustomerId,
			polarSubscriptionId: args.polarSubscriptionId,
			polarSubscriptionStatus: args.polarSubscriptionStatus,
			plan: args.plan,
			eventTimestamp: args.eventTimestamp,
			createdAt: Date.now(),
		});
	},
});

// [Phase 3] Best-effort Clerk profile re-sync via the Clerk Backend API.
// Triggered from getOrCreateUser when a new user is created with potentially
// incomplete profile (email/name missing from the JWT identity).
// Requires CLERK_SECRET_KEY env var; silently skips if unset.
// The Clerk webhook is the primary sync path — this is a repair fallback.
export const resyncFromClerk = internalAction({
	args: { clerkId: v.string() },
	handler: async (ctx, { clerkId }) => {
		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			console.log("resyncFromClerk: CLERK_SECRET_KEY not configured, skipping");
			return;
		}

		const endpoint = `https://${CLERK_API_HOST}/v1/users/${encodeURIComponent(clerkId)}`;
		const response = await fetch(endpoint, {
			headers: { Authorization: `Bearer ${secretKey}` },
		});

		if (!response.ok) {
			if (response.status === 404) {
				console.warn(`resyncFromClerk: Clerk user ${clerkId} not found`);
			} else {
				console.warn(
					`resyncFromClerk: Clerk API returned ${response.status} for ${clerkId}`,
				);
			}
			return;
		}

		const data = await response.json();
		await ctx.runMutation(internal.users.upsertFromClerk, { data });
	},
});

