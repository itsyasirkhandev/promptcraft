import { v } from 'convex/values';
import { privateQuery } from './helpers';
import { Effect } from 'effect';

export const privateDemoQuery = privateQuery({
	args: {
		username: v.string()
	},
	handler: async (ctx, args) => Effect.runPromise(Effect.gen(function* () {
		const { username } = args;

		// Effect.logInfo provides structured logging
		yield* Effect.logInfo(`Private backend route accessed for: ${username}`);

		return { username };
	}))
});
