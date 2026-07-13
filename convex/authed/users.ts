// User management — syncs Firebase auth identity to the Convex users table.
//
// This file shows the pattern for user upsert:
// 1. Look up user by tokenIdentifier (stable across token refreshes)
// 2. Create if missing, update if fields changed
// 3. Return the Convex user document

import { effectAuthedMutation, effectAuthedQuery, AuthedContext } from './helpers';
import { Effect } from 'effect';
import { ConvexDB } from '../services/ConvexDB';
import { GenericDatabaseWriter } from 'convex/server';
import { DataModel } from '../_generated/dataModel';

export const getOrCreateUser = effectAuthedMutation({
	args: {},
	handler: () =>
		Effect.gen(function* () {
			const { identity } = yield* AuthedContext;
			yield* Effect.logInfo(`getOrCreateUser for: ${identity.email || 'unknown'}`);
            
			const { db } = yield* ConvexDB;
			const writerDb = db as GenericDatabaseWriter<DataModel>;
			const tokenIdentifier = identity.tokenIdentifier;

			let viewer = yield* Effect.tryPromise(() =>
				writerDb
					.query('users')
					.withIndex('by_token', (q) => q.eq('tokenIdentifier', tokenIdentifier))
					.unique()
			);

			if (!viewer && identity.subject) {
				viewer = yield* Effect.tryPromise(() =>
					writerDb
						.query('users')
						.withIndex('by_clerk_id', (q) => q.eq('clerkId', identity.subject))
						.unique()
				);
			}

			if (viewer) {
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
					yield* Effect.tryPromise(() => writerDb.patch(viewer!._id, updates));
					viewer = (yield* Effect.tryPromise(() => writerDb.get(viewer!._id)))!;
				}
			} else {
				const userId = yield* Effect.tryPromise(() =>
					writerDb.insert('users', {
						name: identity.name ?? '',
						email: identity.email ?? '',
						avatarUrl: identity.pictureUrl,
						tokenIdentifier,
						clerkId: identity.subject,
						plan: 'hobby'
					})
				);
				viewer = (yield* Effect.tryPromise(() => writerDb.get(userId)))!;
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
