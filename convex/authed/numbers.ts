// Number generator — demo authed queries and mutations.
//
// This file shows the pattern for feature-specific Convex functions:
// 1. Import the authed helpers (effectAuthedQuery, effectAuthedMutation)
// 2. Define validators for arguments
// 3. Use AuthedContext to access identity
// 4. Use Effect for structured logging

import { v } from 'convex/values';
import { effectAuthedQuery, effectAuthedMutation, AuthedContext } from './helpers';
import { Effect } from 'effect';
import { ConvexDB } from '../services/ConvexDB';
import { GenericDatabaseWriter } from 'convex/server';
import { DataModel } from '../_generated/dataModel';

export const listNumbers = effectAuthedQuery({
	args: {
		count: v.number()
	},
	handler: (args) =>
		Effect.gen(function* () {
			const { identity, viewer } = yield* AuthedContext;
			const viewerName = viewer?.name || identity.name || 'User';
			yield* Effect.logInfo(
				`Listing ${args.count} numbers for: ${viewerName}`
			);

			const { db } = yield* ConvexDB;
			const numbers = yield* Effect.tryPromise(() =>
				db
					.query('numbers')
					.order('desc')
					.take(args.count)
			);
			const values = numbers.reverse().map((n) => n.value);

			return {
				viewer: viewerName,
				numbers: values
			};
		})
});

export const addNumber = effectAuthedMutation({
	args: {
		value: v.number()
	},
	handler: (args) =>
		Effect.gen(function* () {
			const { identity, viewer } = yield* AuthedContext;
			const viewerName = viewer?.name || identity.name || 'User';
			yield* Effect.logInfo(
				`Adding number ${args.value} for: ${viewerName}`
			);

			const { db } = yield* ConvexDB;
			const writerDb = db as GenericDatabaseWriter<DataModel>;
			yield* Effect.tryPromise(() => writerDb.insert('numbers', { value: args.value }));
		})
});
