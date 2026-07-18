"use node";

// [Phase 3] Internal Polar sync actions. Scheduled from the convergent user-creation
// paths (upsertFromClerk / getOrCreateUser). Best-effort: failures are logged and never
// throw into the signup path (spec 3.1: signup stays successful when Polar is down).

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Effect } from "effect";
import { ServerConfig } from "../services/ServerConfig";
import { runEffect } from "../effectHelpers";
import { ensureCustomer, syncCustomerProfile, type BillingBackend } from "./provider";

export const ensurePolarCustomer = internalAction({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const backend: BillingBackend = {
      getUserInfoForPolar: (clerkId) =>
        ctx.runQuery(internal.private.users.getUserInfoForPolar, { clerkId }),
      savePolarCustomerId: async (clerkId, polarCustomerId) => {
        await ctx.runMutation(internal.users.savePolarCustomerId, { clerkId, polarCustomerId });
      },
    };
    const program = ensureCustomer(backend, args.clerkId, args.email, args.name).pipe(
      Effect.catchTag("PolarBillingError", (error) =>
        Effect.logError(`ensurePolarCustomer failed for ${args.clerkId}: ${error.message}`),
      ),
      Effect.catchTag("PolarConfigError", (error) =>
        Effect.logError(`ensurePolarCustomer: Polar not configured: ${error.message}`),
      ),
    );
    await runEffect(program.pipe(Effect.provide(ServerConfig.layer)));
  },
});

export const syncPolarCustomerProfile = internalAction({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const program = syncCustomerProfile(args.clerkId, args.email, args.name).pipe(
      Effect.catchTag("PolarConfigError", (error) =>
        Effect.logError(`syncPolarCustomerProfile: Polar not configured: ${error.message}`),
      ),
    );
    await runEffect(program.pipe(Effect.provide(ServerConfig.layer)));
  },
});

