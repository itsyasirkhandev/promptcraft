import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc } from "./_generated/dataModel";

// [Phase 3] Convergent Clerk upsert + Polar internal mutations.
//
// upsertFromClerk resolves by clerkId first, then by reconstructed tokenIdentifier,
// so the Clerk webhook and the authenticated getOrCreateUser entry points converge on
// one Convex user. Only the branch that actually inserts schedules the shared idempotent
// Polar customer synchronization. A Polar failure must never roll back signup (spec 3.1).

function reconstructTokenIdentifier(clerkId: string): string {
  const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN;
  return issuer ? `${issuer}|${clerkId}` : `clerk|${clerkId}`;
}

export const upsertFromClerk = internalMutation({
  args: { data: v.any() }, // Using v.any() to accept the Clerk webhook event.data payload
  async handler(ctx, { data }) {
    const clerkId = data.id;
    const email = data.email_addresses?.[0]?.email_address ?? "";
    const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim();
    const avatarUrl = data.image_url;

    // 1. Resolve by clerkId (canonical).
    let existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    // 2. Converge: if not found by clerkId, check the reconstructed tokenIdentifier
    //    so the webhook and the authed getOrCreateUser path never create duplicates.
    if (!existing) {
      const tokenIdentifier = reconstructTokenIdentifier(clerkId);
      existing = await ctx.db
        .query("users")
        .withIndex("by_token", (q) => q.eq("tokenIdentifier", tokenIdentifier))
        .unique();
    }

    if (existing) {
      // Profile update (Clerk user.updated). Apply only changed fields.
      const updates: Record<string, string | undefined> = {};
      if (name !== existing.name) updates.name = name;
      if (email !== existing.email) updates.email = email;
      if (avatarUrl !== existing.avatarUrl) updates.avatarUrl = avatarUrl;
      if (existing.clerkId !== clerkId) updates.clerkId = clerkId;
      const tokenIdentifier = reconstructTokenIdentifier(clerkId);
      if (existing.tokenIdentifier !== tokenIdentifier) {
        updates.tokenIdentifier = tokenIdentifier;
      }

      const profileChanged = email !== existing.email || name !== existing.name;

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
      }

      // Schedule Polar profile sync after the local write (spec 3.2).
      // If no Polar customer yet, repair via ensure-customer instead.
      if (profileChanged && email) {
        if (existing.polarCustomerId) {
          await ctx.scheduler.runAfter(0, internal.billing.sync.syncPolarCustomerProfile, {
            clerkId,
            email,
            name: name || undefined,
          });
        } else {
          await ctx.scheduler.runAfter(0, internal.billing.sync.ensurePolarCustomer, {
            clerkId,
            email,
            name: name || undefined,
          });
        }
      }
    } else {
      // 3. Neither lookup matched — insert the one user. Only this path schedules
      //    Polar customer synchronization and the welcome email (spec 3.1, 4.1).
      const tokenIdentifier = reconstructTokenIdentifier(clerkId);
      await ctx.db.insert("users", {
        name,
        email,
        avatarUrl,
        clerkId,
        tokenIdentifier,
        plan: "hobby",
      });

      if (email) {
        await ctx.scheduler.runAfter(0, internal.billing.sync.ensurePolarCustomer, {
          clerkId,
          email,
          name: name || undefined,
        });
        await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
          email,
          name: name || undefined,
        });
      } else {
        console.warn("Skipping welcome email and Polar sync: user has no email address.");
      }
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
      // Per spec 3.7: delete only the Convex user. Never touch Polar billing records.
      await ctx.db.delete(existing._id);
    }
  },
});

// [Phase 3] Save the real Polar customer ID on the matching Convex user.
// Resolves by clerkId first, then by stored polarCustomerId as a safe fallback.
// Never saves an ID to a different user and never inserts a user from this path.
export const savePolarCustomerId = internalMutation({
  args: { clerkId: v.string(), polarCustomerId: v.string() },
  async handler(ctx, { clerkId, polarCustomerId }) {
    let user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (!user) {
      // Fallback correlation (webhook may arrive before the clerkId is stored).
      user = await ctx.db
        .query("users")
        .withIndex("by_polar_customer_id", (q) => q.eq("polarCustomerId", polarCustomerId))
        .unique();
    }

    if (!user) {
      console.warn(`savePolarCustomerId: no Convex user for clerkId=${clerkId} or polarCustomerId=${polarCustomerId}`);
      return;
    }

    // Never overwrite a different user's customer ID.
    if (user.polarCustomerId && user.polarCustomerId !== polarCustomerId) {
      console.warn(`savePolarCustomerId: refusing to overwrite existing Polar customer ID for user ${user._id}`);
      return;
    }

    await ctx.db.patch(user._id, { polarCustomerId });
  },
});

// [Phase 3] Apply a verified Polar subscription event to the Convex user.
// Resolves by clerkId first, then by stored polarCustomerId as a safe fallback.
// Atomic patch only; never creates a user from a webhook (spec 3.6 / 4.5).
export const updateSubscriptionFromPolar = internalMutation({
  args: {
    clerkId: v.optional(v.string()),
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
    polarSubscriptionStatus: v.optional(v.string()),
    plan: v.union(v.literal("hobby"), v.literal("pro")),
  },
  async handler(ctx, args) {
    let user: Doc<"users"> | null = null;

    if (args.clerkId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
        .unique();
    }

    if (!user && args.polarCustomerId) {
      user = await ctx.db
        .query("users")
        .withIndex("by_polar_customer_id", (q) => q.eq("polarCustomerId", args.polarCustomerId))
        .unique();
    }

    if (!user) {
      console.warn("updateSubscriptionFromPolar: unknown user; not creating from webhook", args);
      return;
    }

    await ctx.db.patch(user._id, {
      polarCustomerId: args.polarCustomerId ?? user.polarCustomerId,
      polarSubscriptionId: args.polarSubscriptionId,
      polarSubscriptionStatus: args.polarSubscriptionStatus,
      plan: args.plan,
    });
  },
});
