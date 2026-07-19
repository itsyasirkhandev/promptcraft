// @vitest-environment node

// [Public read] Behavior tests for convex/public/prompts.ts getBySlug.
// Seam: the unauthenticated query api.public.prompts.getBySlug exercised via
// convex-test WITHOUT a seeded identity (it is a plain query, not authed).
// Security boundary under test: missing / private / no-slug all collapse to
// null (existence not leaked) and the returned DTO strips userId, email,
// clerkId, and polarCustomerId.

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

// Shared seeder: one user + prompts in various states. Returns the slugs used.
async function seed(t: ReturnType<typeof convexTest>) {
	const userId = await t.run(async (ctx) =>
		ctx.db.insert("users", {
			name: "Ada",
			email: "ada@example.com",
			avatarUrl: "https://img.example/a.png",
			tokenIdentifier: "tok_public",
			clerkId: "clerk_public",
			plan: "hobby",
		})
	);
	await t.run(async (ctx) => {
		// Public with slug -> resolvable.
		await ctx.db.insert("prompts", {
			userId,
			title: "Public Prompt",
			content: "Hello {{name}}",
			templateMode: true,
			isPublic: true,
			tags: ["coding", "testing"],
			templateFields: [{ id: "f1", name: "name", type: "text" }],
			category: "coding",
			publicSlug: "public-prompt-abc123",
			createdAt: 10,
		});
		// Private with a retained slug -> must NOT resolve.
		await ctx.db.insert("prompts", {
			userId,
			title: "Toggled Private",
			content: "secret",
			templateMode: false,
			isPublic: false,
			tags: [],
			templateFields: [],
			createdAt: 20,
			publicSlug: "toggled-private-def456",
		});
		// Public but no slug (created before the feature) -> must NOT resolve.
		await ctx.db.insert("prompts", {
			userId,
			title: "Legacy Public",
			content: "legacy",
			templateMode: false,
			isPublic: true,
			tags: [],
			templateFields: [],
			category: "other",
			createdAt: 30,
		});
	});
}

describe("api.public.prompts.getBySlug — null cases", () => {
	test("returns null for a slug that does not exist", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.getBySlug, { slug: "no-such-slug-000000" });
		expect(result).toBeNull();
	});

	test("returns null for a prompt that is private (slug retained)", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.getBySlug, { slug: "toggled-private-def456" });
		expect(result).toBeNull();
	});

	test("returns null for a public prompt that has no slug (legacy)", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		// Legacy public prompt has isPublic:true but publicSlug undefined. It is
		// not reachable by any slug. Probing a guess must still be null.
		const result = await t.query(api.public.prompts.getBySlug, { slug: "legacy-public-xyz999" });
		expect(result).toBeNull();
	});
});

describe("api.public.prompts.getBySlug — public DTO shape", () => {
	test("returns the public-safe fields for a public prompt", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.getBySlug, { slug: "public-prompt-abc123" });
		expect(result).not.toBeNull();
		expect(result).toMatchObject({
			title: "Public Prompt",
			content: "Hello {{name}}",
			tags: ["coding", "testing"],
			templateMode: true,
			category: "coding",
			publicSlug: "public-prompt-abc123",
			author: { name: "Ada", avatarUrl: "https://img.example/a.png" },
		});
		expect(Array.isArray(result!.templateFields)).toBe(true);
		expect(typeof result!._creationTime).toBe("number");
	});

	test("never exposes userId, email, clerkId, or polarCustomerId", async () => {
		const t = convexTest(schema, modules);
		await seed(t);
		const result = await t.query(api.public.prompts.getBySlug, { slug: "public-prompt-abc123" });
		expect(result).not.toBeNull();
		const json = JSON.stringify(result);
		expect(json).not.toContain("userId");
		expect(json).not.toContain("email");
		expect(json).not.toContain("clerkId");
		expect(json).not.toContain("polarCustomerId");
		expect(json).not.toContain("tokenIdentifier");
		// The DTO has no top-level author id either.
		expect(result!.author).not.toHaveProperty("email");
		expect(result!.author).not.toHaveProperty("clerkId");
	});
});
