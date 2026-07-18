// [Phase 5] Polar webhook verification using svix (same standard-webhook
// scheme the Polar SDK uses; btoa base64-encodes the secret per spec).
// Convex rejects "use node" on convex/http.ts; the reference promptamist
// uses svix directly for the same reason.
import { Webhook, WebhookVerificationError as SvixVerificationError } from "svix";

export interface PolarSubscriptionEventData {
  id: string;
  status: string;
  productId: string | null;
  customerId?: string | null;
  customer?: {
    id?: string;
    externalId?: string | null;
    metadata?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface PolarSubscriptionEvent {
  type: string;
  timestamp: Date;
  data: PolarSubscriptionEventData;
}

export async function verifyPolarWebhook(
  request: Request,
  secret: string,
): Promise<PolarSubscriptionEvent | null> {
  const payloadString = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const svixHeaders: Record<string, string> = {
    "svix-id": headers["svix-id"] || headers["webhook-id"] || "",
    "svix-timestamp":
      headers["svix-timestamp"] || headers["webhook-timestamp"] || "",
    "svix-signature":
      headers["svix-signature"] || headers["webhook-signature"] || "",
  };

  if (
    !svixHeaders["svix-id"] ||
    !svixHeaders["svix-timestamp"] ||
    !svixHeaders["svix-signature"]
  ) {
    throw new SvixVerificationError("Missing webhook headers");
  }

  // Polar requires the secret base64-encoded (same as SDK validateEvent does).
  const wh = new Webhook(btoa(secret));
  let parsed: unknown;
  try {
    parsed = wh.verify(payloadString, svixHeaders);
  } catch {
    throw new SvixVerificationError("Invalid webhook signature");
  }

  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    return null;
  }
  const event = parsed as Record<string, unknown>;
  if (typeof event.type !== "string" || !event.type.startsWith("subscription.")) {
    return null;
  }
  const data = event.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("id" in data) ||
    typeof data.id !== "string" ||
    !("status" in data) ||
    typeof data.status !== "string" ||
    !("product_id" in data) ||
    typeof data.product_id !== "string"
  ) {
    return null;
  }
  const customer =
    "customer" in data && typeof data.customer === "object" && data.customer !== null
      ? data.customer
      : undefined;
  return {
    type: event.type,
    timestamp: event.timestamp ? new Date(String(event.timestamp)) : new Date(),
    data: {
      id: data.id,
      status: data.status,
      productId: data.product_id,
      customerId:
        "customer_id" in data && typeof data.customer_id === "string"
          ? data.customer_id
          : undefined,
      customer: customer
        ? {
            id: "id" in customer && typeof customer.id === "string" ? customer.id : undefined,
            externalId:
              "external_id" in customer && typeof customer.external_id === "string"
                ? customer.external_id
                : undefined,
            metadata:
              "metadata" in customer &&
              typeof customer.metadata === "object" &&
              customer.metadata !== null
                ? (customer.metadata as Record<string, unknown>)
                : undefined,
          }
        : undefined,
      metadata:
        "metadata" in data && typeof data.metadata === "object" && data.metadata !== null
          ? (data.metadata as Record<string, unknown>)
          : undefined,
    },
  };
}
