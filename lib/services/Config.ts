import { Context, Effect, Layer } from "effect";

/** @expected-unused */
export class ClientConfig extends Context.Service<
  ClientConfig,
  {
    readonly convexUrl: string;
  }
>()("@app/ClientConfig") {
  static readonly layer = Layer.effect(
    ClientConfig,
    Effect.gen(function* () {
      const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

      if (!convexUrl) {
        return yield* Effect.fail(
          new Error("Missing environment variable: NEXT_PUBLIC_CONVEX_URL")
        );
      }

      return {
        convexUrl,
      };
    })
  );
}

// Helper to run the config service effect on-demand
const getConfig = () =>
  Effect.runSync(ClientConfig.pipe(Effect.provide(ClientConfig.layer)));

export const clientConfig = {
  get convexUrl() {
    return getConfig().convexUrl;
  },
};
