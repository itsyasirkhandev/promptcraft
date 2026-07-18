import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Webhook } from "svix";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { verifyPolarWebhook } from "./billing/webhooks";
import { mapSubscriptionToPlan } from "./billing/lifecycle";

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

http.route({
  path: "/polar-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("polar-webhook: missing POLAR_WEBHOOK_SECRET");
      return new Response("Webhook not configured", { status: 500 });
    }
    const configuredProductId = process.env.POLAR_PRODUCT_ID;
    if (!configuredProductId) {
      console.error("polar-webhook: missing POLAR_PRODUCT_ID");
      return new Response("Webhook not configured", { status: 500 });
    }

    let event;
    try {
      event = await verifyPolarWebhook(request, webhookSecret);
    } catch {
      console.error("polar-webhook: signature verification failed");
      return new Response("Invalid signature", { status: 400 });
    }

    if (!event) {
      return new Response(null, { status: 200 });
    }

    const type = event.type;
    const data = event.data;

    if (data.productId !== configuredProductId) {
      console.log("polar-webhook: ignored event for unrelated product", type);
      return new Response(null, { status: 200 });
    }

    const plan = mapSubscriptionToPlan(data.status);
    if (!plan) {
      console.log(
        "polar-webhook: status maps to no plan change, preserving existing",
        type,
        data.status,
      );
      return new Response(null, { status: 200 });
    }

    const polarCustomerId = data.customerId ?? data.customer?.id ?? undefined;
    const clerkId = resolveClerkId(data);

    let userResolved = false;
    if (clerkId) {
      const info = await ctx.runQuery(
        internal.private.users.getUserInfoForPolar,
        { clerkId },
      );
      if (info) userResolved = true;
    }
    if (!userResolved && polarCustomerId) {
      const user = await ctx.runQuery(
        internal.private.users.getByPolarCustomerId,
        { polarCustomerId },
      );
      if (user) userResolved = true;
    }

    if (!userResolved) {
      console.warn("polar-webhook: unknown user, returning retryable response", {
        type,
        hasClerkId: Boolean(clerkId),
        hasPolarCustomerId: Boolean(polarCustomerId),
      });
      return new Response("User not yet synchronized", { status: 409 });
    }

    try {
      await ctx.runMutation(internal.users.updateSubscriptionFromPolar, {
        clerkId,
        polarCustomerId,
        polarSubscriptionId: data.id,
        polarSubscriptionStatus: data.status,
        plan,
      });
    } catch (error) {
      console.error("polar-webhook: transient database error", error);
      return new Response("Database error", { status: 500 });
    }

    return new Response(null, { status: 200 });
  }),
});

export default http;


