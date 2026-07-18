import { Context, Effect, Layer, Config, Option } from 'effect';

export class ServerConfig extends Context.Service<
	ServerConfig,
	{
		readonly convexPrivateBridgeKey: string;
		readonly polarAccessToken: string | null;
		readonly polarWebhookSecret: string | null;
		readonly polarServer: 'sandbox' | 'production' | null;
	}
>()('ServerConfig') {
	static readonly layer = Layer.effect(
		ServerConfig,
		Effect.gen(function* () {
			const convexPrivateBridgeKey = yield* Config.string('CONVEX_PRIVATE_BRIDGE_KEY');

			// Polar billing config is optional at the service layer so unrelated
			// private functions (which also build this layer) keep working without
			// Polar credentials. The Polar provider fails closed when these are missing.
			const polarAccessToken = Option.getOrElse(
				yield* Config.option(Config.string('POLAR_ACCESS_TOKEN')),
				() => null
			);
			const polarWebhookSecret = Option.getOrElse(
				yield* Config.option(Config.string('POLAR_WEBHOOK_SECRET')),
				() => null
			);
			const polarServerRaw = Option.getOrElse(
				yield* Config.option(Config.string('POLAR_SERVER')),
				() => null
			);
			const polarServer =
				polarServerRaw === 'sandbox' || polarServerRaw === 'production'
					? polarServerRaw
					: null;

			return {
				convexPrivateBridgeKey,
				polarAccessToken,
				polarWebhookSecret,
				polarServer
			};
		})
	);
}
