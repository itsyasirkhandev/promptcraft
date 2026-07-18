// @vitest-environment node

// [Phase 8] upsertFromClerk behavior tests (spec 3.1, 3.2).
// Seam: the internal mutation internal.users.upsertFromClerk, exercised via
// convex-test's t.mutation. The Polar SDK is the only external boundary and is
// mocked; the Convex scheduler is flushed so the idempotent ensurePolarCustomer
// side-effect settles before assertions. Expected values are independent
// literals, never recomputed the way the handler computes them.

import { describe, expect, test, vi, beforeEach } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";

// convex-test loads Convex function modules from the repo's convex/ root.
// vite/client types are not resolvable here (vite is non-hoisted under pnpm),
// so type the accessor locally instead of a /// reference types directive.
const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("./**/*.ts");

// --- Polar SDK network-boundary mock ---------------------------------------
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

const CLERK_ID = "clerk_123";
const ISSUER = "https://clerk.example.com";

function clerkPayload(overrides: Record<string, unknown> = {}) {
	return {
		id: CLERK_ID,
		first_name: "Ada",
		last_name: "Lovelace",
		email_addresses: [{ email_address: "ada@example.com" }],
		image_url: "https://img.example.com/ada.png",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	// SDK defaults: "not found" external lookup so ensureCustomer proceeds to
	// create. create resolves to a fixed id so savePolarCustomerId can persist it.
	polarMock.customers.getExternal.mockRejectedValue({ statusCode: 404 });
	polarMock.customers.create.mockResolvedValue({ id: "pol_new" });
	process.env.CLERK_JWT_ISSUER_DOMAIN = ISSUER;
	process.env.POLAR_ACCESS_TOKEN = "test_token";
	process.env.POLAR_SERVER = "sandbox";
	process.env.POLAR_WEBHOOK_SECRET = "whsec_test";
	process.env.CONVEX_PRIVATE_BRIDGE_KEY = "test_bridge";
	// Welcome email skips itself when BREVO_API_KEY is unset (no fetch boundary).
	delete process.env.BREVO_API_KEY;
});

type T = TestConvex<typeof schema>;

// Let runAfter(0) scheduled functions (Polar sync, welcome email) settle so
// their side-effects land before assertions and don't leak into the next test.
async function flush(t: T) {
	for (let i = 0; i < 5; i++) {
		await new Promise((r) => setTimeout(r, 1));
		await t.finishInProgressScheduledFunctions();
	}
}

async function readUserByClerkId(t: T) {
	return t.run(async (ctx) => {
		return ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
			.unique();
	});
}

async function countUsers(t: T) {
	return t.run(async (ctx) => {
		return ctx.db.query("users").take(100);
	});
}

describe("upsertFromClerk", () => {
	test("creates a new user from a Clerk user.created payload", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.users.upsertFromClerk, {
			data: clerkPayload(),
		});
		await flush(t);

		const user = await readUserByClerkId(t);
		expect(user).not.toBeNull();
		expect(user?.name).toBe("Ada Lovelace");
		expect(user?.email).toBe("ada@example.com");
		expect(user?.avatarUrl).toBe("https://img.example.com/ada.png");
		expect(user?.clerkId).toBe(CLERK_ID);
		expect(user?.plan).toBe("hobby");
		expect(user?.tokenIdentifier).toBe(`${ISSUER}|${CLERK_ID}`);
	});

	test("patches changed profile fields on an existing user without duplicating", async () => {
		const t = convexTest(schema, modules);
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				name: "Old Name",
				email: "old@example.com",
				clerkId: CLERK_ID,
				tokenIdentifier: `${ISSUER}|${CLERK_ID}`,
				plan: "hobby",
			});
		});

		await t.mutation(internal.users.upsertFromClerk, {
			data: clerkPayload({ first_name: "Ada", last_name: "Newname" }),
		});
		await flush(t);

		const users = await countUsers(t);
		expect(users).toHaveLength(1);
		const user = await readUserByClerkId(t);
		expect(user?.name).toBe("Ada Newname");
		expect(user?.email).toBe("ada@example.com");
	});

	test("converges on an existing user found by tokenIdentifier when clerkId is not stored", async () => {
		const t = convexTest(schema, modules);
		// A user created via the authed path before clerkId was recorded.
		const seededId = await t.run(async (ctx) => {
			return ctx.db.insert("users", {
				name: "Pre-existing",
				email: "ada@example.com",
				tokenIdentifier: `${ISSUER}|${CLERK_ID}`,
				plan: "hobby",
			});
		});

		await t.mutation(internal.users.upsertFromClerk, {
			data: clerkPayload(),
		});
		await flush(t);

		const users = await countUsers(t);
		expect(users).toHaveLength(1);
		const user = await readUserByClerkId(t);
		expect(user?._id).toBe(seededId);
		expect(user?.clerkId).toBe(CLERK_ID);
	});

	test("schedules Polar customer sync after inserting a user with an email", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.users.upsertFromClerk, {
			data: clerkPayload(),
		});
		await flush(t);

		// ensureCustomer: getExternal (404) -> create ("pol_new") -> savePolarCustomerId
		expect(polarMock.customers.getExternal).toHaveBeenCalledWith({
			externalId: CLERK_ID,
		});
		expect(polarMock.customers.create).toHaveBeenCalledOnce();
		const user = await readUserByClerkId(t);
		expect(user?.polarCustomerId).toBe("pol_new");
	});

	test("does not schedule Polar sync when the new user has no email", async () => {
		const t = convexTest(schema, modules);
		await t.mutation(internal.users.upsertFromClerk, {
			data: clerkPayload({ email_addresses: [] }),
		});
		await flush(t);

		expect(polarMock.customers.create).not.toHaveBeenCalled();
		const user = await readUserByClerkId(t);
		expect(user?.polarCustomerId).toBeUndefined();
	});
});