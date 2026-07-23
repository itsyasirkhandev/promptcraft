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

let cachedConfig: { convexUrl: string } | null = null;
let configError: Error | null = null;

function getConfig(): { convexUrl: string } {
  if (cachedConfig) return cachedConfig;
  if (configError) throw configError;
  try {
    const result = Effect.runSync(
      ClientConfig.pipe(Effect.provide(ClientConfig.layer))
    );
    cachedConfig = result;
    return result;
  } catch (err) {
    configError = err instanceof Error ? err : new Error(String(err));
    throw configError;
  }
}

export const clientConfig = {
  get convexUrl() {
    return getConfig().convexUrl;
  },
};
