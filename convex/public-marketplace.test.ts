// @vitest-environment node

// [Public read] Behavior tests for convex/public/prompts.ts listPublicPrompts
// (the unauthenticated Marketplace list query). Seam: the plain query
// api.public.prompts.listPublicPrompts exercised via convex-test WITHOUT a
// seeded identity. Behaviors under test: bounded take(50), `recent` (newest
// first) vs `a-z` ordering, category filtering (in-memory / for-await), FTS via
// searchableText, the `isPublic === true`-only boundary, and the strict
// PublicPromptDTO projection (no userId / email / clerkId / polarCustomerId).

import { describe, expect, test, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";

// See convex/users.test.ts for the vite/client type workaround.
const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("./**/*.ts");

beforeEach(() => {
	process.env.CLERK_JWT_ISSUER_DOMAIN = "https://clerk.example.com";
});

// Searchable blob mirrors authed/prompts.ts: `${title} ${content} ${tags.join(' ')}` lowercased.
function searchBlob(title: string, content: string, tags: string[]) {
	return `${title} ${content} ${tags.join(" ")}`.toLowerCase();
}

// Shared seeder: two users + public prompts across categories/orders + a
// private prompt that must never surface. Insertion order (Zebra, Alpha,
// Middle, Secret, Orphan) determines the Convex _creationTime used by `recent`.
async function seed(t: ReturnType<typeof convexTest>) {
	const adaId = await t.run(async (ctx) =>
		ctx.db.insert("users", {
			name: "Ada",
			email: "ada@example.com",
			avatarUrl: "https://img.example/a.png",
			tokenIdentifier: "tok_ada",
			clerkId: "clerk_ada",
			plan: "hobby",
		})
	);
	const boId = await t.run(async (ctx) =>
		ctx.db.insert("users", {
			name: "Bo",
			email: "bo@example.com",
			tokenIdentifier: "tok_bo",
			clerkId: "clerk_bo",
			plan: "hobby",
		})
	);

	await t.run(async (ctx) => {
		await ctx.db.insert("prompts", {
			userId: adaId,
			title: "Zebra Prompt",
			content: "Refactor a react component",
			templateMode: true,
			isPublic: true,
			tags: ["coding", "react"],
			templateFields: [{ id: "f1", name: "topic", type: "text" }],
			category: "coding",
			publicSlug: "zebra-prompt",
			searchableText: searchBlob("Zebra Prompt", "Refactor a react component", ["coding", "react"]),
			createdAt: 10,
		});
		await ctx.db.insert("prompts", {
			userId: boId,
			title: "Alpha Prompt",
			content: "Write a marketing email",
			templateMode: false,
			isPublic: true,
			tags: ["marketing"],
			templateFields: [],
			category: "marketing",
			publicSlug: "alpha-prompt",
			searchableText: searchBlob("Alpha Prompt", "Write a marketing email", ["marketing"]),
			createdAt: 30,
		});
		await ctx.db.insert("prompts", {
			userId: adaId,
			title: "Middle Prompt",
			content: "Analyze a dataset",
			templateMode: true,
			isPublic: true,
			tags: ["analysis"],
			templateFields: [{ id: "f2", name: "data", type: "longText" }],
			category: "analysis",
			publicSlug: "middle-prompt",
			searchableText: searchBlob("Middle Prompt", "Analyze a dataset", ["analysis"]),
			createdAt: 20,
		});
		// Private prompt — must never appear in the marketplace list.
		await ctx.db.insert("prompts", {
			userId: boId,
			title: "Secret Prompt",
			content: "should never surface",
			templateMode: false,
			isPublic: false,
			tags: ["coding"],
			templateFields: [],
			category: "coding",
			publicSlug: "secret-prompt",
			searchableText: searchBlob("Secret Prompt", "should never surface", ["coding"]),
			createdAt: 40,
		});
		// Public prompt owned by Ada — used below to verify the Anonymous fallback
		// once Ada is deleted.
		await ctx.db.insert("prompts", {
			userId: adaId,
			title: "Orphan Public",
			content: "no author resolves",
			templateMode: false,
			isPublic: true,
			tags: ["other"],
			templateFields: [],
			category: "other",
			publicSlug: "orphan-public",
			searchableText: searchBlob("Orphan Public", "no author resolves", ["other"]),
			createdAt: 5,
		});
	});

	return { adaId, boId };
}

describe("api.public.prompts.listPublicPrompts — recent / a-z / category", () => {
	test("`recent` returns public prompts newest-first (by _creationTime desc)", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			sortBy: "recent",
		});
		// `recent` orders by the Convex _creationTime (insertion time), desc. The
		// seed inserts Zebra, Alpha, Middle, Secret(private), Orphan in order, so
		// newest-first is the reverse of the public insertion order.
		expect(result.map((p) => p.title)).toEqual([
			"Orphan Public", // inserted last  -> newest
			"Middle Prompt",
			"Alpha Prompt",
			"Zebra Prompt", // inserted first -> oldest
		]);
		for (let i = 1; i < result.length; i++) {
			expect(result[i]._creationTime).toBeLessThanOrEqual(result[i - 1]._creationTime);
		}
	});

	test("`a-z` returns public prompts ordered alphabetically by title", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			sortBy: "a-z",
		});
		expect(result.map((p) => p.title)).toEqual([
			"Alpha Prompt",
			"Middle Prompt",
			"Orphan Public",
			"Zebra Prompt",
		]);
	});

	test("category filter returns only matching prompts (recent path)", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			category: "coding",
			sortBy: "recent",
		});
		expect(result.map((p) => p.title)).toEqual(["Zebra Prompt"]);
	});

	test("category filter returns only matching prompts (a-z path)", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			category: "marketing",
			sortBy: "a-z",
		});
		expect(result.map((p) => p.title)).toEqual(["Alpha Prompt"]);
	});

	test("`all` category returns every public prompt", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			category: "all",
			sortBy: "recent",
		});
		expect(result).toHaveLength(4);
	});

	test("an unknown category value yields an empty list (not an error)", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			category: "does-not-exist",
		});
		expect(result).toEqual([]);
	});
});

describe("api.public.prompts.listPublicPrompts — search", () => {
	test("searchQuery matches against searchableText and respects isPublic", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			searchQuery: "react",
		});
		expect(result.map((p) => p.title)).toEqual(["Zebra Prompt"]);
	});

	test("searchQuery + category narrows further (in-memory category filter)", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			searchQuery: "prompt",
			category: "marketing",
		});
		expect(result.map((p) => p.title)).toEqual(["Alpha Prompt"]);
	});

	test("searchQuery + a-z sorts matches alphabetically", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			searchQuery: "prompt",
			sortBy: "a-z",
		});
		expect(result.map((p) => p.title)).toEqual([
			"Alpha Prompt",
			"Middle Prompt",
			"Zebra Prompt",
		]);
	});

	test("a search with no matches returns []", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			searchQuery: "nomatchestringhere",
		});
		expect(result).toEqual([]);
	});
});

describe("api.public.prompts.listPublicPrompts — security / DTO shape", () => {
	test("never returns a private prompt", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const recent = await t.query(api.public.prompts.listPublicPrompts, {});
		expect(recent.find((p) => p.title === "Secret Prompt")).toBeUndefined();
		const az = await t.query(api.public.prompts.listPublicPrompts, {
			sortBy: "a-z",
		});
		expect(az.find((p) => p.title === "Secret Prompt")).toBeUndefined();
		const searched = await t.query(api.public.prompts.listPublicPrompts, {
			searchQuery: "should never surface",
		});
		expect(searched.find((p) => p.title === "Secret Prompt")).toBeUndefined();
	});

	test("DTO never carries userId, email, clerkId, or polarCustomerId", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {});
		expect(result.length).toBeGreaterThan(0);
		// Structural checks (not substring) so prompt *content* containing words
		// like "email" does not false-positive — only real keys are rejected.
		for (const p of result) {
			expect(p).not.toHaveProperty("userId");
			expect(p).not.toHaveProperty("email");
			expect(p).not.toHaveProperty("clerkId");
			expect(p).not.toHaveProperty("polarCustomerId");
			expect(p).not.toHaveProperty("tokenIdentifier");
			expect(p).not.toHaveProperty("templateFields");
			expect(p.author).not.toHaveProperty("email");
			expect(p.author).not.toHaveProperty("clerkId");
		}
	});

	test("author falls back to Anonymous when the user is missing", async () => {
		const t = convexTest(schema, modules);
		const { adaId } = await seed(t);
		// Delete the author so Ada-owned public prompts no longer resolve an author.
		await t.run(async (ctx) => ctx.db.delete(adaId));
		const result = await t.query(api.public.prompts.listPublicPrompts, {});
		const orphan = result.find((p) => p.title === "Orphan Public");
		expect(orphan).toBeDefined();
		expect(orphan?.author.name).toBe("Anonymous");
		expect(orphan?.author.avatarUrl).toBeNull();
	});

	test("resolved author carries name and avatarUrl when present", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.listPublicPrompts, {});
		const zebra = result.find((p) => p.title === "Zebra Prompt");
		expect(zebra?.author).toMatchObject({
			name: "Ada",
			avatarUrl: "https://img.example/a.png",
		});
	});

	test("is bounded to take(50)", async () => {
		const t = convexTest(schema, modules);
		const { boId } = await seed(t);
		// Seed 60 more public prompts (on top of the 4 already public) to confirm
		// the query caps at 50.
		await t.run(async (ctx) => {
			for (let i = 0; i < 60; i++) {
				await ctx.db.insert("prompts", {
					userId: boId,
					title: `Bulk ${String(i).padStart(2, "0")}`,
					content: "bulk",
					templateMode: false,
					isPublic: true,
					tags: [],
					templateFields: [],
					category: "other",
					publicSlug: `bulk-${i}`,
					searchableText: searchBlob(`Bulk ${i}`, "bulk", []),
					createdAt: 1000 + i,
				});
			}
		});
		const result = await t.query(api.public.prompts.listPublicPrompts, {
			sortBy: "recent",
		});
		expect(result.length).toBe(50);
	});
});