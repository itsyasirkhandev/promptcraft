// Authed convention reference — AI-readable demonstration of the canonical pattern.
//
// Pattern: effectAuthedQuery with Effect.gen + Effect.tryPromise for ALL async work.
// This matches the real feature files (users.ts, numbers.ts) exactly.
// See docs/adr/0003-effect-ts-convex.md for the rationale.

import { v } from 'convex/values';
import { effectAuthedQuery, AuthedContext } from './helpers';
import { Effect, Schema } from 'effect';
import { ConvexDB } from '../services/ConvexDB';

// Define a domain error using Effect v4 TaggedErrorClass
export class DemoError extends Schema.TaggedErrorClass<DemoError>()("DemoError", {
	message: Schema.String
}) {}

export const authedDemoQuery = effectAuthedQuery({
	args: { count: v.number() },
	handler: (args) =>
		Effect.gen(function* () {
			const { identity } = yield* AuthedContext;
			// 1. Structured logging with Effect
			yield* Effect.logInfo(`Received authed query for: ${identity.email || 'User'}`);

			// 2. Example typed domain error
			if (!identity.tokenIdentifier) {
				return yield* new DemoError({ message: "Missing token identifier" });
			}

			// 3. Convex db calls go inside Effect.tryPromise (the v4 canonical pattern)
			const { db } = yield* ConvexDB;
			const numbers = yield* Effect.tryPromise(() =>
				db
					.query('numbers')
					.order('desc')
					.take(args.count)
			);

			return {
				viewer: identity.name ?? null,
				count: numbers.length,
			};
		}).pipe(
			Effect.catchTag("DemoError", (error) =>
				Effect.succeed({ viewer: null, count: 0, error: error.message })
			)
		)
});
