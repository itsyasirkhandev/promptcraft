"use node";

// [Phase 2] Polar SDK client factory — reads validated ServerConfig, fails closed.
import { Polar } from "@polar-sh/sdk";
import { Effect, Schema } from "effect";
import { ServerConfig } from "../services/ServerConfig";

export class PolarConfigError extends Schema.TaggedErrorClass<PolarConfigError>()(
  "PolarConfigError",
  { message: Schema.String },
) {}

/**
 * Build a Polar SDK client from the shared ServerConfig layer.
 * Fails closed (PolarConfigError) when POLAR_ACCESS_TOKEN or POLAR_SERVER
 * is missing/invalid, so no Polar call proceeds without full credentials.
 */
export function getPolarClient(): Effect.Effect<Polar, PolarConfigError, ServerConfig> {
  return Effect.gen(function* () {
    const cfg = yield* ServerConfig;
    if (!cfg.polarAccessToken) {
      return yield* new PolarConfigError({
        message: "Polar billing is not configured: POLAR_ACCESS_TOKEN is missing.",
      });
    }
    if (!cfg.polarServer) {
      return yield* new PolarConfigError({
        message: "Polar billing is not configured: POLAR_SERVER must be sandbox or production.",
      });
    }
    return new Polar({
      accessToken: cfg.polarAccessToken,
      server: cfg.polarServer,
    });
  });
}