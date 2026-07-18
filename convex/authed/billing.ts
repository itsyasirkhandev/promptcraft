"use node";

// [Phase 4] Authed client actions for Polar checkout + customer portal.
// Identity and customer data are derived server-side; checkout product and success URL
// are supplied by the client and validated before Polar receives them.
// The shared return shape is a discriminated { destination: "checkout" | "portal", url: string }
// so the calling client redirects correctly.

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

// [Phase 4] Structural shape yielded from the ConvexActions service.
type ActionAccessors = { runQuery: ActionCtx['runQuery']; runMutation: ActionCtx['runMutation'] };

// [Phase 4] Shape of the private user query result. Ceiling: replace with the
// generated return type if Convex codegen later exposes it on the FunctionReference.
type PolarUserInfo = {
  userId: string;
  email: string;
  name: string;
  polarCustomerId: string | null;
  plan: "hobby" | "pro";
};

// [Phase 4] Same TS7022 circularity Phase 3 hit: generateCheckoutUrl/generatePortalUrl
// are public functions referenced by the generated `api` tree, so an inline
// `internal.*` reference inside the effectAuthedAction handler's inferred R/E
// creates a circular type. Extracting the internal calls into explicitly-typed
// helpers (Promise<...> return types) breaks the cycle. Remove only if Convex
// codegen stops tying `internal` and `api` to the same per-file type.
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

export const generateCheckoutUrl = effectAuthedAction({
  args: { productId: v.string(), successUrl: v.string() },
  handler: ({ productId, successUrl }) =>
    Effect.gen(function* () {
      const { identity } = yield* AuthedContext;
      const clerkId = identity.subject;
      if (!clerkId) {
        return yield* new PolarBillingError({ message: "Missing Clerk identity." });
      }

      const actions = yield* ConvexActions;

      // Load canonical user server-side; never trust any client-supplied identity.
      const user = yield* Effect.tryPromise({
        try: () => loadPolarUserInfo(actions, clerkId),
        catch: (e) =>
          new PolarBillingError({ message: `Failed to load user: ${String(e)}` }),
      });

      // Pro -> portal destination (never create a second checkout/subscription).
      if (user?.plan === "pro") {
        if (!user.polarCustomerId) {
          return yield* new PolarBillingError({
            message: "Pro account is missing its Polar customer; cannot open portal.",
          });
        }
        const url = yield* createPortal(user.polarCustomerId);
        return { destination: "portal" as const, url };
      }

      // Hobby -> ensure a real Polar customer exists, then create checkout.
      const email = user?.email || identity.email || "";
      if (!email) {
        return yield* new PolarBillingError({
          message: "An account email is required to start checkout.",
        });
      }
      const name = user?.name ?? identity.name ?? undefined;

      const polarCustomerId = yield* ensureCustomer(makeBillingBackend(actions), clerkId, email, name);

      const url = yield* createCheckout(polarCustomerId, productId, successUrl);
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

      // Authorize server-side: plan === "pro" + a real stored Polar customer (spec 3.5).
      // Hobby -> safe authorization error, no URL returned.
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