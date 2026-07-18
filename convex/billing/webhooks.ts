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
  const c = asRecord(customer);
  if (!c) return undefined;
  return {
    id: readString(c, "id"),
    externalId: readString(c, "external_id"),
    metadata: readRecord(c, "metadata"),
  };
}

// Narrow an unknown value to a plain string-keyed record, or null.
function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null
    ? (v as Record<string, unknown>)
    : null;
}

// Read a string-valued field, or undefined if absent / non-string.
function readString(
  rec: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = rec[key];
  return typeof v === "string" ? v : undefined;
}

// Read a nested record-valued field, or undefined if absent / non-object.
function readRecord(
  rec: Record<string, unknown>,
  key: string,
): Record<string, unknown> | undefined {
  const v = rec[key];
  return typeof v === "object" && v !== null
    ? (v as Record<string, unknown>)
    : undefined;
}

// Validate the subscription payload's required string fields. Returns the
// narrowed record, or null if the event is malformed (not an error).
function parseSubscriptionData(data: unknown): Record<string, unknown> | null {
  const rec = asRecord(data);
  if (!rec) return null;
  if (typeof rec.id !== "string") return null;
  if (typeof rec.status !== "string") return null;
  if (typeof rec.product_id !== "string") return null;
  return rec;
}

// Validate + normalize a verified webhook payload into a subscription event.
// Returns null for non-subscription or malformed events (not an error).
function parseSubscriptionEvent(
  parsed: unknown,
): PolarSubscriptionEvent | null {
  const event = asRecord(parsed);
  if (!event) return null;
  const type = readString(event, "type");
  if (!type || !type.startsWith("subscription.")) return null;
  const d = parseSubscriptionData(event.data);
  if (!d) return null;
  const timestamp = event.timestamp ? new Date(String(event.timestamp)) : new Date();
  return {
    type,
    timestamp,
    data: {
      id: d.id as string,
      status: d.status as string,
      productId: d.product_id as string,
      customerId: readString(d, "customer_id"),
      customer: extractCustomer(d.customer),
      metadata: readRecord(d, "metadata"),
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
