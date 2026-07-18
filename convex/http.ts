import { httpRouter } from "convex/server";
import { httpAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { verifyPolarWebhook, type PolarSubscriptionEvent } from "./billing/webhooks";
import { mapSubscriptionToPlan, type Plan } from "./billing/lifecycle";

const http = httpRouter();

http.route({
  path: "/clerk-users-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const payloadString = await request.text();
    const svixHeaders = {
      "svix-id": request.headers.get("svix-id")!,
      "svix-timestamp": request.headers.get("svix-timestamp")!,
      "svix-signature": request.headers.get("svix-signature")!,
    };

    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
      return new Response("Missing webhook secret", { status: 500 });
    }

    const wh = new Webhook(webhookSecret);
    let event: WebhookEvent | null = null;
    try {
      event = wh.verify(payloadString, svixHeaders) as WebhookEvent;
    } catch (error) {
      console.error("Error verifying webhook event", error);
      return new Response("Error occurred", { status: 400 });
    }

    if (!event || !event.type || !event.data) {
      return new Response("Invalid webhook payload", { status: 400 });
    }

    switch (event.type) {
      case "user.created":
      case "user.updated":
        await ctx.runMutation(internal.users.upsertFromClerk, {
          data: event.data,
        });
        break;

      case "user.deleted": {
        const clerkUserId = event.data.id;
        if (clerkUserId) {
          await ctx.runMutation(internal.users.deleteFromClerk, { clerkUserId });
        }
        break;
      }

      default:
        console.log("Ignored Clerk webhook event", event.type);
    }

    return new Response(null, { status: 200 });
  }),
});

function resolveClerkId(data: {
  customer?: { externalId?: string | null; metadata?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
}): string | undefined {
  const fromCustomerExternal = data.customer?.externalId ?? undefined;
  if (fromCustomerExternal) return fromCustomerExternal;
  const customerMetaClerkId = data.customer?.metadata?.clerkId;
  if (typeof customerMetaClerkId === "string") return customerMetaClerkId;
  const dataMetaClerkId = data.metadata?.clerkId;
  if (typeof dataMetaClerkId === "string") return dataMetaClerkId;
  return undefined;
}

// Polar webhook config: both env vars are required. Logs the specific missing
// var and returns null so the route handler can emit a single 500.
function getPolarConfig(): {
  webhookSecret: string;
  productId: string;
} | null {
  const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("polar-webhook: missing POLAR_WEBHOOK_SECRET");
    return null;
  }
  const productId = process.env.POLAR_PRODUCT_ID;
  if (!productId) {
    console.error("polar-webhook: missing POLAR_PRODUCT_ID");
    return null;
  }
  return { webhookSecret, productId };
}

// Verify + read the Polar event. Returns the verified event (which may be null
// for a non-subscription event) or a 400 response on signature failure.
async function readPolarEvent(
  request: Request,
  secret: string,
): Promise<
  | { ok: true; event: PolarSubscriptionEvent | null }
  | { ok: false; response: Response }
> {
  try {
    const event = await verifyPolarWebhook(request, secret);
    return { ok: true, event };
  } catch {
    console.error("polar-webhook: signature verification failed");
    return { ok: false, response: new Response("Invalid signature", { status: 400 }) };
  }
}

// Filter to subscription events for the configured product with a mappable
// plan. Returns the resolved identifiers, or null to ignore the event (200).
function filterRelevantSubscription(
  event: PolarSubscriptionEvent,
  configuredProductId: string,
):
  | { plan: Plan; polarCustomerId: string | undefined; clerkId: string | undefined }
  | null {
  const data = event.data;
  if (data.productId !== configuredProductId) {
    console.log("polar-webhook: ignored event for unrelated product", event.type, {
      receivedProductId: data.productId,
      configuredProductId,
    });
    return null;
  }
  const plan = mapSubscriptionToPlan(data.status);
  if (!plan) {
    console.log(
      "polar-webhook: status maps to no plan change, preserving existing",
      event.type,
      data.status,
    );
    return null;
  }
  return {
    plan,
    polarCustomerId: data.customerId ?? data.customer?.id ?? undefined,
    clerkId: resolveClerkId(data),
  };
}

// Resolve whether a Convex user exists for either identifier (clerkId first,
// then polarCustomerId). Polar webhook may arrive before Clerk sync lands.
async function resolvePolarUser(
  ctx: ActionCtx,
  clerkId: string | undefined,
  polarCustomerId: string | undefined,
): Promise<boolean> {
  if (clerkId) {
    const info = await ctx.runQuery(
      internal.private.users.getUserInfoForPolar,
      { clerkId },
    );
    if (info) return true;
  }
  if (polarCustomerId) {
    const user = await ctx.runQuery(
      internal.private.users.getByPolarCustomerId,
      { polarCustomerId },
    );
    if (user) return true;
  }
  return false;
}

http.route({
  path: "/polar-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const cfg = getPolarConfig();
    if (!cfg) return new Response("Webhook not configured", { status: 500 });

    const ev = await readPolarEvent(request, cfg.webhookSecret);
    if (!ev.ok) return ev.response;
    if (!ev.event) return new Response(null, { status: 200 });

    const sub = filterRelevantSubscription(ev.event, cfg.productId);
    if (!sub) return new Response(null, { status: 200 });

    const userResolved = await resolvePolarUser(ctx, sub.clerkId, sub.polarCustomerId);
    if (!userResolved) {
      console.warn("polar-webhook: unknown user, returning retryable response", {
        type: ev.event.type,
        hasClerkId: Boolean(sub.clerkId),
        hasPolarCustomerId: Boolean(sub.polarCustomerId),
      });
      return new Response("User not yet synchronized", { status: 409 });
    }

    try {
      await ctx.runMutation(internal.users.updateSubscriptionFromPolar, {
        clerkId: sub.clerkId,
        polarCustomerId: sub.polarCustomerId,
        polarSubscriptionId: ev.event.data.id,
        polarSubscriptionStatus: ev.event.data.status,
        plan: sub.plan,
      });
    } catch (error) {
      console.error("polar-webhook: transient database error", error);
      return new Response("Database error", { status: 500 });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;
