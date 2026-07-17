// [Phase 3] Internal queries used by the Polar provider/webhook to correlate a
// Convex user from Clerk or Polar identifiers (spec 3.6 / 4.5).
// internalQuery = not internet-exposed; callable only by other Convex functions.

import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const getUserInfoForPolar = internalQuery({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_polar_customer_id", (q) => q.eq("polarCustomerId", polarCustomerId))
      .unique();
    return user;
  },
});
