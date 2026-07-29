"use node";

import { Effect } from "effect";
import { v } from "convex/values";
import { AuthedContext, effectAuthedAction } from "./helpers";
import { ConvexActions } from "../services/ConvexDB";
import { ServerConfig } from "../services/ServerConfig";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { ensureCustomer, createCheckout, createPortal, PolarBillingError, type BillingBackend } from "../billing/provider";

export type BillingUrlResult = { destination: "checkout" | "portal"; url: string };
type ActionAccessors = { runQuery: ActionCtx['runQuery']; runMutation: ActionCtx['runMutation'] };
type PolarUserInfo = { userId: string; email: string; name: string; polarCustomerId: string | null; plan: "hobby" | "pro" };

async function loadPolarUserInfo(actions: ActionAccessors, clerkId: string): Promise<PolarUserInfo | null> {
  return actions.runQuery(internal.private.users.getUserInfoForPolar, { clerkId }) as Promise<PolarUserInfo | null>;
}

function makeBillingBackend(actions: ActionAccessors): BillingBackend {
  return {
    getUserInfoForPolar: (clerkId) => actions.runQuery(internal.private.users.getUserInfoForPolar, { clerkId }) as Promise<PolarUserInfo | null>,
    savePolarCustomerId: async (clerkId, polarCustomerId) => {
      await actions.runMutation(internal.users.savePolarCustomerId, { clerkId, polarCustomerId });
    },
  };
}

function checkoutConfig() {
  const productId = process.env.POLAR_PRODUCT_ID;
  const siteUrlValue = process.env.SITE_URL;
  if (!productId || !siteUrlValue) {
    return Effect.fail(new PolarBillingError({ message: "Billing is not fully configured." }));
  }
  try {
    const siteUrl = new URL(siteUrlValue);
    const isLocal = siteUrl.hostname === "localhost" || siteUrl.hostname === "127.0.0.1";
    if (isLocal) {
      if (process.env.POLAR_SERVER !== "sandbox" || !["http:", "https:"].includes(siteUrl.protocol)) {
        return Effect.fail(new PolarBillingError({ message: "Invalid production application URL." }));
      }
    } else if (siteUrl.protocol !== "https:") {
      return Effect.fail(new PolarBillingError({ message: "Application URL must use HTTPS." }));
    }
    return Effect.succeed({
      productId,
      successUrl: new URL("/dashboard/billing?checkout=success", siteUrl).toString(),
    });
  } catch {
    return Effect.fail(new PolarBillingError({ message: "Invalid application URL configuration." }));
  }
}

export const generateCheckoutUrl = effectAuthedAction({
  args: {
    productId: v.optional(v.string()),
    successUrl: v.optional(v.string()),
  },
  handler: () => Effect.gen(function* () {
    const { identity } = yield* AuthedContext;
    const clerkId = identity.subject;
    if (!clerkId) return yield* new PolarBillingError({ message: "Missing Clerk identity." });

    const actions = yield* ConvexActions;
    const user = yield* Effect.tryPromise({
      try: () => loadPolarUserInfo(actions, clerkId),
      catch: (error) => new PolarBillingError({ message: `Failed to load billing account: ${String(error)}` }),
    });
    if (user?.plan === "pro") {
      if (!user.polarCustomerId) return yield* new PolarBillingError({ message: "Pro account is missing its Polar customer." });
      return { destination: "portal" as const, url: yield* createPortal(user.polarCustomerId) };
    }

    const email = user?.email || identity.email || "";
    if (!email) return yield* new PolarBillingError({ message: "An account email is required to start checkout." });
    const config = yield* checkoutConfig();
    const customerId = yield* ensureCustomer(makeBillingBackend(actions), clerkId, email, user?.name ?? identity.name ?? undefined);
    return { destination: "checkout" as const, url: yield* createCheckout(customerId, config.productId, config.successUrl) };
  }).pipe(Effect.provide(ServerConfig.layer)),
});

export const generatePortalUrl = effectAuthedAction({
  args: {},
  handler: () => Effect.gen(function* () {
    const { identity } = yield* AuthedContext;
    const clerkId = identity.subject;
    if (!clerkId) return yield* new PolarBillingError({ message: "Missing Clerk identity." });
    const actions = yield* ConvexActions;
    const user = yield* Effect.tryPromise({
      try: () => loadPolarUserInfo(actions, clerkId),
      catch: (error) => new PolarBillingError({ message: `Failed to load billing account: ${String(error)}` }),
    });
    if (!user || user.plan !== "pro" || !user.polarCustomerId) {
      return yield* new PolarBillingError({ message: "Customer portal access requires an active Pro subscription." });
    }
    return { destination: "portal" as const, url: yield* createPortal(user.polarCustomerId) };
  }).pipe(Effect.provide(ServerConfig.layer)),
});
