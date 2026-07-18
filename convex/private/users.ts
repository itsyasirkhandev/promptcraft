// [Phase 3] Internal queries used by the Polar provider/webhook to correlate a
// Convex user from Clerk or Polar identifiers (spec 3.6 / 4.5).
// internalQuery = not internet-exposed; callable only by other Convex functions.

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { queryUserByClerkId, queryUserByPolarCustomerId } from "../userQueries";

export const getUserInfoForPolar = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await queryUserByClerkId(ctx.db, clerkId);
    if (!user) return null;
    return {
      userId: user._id,
      email: user.email,
      name: user.name,
      polarCustomerId: user.polarCustomerId ?? null,
      plan: user.plan,
    };
  },
});

export const getByPolarCustomerId = internalQuery({
  args: { polarCustomerId: v.string() },
  handler: async (ctx, { polarCustomerId }) => {
    return queryUserByPolarCustomerId(ctx.db, polarCustomerId);
  },
});

