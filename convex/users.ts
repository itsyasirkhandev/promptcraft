import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const upsertFromClerk = internalMutation({
  args: { data: v.any() }, // Using v.any() to accept the Clerk webhook event.data payload
  async handler(ctx, { data }) {
    const clerkId = data.id;
    const email = data.email_addresses?.[0]?.email_address ?? "";
    const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
    const avatarUrl = data.image_url;

    // See if the user already exists by clerkId
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name,
        email,
        avatarUrl,
      });
    } else {
      // It doesn't exist by clerkId. Let's check if it exists by tokenIdentifier (from authed login)
      // The identity.subject from Clerk is the clerkId, and the issuer is usually the JWT domain.
      // We will try to find it by tokenIdentifier if we could reconstruct it, but we don't have it here directly unless we know the issuer.
      // A common pattern is to just insert it. Wait, the user might be created by getOrCreateUser first.
      // If we are to insert, we need a tokenIdentifier.
      const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
      const tokenIdentifier = issuer ? `${issuer}|${clerkId}` : `clerk|${clerkId}`;
      
      await ctx.db.insert("users", {
        name,
        email,
        avatarUrl,
        clerkId,
        tokenIdentifier,
        plan: "hobby",
      });
    }
  },
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  async handler(ctx, { clerkUserId }) {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkUserId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
