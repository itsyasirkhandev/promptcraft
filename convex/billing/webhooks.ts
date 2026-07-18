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
  const data = event.data as PolarSubscriptionEventData | undefined;
  if (!data || typeof data.id !== "string" || typeof data.status !== "string") {
    return null;
  }
  return {
    type: event.type,
    timestamp: event.timestamp ? new Date(String(event.timestamp)) : new Date(),
    data,
  };
}
