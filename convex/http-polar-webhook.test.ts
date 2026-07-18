// @vitest-environment node

// [Phase 8] polar-webhook HTTP-route behavior not already covered by
// billing.test.ts. That suite covers signature rejection, unrelated-product
// rejection, active/past_due/canceled/replay. These tests cover the two
// remaining branches of the route handler: the 409 "user not yet
// synchronized" path (resolveClerkId resolves but no Convex user exists), and
// the customer.metadata.clerkId fallback when customer.externalId is absent.
// Seam: the HTTP route at /polar-webhook via convex-test's t.fetch. Polar SDK
// boundary mocked (route itself never reaches Polar here); real svix signs
// payloads so verifyPolarWebhook accepts them.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { Webhook } from "svix";
import { convexTest } from "convex-test";
import schema from "./schema";

// See convex/users.test.ts for the vite/client type workaround.
const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("./**/*.ts");

const polarMock = vi.hoisted(() => ({
	customers: {
		getExternal: vi.fn(),
		create: vi.fn(),
		updateExternal: vi.fn(),
	},
	checkouts: { create: vi.fn() },
	customerSessions: { create: vi.fn() },
}));

vi.mock("@polar-sh/sdk", () => ({
	Polar: vi.fn(function () {
		return {
			customers: polarMock.customers,
			checkouts: polarMock.checkouts,
			customerSessions: polarMock.customerSessions,
		};
	}),
}));

const WH_SECRET = "whsec_test_secret";
const PRODUCT_ID = "prod_31b0";
const CLERK_ID = "clerk_999";
const POLAR_CUSTOMER_ID = "pol_c_999";

beforeEach(() => {
	vi.clearAllMocks();
	polarMock.customers.getExternal.mockRejectedValue({ statusCode: 404 });
	polarMock.customers.create.mockResolvedValue({ id: "pol_new" });
	process.env.POLAR_WEBHOOK_SECRET = WH_SECRET;
	process.env.POLAR_PRODUCT_ID = PRODUCT_ID;
	process.env.POLAR_ACCESS_TOKEN = "test_token";
	process.env.POLAR_SERVER = "sandbox";
	process.env.CONVEX_PRIVATE_BRIDGE_KEY = "test_bridge";
});

function signEvent(payload: unknown, secret = WH_SECRET) {
	const wh = new Webhook(btoa(secret));
	const msgId = `msg_${Math.random().toString(36).slice(2)}`;
	const timestamp = new Date();
	const body = JSON.stringify(payload);
	const signature = wh.sign(msgId, timestamp, body);
	return {
		body,
		headers: {
			"svix-id": msgId,
			"svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
			"svix-signature": signature,
		},
	};
}

// Active subscription event whose customer carries clerkId via the named field
// the route's resolveClerkId inspects. externalId omitted to force the
// customer.metadata.clerkId fallback.
function subEvent(overrides: { customer?: Record<string, unknown>; metadata?: Record<string, unknown> } = {}) {
	return {
		type: "subscription.active",
		timestamp: new Date().toISOString(),
		data: {
			id: "sub_999",
			status: "active",
			product_id: PRODUCT_ID,
			customer_id: POLAR_CUSTOMER_ID,
			customer: overrides.customer ?? {
				id: POLAR_CUSTOMER_ID,
				metadata: { clerkId: CLERK_ID },
			},
			metadata: overrides.metadata ?? { clerkId: CLERK_ID },
		},
	};
}

describe("polar-webhook route (user-resolution branches)", () => {
	test("returns 409 when the clerkId resolves but no Convex user exists", async () => {
		const t = convexTest(schema, modules);
		// No user seeded. clerkId resolves from customer.metadata; the polar
		// customer id also has no Convex match -> 409 retryable, no writes.
		const signed = signEvent(subEvent());
		const res = await t.fetch("/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});
		expect(res.status).toBe(409);

		const anyUser = await t.run(async (ctx) => ctx.db.query("users").take(10));
		expect(anyUser).toHaveLength(0);
	});

	test("falls back to customer.metadata.clerkId when externalId is absent", async () => {
		const t = convexTest(schema, modules);
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				name: "Synced",
				email: "synced@example.com",
				clerkId: CLERK_ID,
				tokenIdentifier: `https://clerk.example.com|${CLERK_ID}`,
				plan: "hobby",
			});
		});

		const signed = signEvent(subEvent());
		const res = await t.fetch("/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});
		expect(res.status).toBe(200);

		const user = await t.run(async (ctx) =>
			ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
				.unique(),
		);
		expect(user?.plan).toBe("pro");
		expect(user?.polarCustomerId).toBe(POLAR_CUSTOMER_ID);
		expect(user?.polarSubscriptionStatus).toBe("active");
	});
});