// @vitest-environment node

// Vandly HTTP Webhook route behavior tests.
// Seam: POST /vandly-webhook HTTP route via convex-test's t.fetch.

import { describe, expect, test, beforeEach } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import crypto from "crypto";
import schema from "./schema";

const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("./**/*.ts");

const WEBHOOK_SECRET = "vandly_secret_123456";
const PRODUCT_ID = 6;
const USER_EMAIL = "yasirwebio@gmail.com";
const SUB_ID = "922d11fa-064a-4c88-9d9a-7335ed4d3541";

type T = TestConvex<typeof schema>;

function computeSignature(rawBody: string, secret = WEBHOOK_SECRET): string {
	return "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

function vandlyPayload(overrides: Record<string, unknown> = {}) {
	return {
		event: "subscription.created",
		data: {
			subscriptionId: SUB_ID,
			productId: PRODUCT_ID,
			productName: "Promptcrafts Pro",
			customerEmail: USER_EMAIL,
			...overrides,
		},
		timestamp: new Date().toISOString(),
	};
}

async function seedUser(t: T) {
	return t.run(async (ctx) => {
		return ctx.db.insert("users", {
			name: "Yasir Khan",
			email: USER_EMAIL,
			tokenIdentifier: `clerk|user_123`,
			clerkId: "user_123",
			plan: "hobby",
		});
	});
}

describe("POST /vandly-webhook route", () => {
	beforeEach(() => {
		process.env.VANDLY_WEBHOOK_SECRET = WEBHOOK_SECRET;
		process.env.VANDLY_PRODUCT_ID = String(PRODUCT_ID);
		delete process.env.BREVO_API_KEY;
	});

	test("returns 500 when VANDLY_WEBHOOK_SECRET is not configured", async () => {
		delete process.env.VANDLY_WEBHOOK_SECRET;
		const t = convexTest(schema, modules);
		const body = JSON.stringify(vandlyPayload());

		const res = await t.fetch("/vandly-webhook", {
			method: "POST",
			headers: { "x-vandly-signature": "sha256=dummy" },
			body,
		});

		expect(res.status).toBe(500);
	});

	test("returns 400 when X-Vandly-Signature is invalid or missing", async () => {
		const t = convexTest(schema, modules);
		const body = JSON.stringify(vandlyPayload());

		const res = await t.fetch("/vandly-webhook", {
			method: "POST",
			headers: { "x-vandly-signature": "sha256=invalid_hex_signature" },
			body,
		});

		expect(res.status).toBe(400);
	});

	test("returns 200 and performs zero writes when productId does not match configured VANDLY_PRODUCT_ID", async () => {
		const t = convexTest(schema, modules);
		await seedUser(t);

		const payload = vandlyPayload({ productId: 999 }); // Unrelated product ID
		const body = JSON.stringify(payload);
		const signature = computeSignature(body);

		const res = await t.fetch("/vandly-webhook", {
			method: "POST",
			headers: { "x-vandly-signature": signature },
			body,
		});

		expect(res.status).toBe(200);

		// Verify user was NOT upgraded
		const user = await t.run(async (ctx) =>
			ctx.db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", USER_EMAIL))
				.unique(),
		);
		expect(user?.plan).toBe("hobby");
	});

	test("returns 200 and upgrades user plan to pro for valid subscription.created event", async () => {
		const t = convexTest(schema, modules);
		await seedUser(t);

		const payload = vandlyPayload();
		const body = JSON.stringify(payload);
		const signature = computeSignature(body);

		const res = await t.fetch("/vandly-webhook", {
			method: "POST",
			headers: { "x-vandly-signature": signature },
			body,
		});

		expect(res.status).toBe(200);

		const user = await t.run(async (ctx) =>
			ctx.db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", USER_EMAIL))
				.unique(),
		);

		expect(user?.plan).toBe("pro");
		expect(user?.vandlySubscriptionId).toBe(SUB_ID);
		expect(user?.vandlySubscriptionStatus).toBe("active");
	});
});
