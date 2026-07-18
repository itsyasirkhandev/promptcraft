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

// Read the raw body + a lowercase header map off the incoming request.
async function readRequest(request: Request): Promise<{
  payload: string;
  headers: Record<string, string>;
}> {
  const payload = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return { payload, headers };
}

// Polar signs with either the svix-* or webhook-* header scheme; accept both.
// Throws the same SvixVerificationError the SDK uses for missing headers.
function requireSvixHeaders(
  headers: Record<string, string>,
): Record<string, string> {
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
  return svixHeaders;
}

// Polar requires the secret base64-encoded (same as SDK validateEvent does).
function verifySignature(
  payload: string,
  svixHeaders: Record<string, string>,
  secret: string,
): unknown {
  const wh = new Webhook(btoa(secret));
  try {
    return wh.verify(payload, svixHeaders);
  } catch {
    throw new SvixVerificationError("Invalid webhook signature");
  }
}

// Narrow the nested customer object out of the raw event data.
function extractCustomer(
  customer: unknown,
): PolarSubscriptionEventData["customer"] {
  if (typeof customer !== "object" || customer === null) return undefined;
  const c = customer as Record<string, unknown>;
  return {
    id: typeof c.id === "string" ? c.id : undefined,
    externalId:
      typeof c.external_id === "string" ? c.external_id : undefined,
    metadata:
      typeof c.metadata === "object" && c.metadata !== null
        ? (c.metadata as Record<string, unknown>)
        : undefined,
  };
}

// Validate + normalize a verified webhook payload into a subscription event.
// Returns null for non-subscription or malformed events (not an error).
function parseSubscriptionEvent(
  parsed: unknown,
): PolarSubscriptionEvent | null {
  if (typeof parsed !== "object" || parsed === null || !("type" in parsed)) {
    return null;
  }
  const event = parsed as Record<string, unknown>;
  if (
    typeof event.type !== "string" ||
    !event.type.startsWith("subscription.")
  ) {
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
  const d = data as Record<string, unknown>;
  return {
    type: event.type,
    timestamp: event.timestamp ? new Date(String(event.timestamp)) : new Date(),
    data: {
      id: d.id as string,
      status: d.status as string,
      productId: d.product_id as string,
      customerId:
        "customer_id" in d && typeof d.customer_id === "string"
          ? (d.customer_id as string)
          : undefined,
      customer: extractCustomer(d.customer),
      metadata:
        typeof d.metadata === "object" && d.metadata !== null
          ? (d.metadata as Record<string, unknown>)
          : undefined,
    },
  };
}

export async function verifyPolarWebhook(
  request: Request,
  secret: string,
): Promise<PolarSubscriptionEvent | null> {
  const { payload, headers } = await readRequest(request);
  const svixHeaders = requireSvixHeaders(headers);
  const parsed = verifySignature(payload, svixHeaders, secret);
  return parseSubscriptionEvent(parsed);
}