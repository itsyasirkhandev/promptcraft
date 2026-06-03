import { authedQuery } from './helpers';
import { Effect } from 'effect';

export const authedDemoQuery = authedQuery({
	args: {},
	handler: async (ctx) => Effect.runPromise(Effect.gen(function* () {
		// Log the incoming request leveraging Effect-TS
		yield* Effect.logInfo(`Received authed query for: ${ctx.identity.email || 'User'}`);
		
		const message = `Hello, ${ctx.identity.email || 'User'}!`;
		return { message };
	}))
});
