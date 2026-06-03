// User management — syncs Firebase auth identity to the Convex users table.
//
// This file shows the pattern for user upsert:
// 1. Look up user by tokenIdentifier (stable across token refreshes)
// 2. Create if missing, update if fields changed
// 3. Return the Convex user document

import { authedMutation, authedQuery, runAuthedEffect } from './helpers';
import { Effect } from 'effect';

export const getOrCreateUser = authedMutation({
	args: {},
	handler: async (ctx) => runAuthedEffect(
		Effect.gen(function* () {
			yield* Effect.logInfo(`getOrCreateUser (auto-synced) for: ${ctx.viewer.email || 'unknown'}`);
			return ctx.viewer._id;
		})
	)
});

export const currentUser = authedQuery({
	args: {},
	handler: async (ctx) => runAuthedEffect(
		Effect.gen(function* () {
			return ctx.viewer;
		})
	)
});

