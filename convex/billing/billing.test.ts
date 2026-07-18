// @vitest-environment node

// [Phase 8] Consolidated billing + webhook tests. Mocks the Polar network
// boundary (@polar-sh/sdk); never hits real Polar. Uses real svix for webhook
// signature tests. Covers (spec §10): lifecycle-to-plan mapping, past-due
// retention, terminal downgrade, signature rejection, product rejection,
// webhook replay, customer reuse/fallback, Hobby checkout, Pro-to-portal
// routing, and portal authorization.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { Effect } from "effect";
import { Webhook } from "svix";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";
import { mapSubscriptionToPlan } from "./lifecycle";
import { verifyPolarWebhook } from "./webhooks";
import {
	ensureCustomer,
	createCheckout,
	createPortal,
	type BillingBackend,
} from "./provider";
import { ServerConfig } from "../services/ServerConfig";

// convex-test loads Convex function modules from the repo's convex/ root.
// convex-test needs import.meta.glob; vite/client types are not resolvable here
// (vite is non-hoisted under pnpm), so type the accessor locally instead of a
// /// reference types="vite/client" directive (Convex AI guidelines: do not reference
// uninstalled type packages).
const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("../**/*.ts");

// --- Polar SDK network-boundary mock ---------------------------------------
// Every `new Polar(...)` returns an instance whose sub-clients are the shared
// vi.fn objects below, so tests configure behaviour without touching the
// network. vi.hoisted keeps the object reference stable across the hoisted
// vi.mock factory.
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

// --- shared constants / helpers --------------------------------------------
const WH_SECRET = "whsec_test_secret";
const PRODUCT_ID = "prod_31b0";
const CLERK_ID = "clerk_123";
const SUCCESS_URL = "https://app.example.com/success";

const testConfig: {
	convexPrivateBridgeKey: string;
	polarAccessToken: string | null;
	polarWebhookSecret: string | null;
	polarProductId: string | null;
	polarServer: "sandbox" | "production" | null;
	polarCheckoutSuccessUrl: string | null;
} = {
	convexPrivateBridgeKey: "test_bridge",
	polarAccessToken: "test_token",
	polarWebhookSecret: WH_SECRET,
	polarProductId: PRODUCT_ID,
	polarServer: "sandbox",
	polarCheckoutSuccessUrl: SUCCESS_URL,
};

// Run a provider Effect against a fixed ServerConfig (no env reads).
function run<R, E>(eff: Effect.Effect<R, E, ServerConfig>) {
	return Effect.runPromise(eff.pipe(Effect.provideService(ServerConfig, testConfig)));
}

beforeEach(() => {
	vi.clearAllMocks();
	// Convex deployment env read by http.ts (webhook) and ServerConfig.layer (actions).
	process.env.POLAR_WEBHOOK_SECRET = WH_SECRET;
	process.env.POLAR_PRODUCT_ID = PRODUCT_ID;
	process.env.POLAR_ACCESS_TOKEN = "test_token";
	process.env.POLAR_SERVER = "sandbox";
	process.env.POLAR_CHECKOUT_SUCCESS_URL = SUCCESS_URL;
	process.env.CONVEX_PRIVATE_BRIDGE_KEY = "test_bridge";
	// SDK defaults: "not found" customer lookups so ensureCustomer proceeds to
	// create only when a test opts in.
	polarMock.customers.getExternal.mockRejectedValue({ statusCode: 404 });
});

// --- svix payload signing (mirrors verifyPolarWebhook: btoa(secret)) --------
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

function subEvent(
	type: string,
	status: string,
	overrides: { productId?: string; externalId?: string } = {},
) {
	const externalId = overrides.externalId ?? CLERK_ID;
	return {
		type,
		timestamp: new Date().toISOString(),
		data: {
			id: "sub_abc",
			status,
			productId: overrides.productId ?? PRODUCT_ID,
			customerId: "pol_c_1",
			customer: { id: "pol_c_1", externalId, metadata: { clerkId: externalId } },
			metadata: { clerkId: externalId },
		},
	};
}

// Fresh isolated test backend with a seeded Convex user.
async function seedUser(overrides: { plan?: "hobby" | "pro"; polarCustomerId?: string } = {}) {
	const t = convexTest(schema, modules);
	await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			name: "Test User",
			email: "u@test.com",
			tokenIdentifier: "tok_123",
			clerkId: CLERK_ID,
			plan: overrides.plan ?? "hobby",
			polarCustomerId: overrides.polarCustomerId,
		});
	});
	return t;
}

async function readUser(t: Awaited<ReturnType<typeof seedUser>>) {
	return t.run(async (ctx) => {
		return ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
			.unique();
	});
}
// ===========================================================================
describe("mapSubscriptionToPlan", () => {
	test("active -> pro (includes scheduled-to-cancel & uncanceled)", () => {
		// spec 3.6: uncanceled/reactivated resolves to status "active".
		expect(mapSubscriptionToPlan("active")).toBe("pro");
	});

	test("past_due -> pro (retain during Polar retry window)", () => {
		expect(mapSubscriptionToPlan("past_due")).toBe("pro");
	});

	test("canceled -> hobby (terminal downgrade)", () => {
		expect(mapSubscriptionToPlan("canceled")).toBe("hobby");
	});

	test("unpaid -> hobby (terminal downgrade)", () => {
		expect(mapSubscriptionToPlan("unpaid")).toBe("hobby");
	});

	test("revoked -> hobby (terminal downgrade)", () => {
		expect(mapSubscriptionToPlan("revoked")).toBe("hobby");
	});

	test("unknown status -> null (caller preserves existing plan)", () => {
		expect(mapSubscriptionToPlan("incomplete")).toBeNull();
		expect(mapSubscriptionToPlan("trialing")).toBeNull();
	});
});

// ===========================================================================
// 2. Webhook signature verification (real svix)
// ===========================================================================
describe("verifyPolarWebhook", () => {
	test("verifies a correctly signed subscription event", async () => {
		const event = subEvent("subscription.active", "active");
		const signed = signEvent(event);
		const request = new Request("https://convex.test/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});
		const result = await verifyPolarWebhook(request, WH_SECRET);
		expect(result).not.toBeNull();
		expect(result?.type).toBe("subscription.active");
		expect(result?.data.status).toBe("active");
		expect(result?.data.productId).toBe(PRODUCT_ID);
	});

	test("rejects a tampered payload", async () => {
		const event = subEvent("subscription.active", "active");
		const signed = signEvent(event);
		const tampered = signed.body.replace('"active"', '"inactive"');
		const request = new Request("https://convex.test/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: tampered,
		});
		await expect(verifyPolarWebhook(request, WH_SECRET)).rejects.toThrow();
	});

	test("rejects when signature headers are missing", async () => {
		const request = new Request("https://convex.test/polar-webhook", {
			method: "POST",
			body: JSON.stringify(subEvent("subscription.active", "active")),
		});
		await expect(verifyPolarWebhook(request, WH_SECRET)).rejects.toThrow();
	});
});

// ===========================================================================
// 3. Webhook HTTP route (product rejection, replay, downgrade, retention)
// ===========================================================================
describe("polar-webhook route", () => {
	test("rejects an invalid signature with 400 and no writes", async () => {
		const t = await seedUser();
		const res = await t.fetch("/polar-webhook", {
			method: "POST",
			headers: {
				"svix-id": "bad",
				"svix-timestamp": "1",
				"svix-signature": "invalid",
			},
			body: JSON.stringify(subEvent("subscription.active", "active")),
		});
		expect(res.status).toBe(400);
		expect((await readUser(t))?.plan).toBe("hobby");
	});

	test("ignores events for an unrelated product (2xx, no plan change)", async () => {
		const t = await seedUser();
		const signed = signEvent(subEvent("subscription.active", "active", { productId: "other_product" }));
		const res = await t.fetch("/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});
		expect(res.status).toBe(200);
		expect((await readUser(t))?.plan).toBe("hobby");
	});

	test("active subscription grants pro and persists identifiers", async () => {
		const t = await seedUser();
		const signed = signEvent(subEvent("subscription.active", "active"));
		const res = await t.fetch("/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});
		expect(res.status).toBe(200);
		const user = await readUser(t);
		expect(user?.plan).toBe("pro");
		expect(user?.polarSubscriptionStatus).toBe("active");
		expect(user?.polarCustomerId).toBe("pol_c_1");
	});

	test("past_due retains pro", async () => {
		const t = await seedUser({ plan: "pro" });
		const signed = signEvent(subEvent("subscription.past_due", "past_due"));
		const res = await t.fetch("/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});
		expect(res.status).toBe(200);
		expect((await readUser(t))?.plan).toBe("pro");
	});

	test("canceled downgrades to hobby immediately", async () => {
		const t = await seedUser({ plan: "pro" });
		const signed = signEvent(subEvent("subscription.canceled", "canceled"));
		const res = await t.fetch("/polar-webhook", {
			method: "POST",
			headers: signed.headers,
			body: signed.body,
		});
		expect(res.status).toBe(200);
		expect((await readUser(t))?.plan).toBe("hobby");
	});

	test("replayed event is idempotent", async () => {
		const t = await seedUser();
		const signed = signEvent(subEvent("subscription.active", "active"));
		const init = { method: "POST", headers: signed.headers, body: signed.body } as const;
		const r1 = await t.fetch("/polar-webhook", init);
		const r2 = await t.fetch("/polar-webhook", init);
		expect(r1.status).toBe(200);
		expect(r2.status).toBe(200);
		const user = await readUser(t);
		expect(user?.plan).toBe("pro");
		expect(user?.polarSubscriptionId).toBe("sub_abc");
		expect(user?.polarSubscriptionStatus).toBe("active");
	});
});

// ===========================================================================
// 4. Provider: customer reuse / fallback / conflict (no real Polar)
// ===========================================================================
describe("ensureCustomer", () => {
	test("reuses the stored polarCustomerId without any SDK call", async () => {
		const backend: BillingBackend = {
			getUserInfoForPolar: vi.fn().mockResolvedValue({
				userId: "u1",
				email: "u@test.com",
				name: "Test",
				polarCustomerId: "pol_existing",
				plan: "hobby" as const,
			}),
			savePolarCustomerId: vi.fn().mockResolvedValue(undefined),
		};
		const id = await run(ensureCustomer(backend, CLERK_ID, "u@test.com", "Test"));
		expect(id).toBe("pol_existing");
		expect(backend.savePolarCustomerId).not.toHaveBeenCalled();
		expect(polarMock.customers.getExternal).not.toHaveBeenCalled();
		expect(polarMock.customers.create).not.toHaveBeenCalled();
	});

	test("falls back to an existing Polar customer found by externalId", async () => {
		const backend: BillingBackend = {
			getUserInfoForPolar: vi.fn().mockResolvedValue({
				userId: "u1",
				email: "u@test.com",
				name: "Test",
				polarCustomerId: null,
				plan: "hobby" as const,
			}),
			savePolarCustomerId: vi.fn().mockResolvedValue(undefined),
		};
		polarMock.customers.getExternal.mockResolvedValueOnce({ id: "pol_found" });
		const id = await run(ensureCustomer(backend, CLERK_ID, "u@test.com", "Test"));
		expect(id).toBe("pol_found");
		expect(polarMock.customers.create).not.toHaveBeenCalled();
		expect(backend.savePolarCustomerId).toHaveBeenCalledWith(CLERK_ID, "pol_found");
	});

	test("creates a customer when none exists", async () => {
		const backend: BillingBackend = {
			getUserInfoForPolar: vi.fn().mockResolvedValue({
				userId: "u1",
				email: "u@test.com",
				name: "Test",
				polarCustomerId: null,
				plan: "hobby" as const,
			}),
			savePolarCustomerId: vi.fn().mockResolvedValue(undefined),
		};
		polarMock.customers.create.mockResolvedValueOnce({ id: "pol_new" });
		const id = await run(ensureCustomer(backend, CLERK_ID, "u@test.com", "Test"));
		expect(id).toBe("pol_new");
		expect(backend.savePolarCustomerId).toHaveBeenCalledWith(CLERK_ID, "pol_new");
	});

	test("recovers from an external-ID conflict by reusing the winner", async () => {
		const backend: BillingBackend = {
			getUserInfoForPolar: vi.fn().mockResolvedValue({
				userId: "u1",
				email: "u@test.com",
				name: "Test",
				polarCustomerId: null,
				plan: "hobby" as const,
			}),
			savePolarCustomerId: vi.fn().mockResolvedValue(undefined),
		};
		// 1st getExternal: not found (default). 2nd: the conflict winner.
		polarMock.customers.getExternal
			.mockRejectedValueOnce({ statusCode: 404 })
			.mockResolvedValueOnce({ id: "pol_winner" });
		polarMock.customers.create.mockRejectedValueOnce({ statusCode: 409 });
		const id = await run(ensureCustomer(backend, CLERK_ID, "u@test.com", "Test"));
		expect(id).toBe("pol_winner");
		expect(backend.savePolarCustomerId).toHaveBeenCalledWith(CLERK_ID, "pol_winner");
	});

	test("aborts on empty email without creating a customer", async () => {
		const backend: BillingBackend = {
			getUserInfoForPolar: vi.fn(),
			savePolarCustomerId: vi.fn().mockResolvedValue(undefined),
		};
		await expect(run(ensureCustomer(backend, CLERK_ID, "", "Test"))).rejects.toThrow();
		expect(polarMock.customers.create).not.toHaveBeenCalled();
	});
});

// ===========================================================================
// 5. Provider: checkout + portal URL validation
// ===========================================================================
describe("createCheckout", () => {
	test("returns the validated Polar checkout URL", async () => {
		polarMock.checkouts.create.mockResolvedValueOnce({ url: "https://checkout.polar.sh/abc" });
		const url = await run(createCheckout("pol_1", PRODUCT_ID, SUCCESS_URL));
		expect(url).toBe("https://checkout.polar.sh/abc");
	});

	test("rejects a non-https app success URL", async () => {
		await expect(
			run(createCheckout("pol_1", PRODUCT_ID, "http://evil.example.com/success")),
		).rejects.toThrow();
		expect(polarMock.checkouts.create).not.toHaveBeenCalled();
	});

	test("rejects a non-Polar return URL", async () => {
		polarMock.checkouts.create.mockResolvedValueOnce({ url: "https://evil.example.com/c" });
		await expect(run(createCheckout("pol_1", PRODUCT_ID, SUCCESS_URL))).rejects.toThrow();
	});
});

describe("createPortal", () => {
	test("returns the validated Polar portal URL", async () => {
		polarMock.customerSessions.create.mockResolvedValueOnce({ customerPortalUrl: "https://polar.sh/portal" });
		const url = await run(createPortal("pol_1"));
		expect(url).toBe("https://polar.sh/portal");
	});

	test("rejects a non-Polar portal URL", async () => {
		polarMock.customerSessions.create.mockResolvedValueOnce({ customerPortalUrl: "https://evil.example.com/p" });
		await expect(run(createPortal("pol_1"))).rejects.toThrow();
	});
});

// ===========================================================================
// 6. Authed actions: checkout/portal routing + portal authorization
// ===========================================================================
describe("authed billing actions", () => {
	async function authedBackend(plan: "hobby" | "pro", polarCustomerId?: string) {
		const t = convexTest(schema, modules).withIdentity({
			subject: CLERK_ID,
			email: "u@test.com",
			tokenIdentifier: "tok_123",
			name: "Test User",
		});
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				name: "Test User",
				email: "u@test.com",
				tokenIdentifier: "tok_123",
				clerkId: CLERK_ID,
				plan,
				polarCustomerId,
			});
		});
		return t;
	}

	test("Hobby routes to the checkout destination", async () => {
		const t = await authedBackend("hobby");
		// No stored customer, no Polar externalId match -> create one, then checkout.
		polarMock.customers.create.mockResolvedValueOnce({ id: "pol_new" });
		polarMock.checkouts.create.mockResolvedValueOnce({ url: "https://checkout.polar.sh/x" });

		const result = await t.action(api.authed.billing.generateCheckoutUrl);
		expect(result.destination).toBe("checkout");
		expect(result.url).toBe("https://checkout.polar.sh/x");
	});

	test("Pro routes to the portal destination (no second checkout)", async () => {
		const t = await authedBackend("pro", "pol_pro");
		polarMock.customerSessions.create.mockResolvedValueOnce({ customerPortalUrl: "https://polar.sh/portal" });

		const result = await t.action(api.authed.billing.generateCheckoutUrl);
		expect(result.destination).toBe("portal");
		expect(result.url).toBe("https://polar.sh/portal");
		expect(polarMock.checkouts.create).not.toHaveBeenCalled();
	});

	test("Hobby calling the portal action is rejected (authorization)", async () => {
		const t = await authedBackend("hobby");
		await expect(t.action(api.authed.billing.generatePortalUrl)).rejects.toThrow();
		expect(polarMock.customerSessions.create).not.toHaveBeenCalled();
	});
});
