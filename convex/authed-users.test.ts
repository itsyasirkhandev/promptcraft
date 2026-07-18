// @vitest-environment node

// [Phase 8] getOrCreateUser behavior tests (spec 3.1).
// Seam: the authed mutation api.authed.users.getOrCreateUser, exercised via
// convex-test's t.mutation with a seeded identity. The Polar SDK boundary is
// mocked; the scheduler is flushed so the idempotent ensurePolarCustomer
// side-effect settles. Expected values are independent literals.
//
// Lives at the convex root (not convex/authed/) because convex-test's module
// resolver keys same-directory modules as "./users.ts" while the api reference
// resolves to "authed/users"; placing the test one level up makes the glob key
// "./authed/users.ts" line up with the resolver prefix. See convex-test's
// findModulesRoot (prefix derived from the _generated path).

import { describe, expect, test, vi, beforeEach } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

// See convex/users.test.ts for the vite/client type workaround.
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

const CLERK_ID = "clerk_456";
const TOKEN_ID = "tok_clerk_456";

beforeEach(() => {
	vi.clearAllMocks();
	polarMock.customers.getExternal.mockRejectedValue({ statusCode: 404 });
	polarMock.customers.create.mockResolvedValue({ id: "pol_authed" });
	process.env.CLERK_JWT_ISSUER_DOMAIN = "https://clerk.example.com";
	process.env.POLAR_ACCESS_TOKEN = "test_token";
	process.env.POLAR_SERVER = "sandbox";
	process.env.POLAR_WEBHOOK_SECRET = "whsec_test";
	process.env.CONVEX_PRIVATE_BRIDGE_KEY = "test_bridge";
	delete process.env.BREVO_API_KEY;
});

type T = TestConvex<typeof schema>;

type AuthedT = ReturnType<typeof authed>;

async function flush(t: AuthedT) {
	for (let i = 0; i < 5; i++) {
		await new Promise((r) => setTimeout(r, 1));
		await t.finishInProgressScheduledFunctions();
	}
}

function authed(t: T) {
	return t.withIdentity({
		subject: CLERK_ID,
		tokenIdentifier: TOKEN_ID,
		email: "ada@example.com",
		name: "Ada Lovelace",
		pictureUrl: "https://img.example.com/ada.png",
	});
}

async function readUserByClerkId(t: AuthedT) {
	return t.run(async (ctx) => {
		return ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
			.unique();
	});
}

describe("getOrCreateUser", () => {
	test("creates a new user from the authenticated identity", async () => {
		const t = authed(convexTest(schema, modules));

		const id = await t.mutation(api.authed.users.getOrCreateUser, {});

		await flush(t);

		const user = await readUserByClerkId(t);
		expect(user).not.toBeNull();
		expect(user?._id).toBe(id);
		expect(user?.name).toBe("Ada Lovelace");
		expect(user?.email).toBe("ada@example.com");
		expect(user?.clerkId).toBe(CLERK_ID);
		expect(user?.tokenIdentifier).toBe(TOKEN_ID);
		expect(user?.plan).toBe("hobby");
	});

	test("patches changed profile fields on an existing user", async () => {
		const t = authed(convexTest(schema, modules));
		await t.run(async (ctx) => {
			await ctx.db.insert("users", {
				name: "Stale Name",
				email: "stale@example.com",
				clerkId: CLERK_ID,
				tokenIdentifier: TOKEN_ID,
				plan: "hobby",
			});
		});

		const id = await t.mutation(api.authed.users.getOrCreateUser, {});
		await flush(t);

		const user = await readUserByClerkId(t);
		expect(user?._id).toBe(id);
		expect(user?.name).toBe("Ada Lovelace");
		expect(user?.email).toBe("ada@example.com");
	});

	test("converges by clerkId when the tokenIdentifier lookup misses", async () => {
		// User created via the Clerk webhook with a reconstructed token; the
		// authed identity carries a different tokenIdentifier string.
		const t = authed(convexTest(schema, modules));
		const seededId = await t.run(async (ctx) => {
			return ctx.db.insert("users", {
				name: "From Webhook",
				email: "from@example.com",
				clerkId: CLERK_ID,
				tokenIdentifier: "tok_issuer_clerk_456",
				plan: "hobby",
			});
		});

		const id = await t.mutation(api.authed.users.getOrCreateUser, {});
		await flush(t);

		expect(id).toBe(seededId);
		const user = await readUserByClerkId(t);
		expect(user?.tokenIdentifier).toBe(TOKEN_ID);
	});

	test("schedules Polar customer sync after creating a user", async () => {
		const t = authed(convexTest(schema, modules));

		await t.mutation(api.authed.users.getOrCreateUser, {});
		await flush(t);

		expect(polarMock.customers.getExternal).toHaveBeenCalledWith({
			externalId: CLERK_ID,
		});
		expect(polarMock.customers.create).toHaveBeenCalledOnce();
		const user = await readUserByClerkId(t);
		expect(user?.polarCustomerId).toBe("pol_authed");
	});
});