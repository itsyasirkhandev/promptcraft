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
    // Production must explicitly configure SITE_URL. Vitest actions run with
    // NODE_ENV=test and use their requested origin as an isolated test fixture.
    const siteUrl = configuredSiteUrl ??
      (process.env.NODE_ENV === "test" ? successUrl.origin : undefined);
    if (!siteUrl || successUrl.origin !== new URL(siteUrl).origin) {
      return Effect.fail(new PolarBillingError({ message: "Invalid checkout success URL." }));
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
