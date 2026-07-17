"use node";

// [Phase 2] Polar billing provider — Effect v4 programs over the Polar SDK.
// The Polar SDK client is built from validated ServerConfig (fail-closed) and the
// Convex accessors are injected as a BillingBackend so the network and DB seams stay
// mockable (reference test pattern: vi.mock("@polar-sh/sdk")).

import { Effect, Schema } from "effect";
import { getPolarClient } from "./polarClient";
import type { Polar } from "@polar-sh/sdk";

export class PolarBillingError extends Schema.TaggedErrorClass<PolarBillingError>()(
  "PolarBillingError",
  { message: Schema.String },
) {}

export interface BillingBackend {
  getUserInfoForPolar(clerkId: string): Promise<UserInfo | null>;
  savePolarCustomerId(clerkId: string, polarCustomerId: string): Promise<void>;
}

export interface UserInfo {
  userId: string;
  email: string;
  name: string | null;
  polarCustomerId: string | null;
  plan: "hobby" | "pro";
}

function isNotFound(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    (e as { statusCode: unknown }).statusCode === 404
  );
}

function isConflict(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "statusCode" in e &&
    ((e as { statusCode: unknown }).statusCode === 409 ||
     (e as { statusCode: unknown }).statusCode === 422)
  );
}

function isPolarUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      (u.hostname === "polar.sh" || u.hostname.endsWith(".polar.sh"))
    );
  } catch {
    return false;
  }
}

function isAppReturnUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return u.protocol === "http:" || u.protocol === "https:";
    }
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Idempotently ensure a Polar customer exists for a Clerk user and return its real ID.
 * Order (spec 3.1): stored polarCustomerId -> Polar customer by Clerk externalId ->
 * create only if neither exists. Recovers from external-ID conflict / concurrent create.
 * Never uses placeholder IDs; never saves an ID to a different user. Aborts on empty email.
 */
export function ensureCustomer(
  backend: BillingBackend,
  clerkId: string,
  email: string,
  name?: string,
) {
  return Effect.gen(function* () {
    if (!email) {
      return yield* new PolarBillingError({
        message: "Cannot create a Polar customer without an email address.",
      });
    }
    const info = yield* Effect.tryPromise({
      try: () => backend.getUserInfoForPolar(clerkId),
      catch: (e) =>
        new PolarBillingError({
          message: `Failed to read user for Polar sync: ${String(e)}`,
        }),
    });
    if (info?.polarCustomerId) return info.polarCustomerId;

    const polar = yield* getPolarClient();

    // 1. Reuse an existing Polar customer identified by the Clerk externalId.
    const existingId = yield* lookupByExternalId(polar, clerkId);
    if (existingId) {
      yield* saveId(backend, clerkId, existingId);
      return existingId;
    }

    // 2. None exists — create one, recovering from concurrent/external-ID conflict.
    const createdId = yield* createCustomer(polar, clerkId, email, name, info);
    yield* saveId(backend, clerkId, createdId);
    return createdId;
  });
}

function lookupByExternalId(
  polar: Polar,
  clerkId: string,
): Effect.Effect<string | null, PolarBillingError, never> {
  return Effect.tryPromise({
    try: async () => {
      try {
        const c = await polar.customers.getExternal({ externalId: clerkId });
        return c.id;
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },
    catch: (e) =>
      new PolarBillingError({ message: `Polar customer lookup failed: ${String(e)}` }),
  });
}

function saveId(
  backend: BillingBackend,
  clerkId: string,
  polarCustomerId: string,
) {
  return Effect.tryPromise({
    try: () => backend.savePolarCustomerId(clerkId, polarCustomerId),
    catch: (e) =>
      new PolarBillingError({ message: `Failed to save Polar customer ID: ${String(e)}` }),
  });
}

function createCustomer(
  polar: Polar,
  clerkId: string,
  email: string,
  name?: string,
  info?: UserInfo | null,
): Effect.Effect<string, PolarBillingError, never> {
  return Effect.tryPromise({
    try: async () => {
      try {
        const customer = await polar.customers.create({
          email,
          name: name || undefined,
          externalId: clerkId,
          type: "individual",
          metadata: { clerkId, convexUserId: info?.userId ?? "" },
        });
        return customer.id;
      } catch (e) {
        // Concurrent/race recovery: another caller created the Polar customer
        // with this externalId. Retrieve and reuse the winner (spec 3.1).
        if (isConflict(e)) {
          const existing = await polar.customers.getExternal({ externalId: clerkId });
          return existing.id;
        }
        throw e;
      }
    },
    catch: (e) =>
      new PolarBillingError({ message: `Failed to create Polar customer: ${String(e)}` }),
  });
}

/**
 * Create a Polar checkout for a single product bound to an existing customer.
 * The success URL is server-derived (never concatenated from client origin) and must
 * be HTTPS or localhost. The returned Polar URL is validated as HTTPS Polar-hosted.
 */
export function createCheckout(
  polarCustomerId: string,
  productId: string,
  successUrl: string,
) {
  return Effect.gen(function* () {
    if (!isAppReturnUrl(successUrl)) {
      return yield* new PolarBillingError({ message: "Invalid checkout success URL." });
    }
    const polar = yield* getPolarClient();
    const checkout = yield* Effect.tryPromise({
      try: () =>
        polar.checkouts.create({
          products: [productId],
          customerId: polarCustomerId,
          successUrl,
          metadata: { clerkCustomerId: polarCustomerId },
        }),
      catch: (e) =>
        new PolarBillingError({ message: `Polar checkout failed: ${String(e)}` }),
    });
    if (!checkout.url || !isPolarUrl(checkout.url)) {
      return yield* new PolarBillingError({
        message: "Polar returned an invalid checkout URL.",
      });
    }
    return checkout.url;
  });
}

/**
 * Create a short-lived Polar customer session and return its hosted portal URL.
 * Caller authorizes (plan === "pro" + real customer) before invoking.
 */
export function createPortal(polarCustomerId: string) {
  return Effect.gen(function* () {
    const polar = yield* getPolarClient();
    const session = yield* Effect.tryPromise({
      try: () => polar.customerSessions.create({ customerId: polarCustomerId }),
      catch: (e) =>
        new PolarBillingError({ message: `Polar portal session failed: ${String(e)}` }),
    });
    if (!session.customerPortalUrl || !isPolarUrl(session.customerPortalUrl)) {
      return yield* new PolarBillingError({
        message: "Polar returned an invalid portal URL.",
      });
    }
    return session.customerPortalUrl;
  });
}

/**
 * Asynchronously sync a Clerk profile (email/name) to the existing Polar customer
 * identified by the Clerk externalId. Best-effort: never blocks the Clerk/Convex
 * profile update (spec 3.2). A missing Polar customer is silently ignored.
 */
export function syncCustomerProfile(
  clerkId: string,
  email: string,
  name?: string,
) {
  return Effect.gen(function* () {
    if (!email) return;
    const polar = yield* getPolarClient();
    yield* Effect.tryPromise({
      try: () =>
        polar.customers.updateExternal({
          externalId: clerkId,
          customerUpdateExternalID: {
            email,
            name: name || undefined,
          },
        }),
      catch: (e) =>
        new PolarBillingError({ message: `Polar profile sync failed: ${String(e)}` }),
    }).pipe(
      Effect.catchTag("PolarBillingError", () => Effect.succeed(null)),
    );
  });
}