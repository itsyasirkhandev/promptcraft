import { Webhook, WebhookVerificationError as SvixVerificationError } from "svix";

export interface PolarSubscriptionEventData {
  id: string;
  status: string;
  productId: string;
  customerId?: string;
  customer?: {
    id?: string;
    externalId?: string;
    metadata?: Record<string, unknown>;
  };
  metadata?: Record<string, unknown>;
}

export interface PolarSubscriptionEvent {
  eventId: string;
  type: string;
  timestamp: Date;
  data: PolarSubscriptionEventData;
}

async function readRequest(request: Request): Promise<{ payload: string; headers: Record<string, string> }> {
  const payload = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => { headers[key] = value; });
  return { payload, headers };
}

function requireSvixHeaders(headers: Record<string, string>) {
  const eventId = headers["svix-id"] || headers["webhook-id"] || "";
  const svixHeaders: Record<string, string> = {
    "svix-id": eventId,
    "svix-timestamp": headers["svix-timestamp"] || headers["webhook-timestamp"] || "",
    "svix-signature": headers["svix-signature"] || headers["webhook-signature"] || "",
  };
  if (!eventId || !svixHeaders["svix-timestamp"] || !svixHeaders["svix-signature"]) {
    throw new SvixVerificationError("Missing webhook headers");
  }
  return { eventId, svixHeaders };
}

function verifySignature(payload: string, headers: Record<string, string>, secret: string): unknown {
  try {
    return new Webhook(btoa(secret)).verify(payload, headers);
  } catch {
    throw new SvixVerificationError("Invalid webhook signature");
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? record[key] as string : undefined;
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  return asRecord(record[key]) ?? undefined;
}

function extractCustomer(value: unknown): PolarSubscriptionEventData["customer"] {
  const customer = asRecord(value);
  if (!customer) return undefined;
  return {
    id: readString(customer, "id"),
    externalId: readString(customer, "external_id"),
    metadata: readRecord(customer, "metadata"),
  };
}

function parseSubscriptionEvent(parsed: unknown, eventId: string): PolarSubscriptionEvent | null {
  const event = asRecord(parsed);
  if (!event) return null;
  const type = readString(event, "type");
  if (!type || !type.startsWith("subscription.")) return null;

  const data = asRecord(event.data);
  if (!data) return null;
  const id = readString(data, "id");
  const status = readString(data, "status");
  const productId = readString(data, "product_id");
  if (!id || !status || !productId) return null;

  const timestampValue = readString(event, "timestamp");
  if (!timestampValue) throw new SvixVerificationError("Missing webhook timestamp");
  const timestamp = new Date(timestampValue);
  if (!Number.isFinite(timestamp.getTime())) {
    throw new SvixVerificationError("Invalid webhook timestamp");
  }

  return {
    eventId,
    type,
    timestamp,
    data: {
      id,
      status,
      productId,
      customerId: readString(data, "customer_id"),
      customer: extractCustomer(data.customer),
      metadata: readRecord(data, "metadata"),
    },
  };
}

export async function verifyPolarWebhook(request: Request, secret: string): Promise<PolarSubscriptionEvent | null> {
  const { payload, headers } = await readRequest(request);
  const { eventId, svixHeaders } = requireSvixHeaders(headers);
  return parseSubscriptionEvent(verifySignature(payload, svixHeaders, secret), eventId);
}
