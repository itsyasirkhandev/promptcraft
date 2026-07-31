import { Context, Effect, Layer } from 'effect';
import { env } from '../_generated/server';

// [Phase 10] ServerConfig now sources values from the typed app environment
// (`env` from `_generated/server`, declared in convex/convex.config.ts via
// defineApp) instead of raw process.env / Effect Config, per the Convex
// guidelines. Polar billing config stays optional at the service layer so
// unrelated functions (which also build this layer) keep working without Polar
// credentials; the Polar provider fails closed when these are missing.
// CONVEX_PRIVATE_BRIDGE_KEY and POLAR_WEBHOOK_SECRET were dropped: their only
// consumers (the deleted convex/private/helpers.ts API-key guard and the http
// route, which reads env.POLAR_WEBHOOK_SECRET directly) no longer use them.
export class ServerConfig extends Context.Service<
	ServerConfig,
	{
		readonly polarAccessToken: string | null;
		readonly polarServer: 'sandbox' | 'production' | null;
	}
>()('ServerConfig') {
	static readonly layer = Layer.effect(
		ServerConfig,
		Effect.gen(function* () {
			const polarAccessToken = env.POLAR_ACCESS_TOKEN ?? null;
			const polarServerRaw = env.POLAR_SERVER;
			const polarServer =
				polarServerRaw === 'sandbox' || polarServerRaw === 'production'
					? polarServerRaw
					: null;

			return {
				polarAccessToken,
				polarServer
			};
		})
	);
}
