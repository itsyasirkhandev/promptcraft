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
		return queryUserByEmail(ctx.db, profile.email);
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
	},
});

export const deleteFromClerk = internalMutation({
	args: { clerkUserId: v.string() },
	async handler(ctx, { clerkUserId }) {
		const existing = await queryUserByClerkId(ctx.db, clerkUserId);
		if (existing) {
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
	},
});

// [Phase 3] Apply a verified Polar subscription event to the Convex user.
// Resolves by clerkId first, then by stored polarCustomerId as a safe fallback.
// Atomic patch only; never creates a user from a webhook (spec 3.6 / 4.5).
export const updateSubscriptionFromPolar = internalMutation({
	args: {
		clerkId: v.optional(v.string()),
		polarCustomerId: v.optional(v.string()),
		polarSubscriptionId: v.optional(v.string()),
		polarSubscriptionStatus: v.optional(v.string()),
		plan: v.union(v.literal("hobby"), v.literal("pro")),
	},
	async handler(ctx, args) {
		let user: Doc<"users"> | null = null;

		if (args.clerkId) {
			user = await queryUserByClerkId(ctx.db, args.clerkId);
		}
		if (!user && args.polarCustomerId) {
			user = await queryUserByPolarCustomerId(ctx.db, args.polarCustomerId);
		}

		if (!user) {
			console.warn("updateSubscriptionFromPolar: unknown user; not creating from webhook", args);
			return;
		}

		// Capture the pre-transition plan so a replayed granting event for an
		// already-Pro user does not resend the email.
		const wasHobby = user.plan === "hobby";

		await ctx.db.patch(user._id, {
			polarCustomerId: args.polarCustomerId ?? user.polarCustomerId,
			polarSubscriptionId: args.polarSubscriptionId,
			polarSubscriptionStatus: args.polarSubscriptionStatus,
			plan: args.plan,
		});

		if (wasHobby && args.plan === "pro" && user.email) {
			await ctx.scheduler.runAfter(0, internal.emails.sendProUpgradeEmail, {
				email: user.email,
				name: user.name || undefined,
			});
		} else if (wasHobby && args.plan === "pro" && !user.email) {
			console.warn("Skipping Pro upgrade email: user has no email address.");
		}
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

		const response = await fetch(
			`https://api.clerk.com/v1/users/${encodeURIComponent(clerkId)}`,
			{ headers: { Authorization: `Bearer ${secretKey}` } },
		);

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

