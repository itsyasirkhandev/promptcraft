// @vitest-environment node

// [Public slugs] Behavior tests for convex/slugs.ts: base-slug normalization,
// retry-on-collision, and that a unique slug is produced even when an
// existing publicSlug occupies a candidate. The pure normalizer is exercised
// directly; the Effect generator is run via Effect.runPromise inside convex-test's
// t.run so the by_publicSlug index actually resolves collisions.

import { describe, expect, test, beforeEach } from "vitest";
import { Effect } from "effect";
import { baseSlugFrom, generateUniqueSlug } from "./slugs";
import { convexTest } from "convex-test";
import schema from "./schema";

// See convex/users.test.ts for the vite/client type workaround.
const modules = (
	import.meta as unknown as {
		glob: (pattern: string) => Record<string, () => Promise<unknown>>;
	}
).glob("./**/*.ts");

beforeEach(() => {
	process.env.CLERK_JWT_ISSUER_DOMAIN = "https://clerk.example.com";
});

describe("baseSlugFrom — pure title normalization", () => {
	test("lowercases and collapses non-alphanumerics to a single dash", () => {
		expect(baseSlugFrom("My Cool Prompt!")).toBe("my-cool-prompt");
		expect(baseSlugFrom("Hello, World")).toBe("hello-world");
		expect(baseSlugFrom("a   b___c")).toBe("a-b-c");
	});

	test("trims leading and trailing dashes", () => {
		expect(baseSlugFrom("---edge---")).toBe("edge");
		expect(baseSlugFrom("...spaces...")).toBe("spaces");
	});

	test("falls back to literal 'prompt' when the title is empty/whitespace", () => {
		expect(baseSlugFrom("")).toBe("prompt");
		expect(baseSlugFrom("   ")).toBe("prompt");
		expect(baseSlugFrom("!!!@@@###")).toBe("prompt");
	});

	test("preserves digits and mixes them with letters", () => {
		expect(baseSlugFrom("Top 10 Tips")).toBe("top-10-tips");
		expect(baseSlugFrom("v2 release")).toBe("v2-release");
	});
});

describe("generateUniqueSlug — collision handling", () => {
	test("returns a slug suffixed with a 6-char random segment", async () => {
		const t = convexTest(schema, modules);
		const slug = await t.run(async (ctx) =>
			Effect.runPromise(generateUniqueSlug(ctx.db, "Hello World"))
		);
		expect(slug).toMatch(/^hello-world-[a-z0-9]{6}$/);
	});

	test("still returns a unique slug when an existing publicSlug is present", async () => {
		const t = convexTest(schema, modules);
		// Seed a user + a prompt that owns a slug we want to avoid colliding with.
		const userId = await t.run(async (ctx) =>
			ctx.db.insert("users", {
				name: "Ada",
				email: "ada@example.com",
				tokenIdentifier: "tok_slugs",
				plan: "hobby",
			})
		);
		await t.run(async (ctx) => {
			await ctx.db.insert("prompts", {
				userId,
				title: "Hello World",
				content: "c",
				templateMode: false,
				isPublic: true,
				tags: [],
				templateFields: [],
				category: "other",
				publicSlug: "hello-world-zzzzzz",
				createdAt: 1,
			});
		});

		const slug = await t.run(async (ctx) =>
			Effect.runPromise(generateUniqueSlug(ctx.db, "Hello World"))
		);
		expect(slug).toMatch(/^hello-world-[a-z0-9]{6,}$/);
		expect(slug).not.toBe("hello-world-zzzzzz");
	});
});
