// @vitest-environment node

// [Hobby limits] Behavior tests for the 30-prompt and 10-public-prompt caps
// enforced server-side in convex/authed/prompts.ts. Seam: the authed mutations
// api.authed.prompts.{create,update} and api.authed.prompts.getUsage exercised
// via convex-test with a seeded identity. No Polar/billing boundary is reached
// here, so no SDK mock is required. Expected values are independent literals.

import { describe, expect, test, beforeEach } from "vitest";
import { convexTest, type TestConvex } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

// See convex/users.test.ts for the vite/client type workaround.
const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("./**/*.ts");

const CLERK_ID = "clerk_prompts";
const TOKEN_ID = "tok_clerk_prompts";

beforeEach(() => {
	process.env.CLERK_JWT_ISSUER_DOMAIN = "https://clerk.example.com";
	process.env.CONVEX_PRIVATE_BRIDGE_KEY = "test_bridge";
});

type T = TestConvex<typeof schema>;

type AuthedT = ReturnType<typeof authed>;

function authed(t: T) {
	return t.withIdentity({
		subject: CLERK_ID,
		tokenIdentifier: TOKEN_ID,
		email: "ada@example.com",
		name: "Ada Lovelace",
	});
}

const BASE_PROMPT: {
	title: string;
	content: string;
	templateMode: boolean;
	isPublic: boolean;
	tags: string[];
	templateFields: never[];
} = {
	title: "T",
	content: "C",
	templateMode: false,
	isPublic: false,
	tags: [],
	templateFields: [],
};

async function seedUserPlan(t: AuthedT, plan: "hobby" | "pro") {
	await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			name: "Ada",
			email: "ada@example.com",
			clerkId: CLERK_ID,
			tokenIdentifier: TOKEN_ID,
			plan,
		});
	});
}

async function seedPrompts(t: AuthedT, count: number, isPublic: boolean) {
	await t.run(async (ctx) => {
		const user = await ctx.db
			.query("users")
			.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
			.unique();
		if (!user) throw new Error("seed user missing");
		for (let i = 0; i < count; i++) {
			await ctx.db.insert("prompts", {
				userId: user._id,
				title: `Seed ${i}`,
				content: "seed",
				templateMode: false,
				isPublic,
				tags: [],
				templateFields: [],
				category: isPublic ? "other" : undefined,
				createdAt: i,
			});
		}
	});
}

// Convex serializes TaggedErrorClass failures into a ConvexError whose .data
// carries { tag, data }. t.mutation re-throws the ConvexError so the _tag is
// available on the thrown object's data.tag.
async function thrownTag(t: AuthedT, fn: () => Promise<unknown>): Promise<string> {
	try {
		await fn();
		throw new Error("expected rejection");
	} catch (e) {
		const data = (e as { data?: { tag?: string } }).data;
		return data?.tag ?? "";
	}
}

describe("prompts.create — hobby quotas", () => {
	test("allows creating up to 30 prompts, rejects the 31st", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "hobby");
		await seedPrompts(t, 29, false);

		// 30th prompt (seeded 29 + this create) is allowed.
		await t.mutation(api.authed.prompts.create, { ...BASE_PROMPT });

		const tag = await thrownTag(t, () => t.mutation(api.authed.prompts.create, { ...BASE_PROMPT }));
		expect(tag).toBe("PlanLimitError");
	});

	test("rejects a public prompt when 10 public prompts already exist", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "hobby");
		await seedPrompts(t, 30, false); // total cap not the binding constraint here
		await seedPrompts(t, 10, true);

		const tag = await thrownTag(t, () =>
			t.mutation(api.authed.prompts.create, { ...BASE_PROMPT, isPublic: true, category: "other" }),
		);
		expect(tag).toBe("PlanLimitError");
	});

	test("pro users are unlimited", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "pro");
		await seedPrompts(t, 30, false);
		await seedPrompts(t, 10, true);

		// Both caps would bind for hobby; pro sails past both.
		await t.mutation(api.authed.prompts.create, { ...BASE_PROMPT, isPublic: true, category: "other" });
	});
});

describe("prompts.update — hobby quotas", () => {
	test("blocks flipping a private prompt to public at the 10-public cap", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "hobby");
		await seedPrompts(t, 10, true);

		// A private prompt owned by the viewer (the 11th doc, private).
		const privateId = await t.run(async (ctx) => {
			const user = await ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
				.unique();
			return ctx.db.insert("prompts", {
				userId: user!._id,
				title: "Private",
				content: "c",
				templateMode: false,
				isPublic: false,
				tags: [],
				templateFields: [],
				createdAt: 1000,
			});
		});

		const tag = await thrownTag(t, () =>
			t.mutation(api.authed.prompts.update, {
				...BASE_PROMPT,
				id: privateId as never,
				isPublic: true,
				category: "other",
			}),
		);
		expect(tag).toBe("PlanLimitError");
	});

	test("allows flipping private->public under the cap", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "hobby");
		await seedPrompts(t, 9, true);

		const privateId = await t.run(async (ctx) => {
			const user = await ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
				.unique();
			return ctx.db.insert("prompts", {
				userId: user!._id,
				title: "Private",
				content: "c",
				templateMode: false,
				isPublic: false,
				tags: [],
				templateFields: [],
				createdAt: 1000,
			});
		});

		await t.mutation(api.authed.prompts.update, {
			...BASE_PROMPT,
			id: privateId as never,
			isPublic: true,
			category: "other",
		});
	});

	test("re-publicizing an already-public prompt does not count twice", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "hobby");
		await seedPrompts(t, 10, true);

		// Update one of the existing public prompts with isPublic still true —
		// should NOT trip the public cap (markPublic is guarded by !prompt.isPublic).
		const aPublicId = await t.run(async (ctx) => {
			const user = await ctx.db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", CLERK_ID))
				.unique();
			return ctx.db
				.query("prompts")
				.withIndex("by_userId_isPublic", (q) => q.eq("userId", user!._id).eq("isPublic", true))
				.first();
		});

		await t.mutation(api.authed.prompts.update, {
			...BASE_PROMPT,
			id: aPublicId!._id as never,
			isPublic: true,
			category: "other",
		});
	});
});

describe("prompts.getUsage", () => {
	test("hobby returns counts and limits", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "hobby");
		await seedPrompts(t, 12, false);
		await seedPrompts(t, 3, true);

		const usage = await t.query(api.authed.prompts.getUsage, {});
		expect(usage).toMatchObject({
			plan: "hobby",
			promptsUsed: 15,
			promptsLimit: 30,
			publicUsed: 3,
			publicLimit: 10,
		});
	});

	test("pro returns null limits and zero usage", async () => {
		const t = authed(convexTest(schema, modules));
		await seedUserPlan(t, "pro");
		await seedPrompts(t, 5, false);

		const usage = await t.query(api.authed.prompts.getUsage, {});
		expect(usage).toMatchObject({
			plan: "pro",
			promptsUsed: 0,
			promptsLimit: null,
			publicUsed: 0,
			publicLimit: null,
		});
	});
});