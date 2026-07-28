"use node";

import { Effect } from "effect";
import { v } from "convex/values";
import { AuthedContext, effectAuthedAction } from "./helpers";
import { ConvexActions } from "../services/ConvexDB";
import { ServerConfig } from "../services/ServerConfig";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { ensureCustomer, createCheckout, createPortal, PolarBillingError, type BillingBackend } from "../billing/provider";

export type BillingUrlResult = {
  destination: "checkout" | "portal";
  url: string;
};

type ActionAccessors = { runQuery: ActionCtx['runQuery']; runMutation: ActionCtx['runMutation'] };

type PolarUserInfo = {
  userId: string;
  email: string;
  name: string;
  polarCustomerId: string | null;
  plan: "hobby" | "pro";
};

async function loadPolarUserInfo(
  actions: ActionAccessors,
  clerkId: string,
): Promise<PolarUserInfo | null> {
  return actions.runQuery(internal.private.users.getUserInfoForPolar, { clerkId }) as Promise<PolarUserInfo | null>;
}

function makeBillingBackend(actions: ActionAccessors): BillingBackend {
  return {
    getUserInfoForPolar: (ck) =>
      actions.runQuery(internal.private.users.getUserInfoForPolar, { clerkId: ck }) as Promise<PolarUserInfo | null>,
    savePolarCustomerId: async (ck, pcid) => {
      await actions.runMutation(internal.users.savePolarCustomerId, {
        clerkId: ck,
        polarCustomerId: pcid,
      });
    },
  };
}

function getCheckoutConfig(requestedSuccessUrl: string) {
  const productId = process.env.POLAR_PRODUCT_ID;
  const configuredSiteUrl = process.env.SITE_URL;
  if (!productId) {
    return Effect.fail(new PolarBillingError({ message: "Polar product is not configured." }));
  }

  try {
    const successUrl = new URL(requestedSuccessUrl);
    // If SITE_URL is explicitly configured in environment (and not empty or localhost/dev placehoder), validate against it.
    // If SITE_URL is not set or in local dev, accept any valid HTTP/HTTPS success URL.
    if (configuredSiteUrl && configuredSiteUrl.trim() !== "") {
      try {
        const siteUrlOrigin = new URL(configuredSiteUrl).origin;
        // If siteUrlOrigin is set to a remote domain while requested origin is localhost, log / fallback if needed,
        // or check if requested successUrl matches or if requested URL is localhost.
        if (successUrl.origin !== siteUrlOrigin && !successUrl.origin.includes("localhost") && !successUrl.origin.includes("127.0.0.1")) {
          return Effect.fail(new PolarBillingError({ message: "Invalid checkout success URL." }));
        }
      } catch {
        // Invalid SITE_URL, ignore validation error in dev
      }
    }
    return Effect.succeed({ productId, successUrl: successUrl.toString() });
  } catch {
    return Effect.fail(new PolarBillingError({ message: "Invalid checkout success URL." }));
  }
}

export const generateCheckoutUrl = effectAuthedAction({
  // productId is retained for backwards compatibility with deployed clients,
  // but billing always uses the server-controlled POLAR_PRODUCT_ID.
  args: { productId: v.string(), successUrl: v.string() },
  handler: ({ successUrl }) =>
    Effect.gen(function* () {
      const { identity } = yield* AuthedContext;
      const clerkId = identity.subject;
      if (!clerkId) {
        return yield* new PolarBillingError({ message: "Missing Clerk identity." });
      }

      const actions = yield* ConvexActions;
      const user = yield* Effect.tryPromise({
        try: () => loadPolarUserInfo(actions, clerkId),
        catch: (e) =>
          new PolarBillingError({ message: `Failed to load user: ${String(e)}` }),
      });

      if (user?.plan === "pro") {
        if (!user.polarCustomerId) {
          return yield* new PolarBillingError({
            message: "Pro account is missing its Polar customer; cannot open portal.",
          });
        }
        const url = yield* createPortal(user.polarCustomerId);
        return { destination: "portal" as const, url };
      }

      const email = user?.email || identity.email || "";
      if (!email) {
        return yield* new PolarBillingError({
          message: "An account email is required to start checkout.",
        });
      }
      const name = user?.name ?? identity.name ?? undefined;
      const checkoutConfig = yield* getCheckoutConfig(successUrl);
      const polarCustomerId = yield* ensureCustomer(makeBillingBackend(actions), clerkId, email, name);
      const url = yield* createCheckout(
        polarCustomerId,
        checkoutConfig.productId,
        checkoutConfig.successUrl,
      );
      return { destination: "checkout" as const, url };
    }).pipe(Effect.provide(ServerConfig.layer)),
});

export const generatePortalUrl = effectAuthedAction({
  args: {},
  handler: () =>
    Effect.gen(function* () {
      const { identity } = yield* AuthedContext;
      const clerkId = identity.subject;
      if (!clerkId) {
        return yield* new PolarBillingError({ message: "Missing Clerk identity." });
      }

      const actions = yield* ConvexActions;
      const user = yield* Effect.tryPromise({
        try: () => loadPolarUserInfo(actions, clerkId),
        catch: (e) =>
          new PolarBillingError({ message: `Failed to load user: ${String(e)}` }),
      });

      if (!user || user.plan !== "pro") {
        return yield* new PolarBillingError({
          message: "Customer portal access requires an active Pro subscription.",
        });
      }
      if (!user.polarCustomerId) {
        return yield* new PolarBillingError({
          message: "Pro account is missing its Polar customer; cannot open portal.",
        });
      }

      const url = yield* createPortal(user.polarCustomerId);
      return { destination: "portal" as const, url };
    }).pipe(Effect.provide(ServerConfig.layer)),
});
