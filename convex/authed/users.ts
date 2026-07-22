// User management — syncs Firebase auth identity to the Convex users table.
//
// This file shows the pattern for user upsert:
// 1. Look up user by tokenIdentifier (stable across token refreshes)
// 2. Create if missing, update if fields changed
// 3. Return the Convex user document

import { effectAuthedMutation, effectAuthedQuery, AuthedContext } from './helpers';
import { Effect } from 'effect';
import { ConvexDB, ConvexScheduler } from '../services/ConvexDB';
import { GenericDatabaseWriter, Scheduler, type UserIdentity } from 'convex/server';
import { DataModel, Doc } from '../_generated/dataModel';
import { internal } from '../_generated/api';
import { queryUserByClerkId, queryUserByEmail, queryUserByToken } from '../userQueries';

// [Phase 3] Wrap the internal-action schedule in an explicitly-typed function so the
// effectAuthedMutation handler's R/E inference doesn't transitively depend on the
// generated `internal` api tree (getOrCreateUser is itself referenced by that tree, so
// an inline `internal.billing.sync.*` reference would create a circular type). The
// explicit return type is the ceiling; upgrade by removing this helper only if Convex
// codegen stops tying `internal` and `api` to the same per-file type.
async function schedulePolarCustomerSync(
	scheduler: Scheduler,
	clerkId: string,
	email: string,
	name: string | undefined,
): Promise<void> {
	await scheduler.runAfter(0, internal.billing.sync.ensurePolarCustomer, { clerkId, email, name });
}

// Same workaround as schedulePolarCustomerSync: extracting the internal.api
// reference into an explicitly-typed function breaks the circular type chain
// that a direct `internal.users.resyncFromClerk` inline would create.
async function scheduleClerkResync(
	scheduler: Scheduler,
	clerkId: string,
): Promise<void> {
	await scheduler.runAfter(5_000, internal.users.resyncFromClerk, { clerkId });
}

// Resolve the authed viewer by tokenIdentifier, then converge on clerkId and email so the
// authed path and the Clerk webhook never create duplicate users.
function resolveAuthedViewer(
	db: GenericDatabaseWriter<DataModel>,
	identity: UserIdentity,
) {
	return Effect.gen(function* () {
		let viewer = yield* Effect.tryPromise(() => queryUserByToken(db, identity.tokenIdentifier));
		if (!viewer && identity.subject) {
			viewer = yield* Effect.tryPromise(() => queryUserByClerkId(db, identity.subject));
		}
		if (!viewer && identity.email) {
			viewer = yield* Effect.tryPromise(() => queryUserByEmail(db, identity.email!));
		}
		return viewer;
	});
}

// Apply only changed identity fields, then re-read the patched viewer.
function patchViewerUpdates(
	db: GenericDatabaseWriter<DataModel>,
	viewer: Doc<'users'>,
	identity: UserIdentity,
) {
	return Effect.gen(function* () {
		const tokenIdentifier = identity.tokenIdentifier;
		const updates: Record<string, string | undefined> = {};
		if (identity.name && viewer.name !== identity.name) {
			updates.name = identity.name;
		}
		if (identity.email && viewer.email !== identity.email) {
			updates.email = identity.email;
		}
		if (identity.pictureUrl && viewer.avatarUrl !== identity.pictureUrl) {
			updates.avatarUrl = identity.pictureUrl;
		}
		if (viewer.clerkId !== identity.subject) {
			updates.clerkId = identity.subject;
		}
		if (viewer.tokenIdentifier !== tokenIdentifier) {
			updates.tokenIdentifier = tokenIdentifier;
		}

		if (Object.keys(updates).length > 0) {
			yield* Effect.tryPromise(() => db.patch(viewer._id, updates));
			return (yield* Effect.tryPromise(() => db.get(viewer._id)))!;
		}
		return viewer;
	});
}

// Insert the one user for this identity, then read it back.
function insertNewViewer(
	db: GenericDatabaseWriter<DataModel>,
	identity: UserIdentity,
) {
	return Effect.gen(function* () {
		const userId = yield* Effect.tryPromise(() =>
			db.insert('users', {
				name: identity.name ?? '',
				email: identity.email ?? '',
				avatarUrl: identity.pictureUrl,
				tokenIdentifier: identity.tokenIdentifier,
				clerkId: identity.subject,
				plan: 'hobby',
			})
		);
		return (yield* Effect.tryPromise(() => db.get(userId)))!;
	});
}

// [Phase 3] Only the insert branch schedules the idempotent Polar customer sync
// (spec 3.1). A Polar failure never rolls back signup (sync action logs + skips).
function maybeSchedulePolarSync(identity: UserIdentity) {
	return Effect.gen(function* () {
		const clerkId = identity.subject;
		const email = identity.email;
		if (email && clerkId) {
			const { scheduler } = yield* ConvexScheduler;
			yield* Effect.tryPromise(() =>
				schedulePolarCustomerSync(scheduler, clerkId, email, identity.name ?? undefined)
			);
		}
	});
}

export const getOrCreateUser = effectAuthedMutation({
	args: {},
	handler: () =>
		Effect.gen(function* () {
			const { identity } = yield* AuthedContext;
			yield* Effect.logInfo(`getOrCreateUser for: ${identity.email || 'unknown'}`);

			const { db } = yield* ConvexDB;
			const writerDb = db as GenericDatabaseWriter<DataModel>;

			let viewer = yield* resolveAuthedViewer(writerDb, identity);
			if (viewer) {
				viewer = yield* patchViewerUpdates(writerDb, viewer, identity);
			} else {
				viewer = yield* insertNewViewer(writerDb, identity);
				yield* maybeSchedulePolarSync(identity);

				// Schedule a deferred re-sync from Clerk API to backfill any profile
				// fields (email, name) that the JWT identity may not carry.
				const clerkId = identity.subject;
				if (clerkId && !identity.email) {
					const { scheduler } = yield* ConvexScheduler;
					yield* Effect.tryPromise(() => scheduleClerkResync(scheduler, clerkId));
				}
			}
			return viewer._id;
		})
});

export const currentUser = effectAuthedQuery({
	args: {},
	handler: () =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			return viewer;
		})
});

