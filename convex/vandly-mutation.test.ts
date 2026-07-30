// @vitest-environment node

// Vandly subscription mutation unit tests.
// Seam: internal.users.updateSubscriptionFromVandly exercised via convex-test's t.mutation.

import { describe, expect, test, beforeEach } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";
import { internal } from "./_generated/api";

const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("./**/*.ts");

const USER_EMAIL = "yasirwebio@gmail.com";
const SUB_ID = "922d11fa-064a-4c88-9d9a-7335ed4d3541";

type T = TestConvex<typeof schema>;

async function seedUser(t: T, overrides: Record<string, unknown> = {}) {
	return t.run(async (ctx) => {
		return ctx.db.insert("users", {
			name: "Yasir Khan",
			email: USER_EMAIL,
			tokenIdentifier: `clerk|user_123`,
			clerkId: "user_123",
			plan: "hobby",
			...overrides,
		});
	});
}

async function getUser(t: T, email = USER_EMAIL) {
	return t.run(async (ctx) => {
		return ctx.db
			.query("users")
			.withIndex("by_email", (q) => q.eq("email", email))
			.unique();
	});
}

describe("updateSubscriptionFromVandly mutation", () => {
	beforeEach(() => {
		delete process.env.BREVO_API_KEY;
	});

	test("subscription.created upgrades user plan to pro and sets vandly fields", async () => {
		const t = convexTest(schema, modules);
		await seedUser(t);

		const now = Date.now();
		await t.mutation(internal.users.updateSubscriptionFromVandly, {
			email: USER_EMAIL,
			subscriptionId: SUB_ID,
			event: "subscription.created",
			eventTimestamp: now,
		});

		const user = await getUser(t);
		expect(user?.plan).toBe("pro");
		expect(user?.vandlySubscriptionId).toBe(SUB_ID);
		expect(user?.vandlySubscriptionStatus).toBe("active");
		expect(user?.vandlyLastEventAt).toBe(now);
	});

	test("subscription.renewed maintains user plan as pro and updates status to active", async () => {
		const t = convexTest(schema, modules);
		const initialTime = Date.now() - 10000;
		await seedUser(t, {
			plan: "pro",
			vandlySubscriptionId: SUB_ID,
			vandlySubscriptionStatus: "active",
			vandlyLastEventAt: initialTime,
		});

		const newTime = Date.now();
		await t.mutation(internal.users.updateSubscriptionFromVandly, {
			email: USER_EMAIL,
			subscriptionId: SUB_ID,
			event: "subscription.renewed",
			eventTimestamp: newTime,
		});

		const user = await getUser(t);
		expect(user?.plan).toBe("pro");
		expect(user?.vandlySubscriptionStatus).toBe("active");
		expect(user?.vandlyLastEventAt).toBe(newTime);
	});

	test("subscription.canceled downgrades user plan to hobby when Polar subscription is inactive", async () => {
		const t = convexTest(schema, modules);
		const initialTime = Date.now() - 5000;
		await seedUser(t, {
			plan: "pro",
			vandlySubscriptionId: SUB_ID,
			vandlySubscriptionStatus: "active",
			vandlyLastEventAt: initialTime,
		});

		const cancelTime = Date.now();
		await t.mutation(internal.users.updateSubscriptionFromVandly, {
			email: USER_EMAIL,
			subscriptionId: SUB_ID,
			event: "subscription.canceled",
			eventTimestamp: cancelTime,
		});

		const user = await getUser(t);
		expect(user?.plan).toBe("hobby");
		expect(user?.vandlySubscriptionStatus).toBe("canceled");
		expect(user?.vandlyLastEventAt).toBe(cancelTime);
	});

	test("subscription.canceled preserves pro plan if user has an active Polar subscription", async () => {
		const t = convexTest(schema, modules);
		const initialTime = Date.now() - 5000;
		await seedUser(t, {
			plan: "pro",
			polarSubscriptionStatus: "active",
			vandlySubscriptionId: SUB_ID,
			vandlySubscriptionStatus: "active",
			vandlyLastEventAt: initialTime,
		});

		const cancelTime = Date.now();
		await t.mutation(internal.users.updateSubscriptionFromVandly, {
			email: USER_EMAIL,
			subscriptionId: SUB_ID,
			event: "subscription.canceled",
			eventTimestamp: cancelTime,
		});

		const user = await getUser(t);
		expect(user?.plan).toBe("pro"); // Preserved because Polar is active
		expect(user?.vandlySubscriptionStatus).toBe("canceled");
		expect(user?.vandlyLastEventAt).toBe(cancelTime);
	});

	test("ignores out-of-order or replayed events with older timestamps", async () => {
		const t = convexTest(schema, modules);
		const newestTime = Date.now();
		await seedUser(t, {
			plan: "pro",
			vandlySubscriptionId: SUB_ID,
			vandlySubscriptionStatus: "active",
			vandlyLastEventAt: newestTime,
		});

		const olderTime = newestTime - 5000;
		await t.mutation(internal.users.updateSubscriptionFromVandly, {
			email: USER_EMAIL,
			subscriptionId: SUB_ID,
			event: "subscription.canceled",
			eventTimestamp: olderTime,
		});

		const user = await getUser(t);
		expect(user?.plan).toBe("pro"); // Remains pro, stale cancellation ignored
		expect(user?.vandlySubscriptionStatus).toBe("active");
		expect(user?.vandlyLastEventAt).toBe(newestTime);
	});

	test("does nothing when user email is not found in database", async () => {
		const t = convexTest(schema, modules);

		await t.mutation(internal.users.updateSubscriptionFromVandly, {
			email: "nonexistent@example.com",
			subscriptionId: SUB_ID,
			event: "subscription.created",
			eventTimestamp: Date.now(),
		});

		const user = await getUser(t, "nonexistent@example.com");
		expect(user).toBeNull();
	});
});
