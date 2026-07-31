import { v, type Infer } from "convex/values";

// [Phase 11] Strict validator for the Clerk user webhook `data` payload
// (user.created / user.updated). Replaces the previous v.any() on
// upsertFromClerk args per the Convex guidelines ("ALWAYS include argument
// validators"). Defense-in-depth on top of the svix signature check in
// convex/http.ts.
//
// Convex v.object rejects unknown keys at the function boundary, while real
// Clerk payloads carry many extra metadata fields (created_at, linked_to,
// verification, object, reserved, ...). So callers MUST reduce the payload to
// exactly the subset declared below via pruneClerkWebhookData() before calling
// upsertFromClerk; the strict validator then rejects anything malformed in that
// subset. Keep pruneClerkWebhookData() in sync with the validator fields.

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Reduce a Clerk user object to exactly the fields declared by
// clerkWebhookDataValidator. Fields the backend reads are preserved (including
// null), everything else is dropped. Non-object / non-array garbage is passed
// through untouched so the validator rejects it instead of silently dropping it.
//
// The return type is asserted because actual validation happens in
// upsertFromClerk's arg validator at the Convex function boundary — this
// function only shapes the payload, it does not validate it.
export function pruneClerkWebhookData(data: unknown): ClerkWebhookData {
	if (!isRecord(data)) {
		// Deliberate shape assertion: the arg validator rejects non-objects.
		return data as ClerkWebhookData;
	}
	const emailAddresses = data.email_addresses;
	return {
		id: data.id,
		first_name: data.first_name,
		last_name: data.last_name,
		image_url: data.image_url,
		primary_email_address_id: data.primary_email_address_id,
		email_addresses: Array.isArray(emailAddresses)
			? emailAddresses.map((entry) =>
					isRecord(entry)
						? { id: entry.id, email_address: entry.email_address }
						: entry,
				)
			: emailAddresses,
	} as ClerkWebhookData;
}

export const clerkEmailAddressValidator = v.object({
	id: v.optional(v.union(v.string(), v.null())),
	email_address: v.string(),
});

export const clerkWebhookDataValidator = v.object({
	id: v.string(),
	first_name: v.optional(v.union(v.string(), v.null())),
	last_name: v.optional(v.union(v.string(), v.null())),
	image_url: v.optional(v.union(v.string(), v.null())),
	primary_email_address_id: v.optional(v.union(v.string(), v.null())),
	email_addresses: v.optional(
		v.union(v.array(clerkEmailAddressValidator), v.null()),
	),
});

export type ClerkWebhookData = Infer<typeof clerkWebhookDataValidator>;
