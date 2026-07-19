---
## Design Plan: Public Slug Sharing

Technical specification for implementing stable, URL-safe public slugs that give every public prompt a shareable unauthenticated address (`/p/[slug]`) on the Effect v4 + Convex + Clerk stack.

## 1. Objective

Implement a public slug sharing feature that allows users to:

* Generate a unique, URL-safe slug for a prompt the first time it is marked public
* Share a prompt by link to anyone — signed-in or not
* Let a visitor fill in a templated prompt's dynamic fields and see a live preview
* Let a visitor copy the generated prompt or open it directly in one of 8 AI providers
* Keep shared links stable across title/content edits (slug never regenerates)
* Withhold private content from the public route when a prompt is toggled back to private

## 2. Tech Stack

* **Backend:** Convex (`query` / `mutation`) + Effect v4 (`Effect.gen`, `Effect.tryPromise`, `Schema.TaggedErrorClass`)
* **Database:** Convex `prompts` / `users` tables, indexed lookup on `by_publicSlug`
* **Frontend:** Next.js App Router (`(public)` route group), React 19, react-hook-form
* **Styling:** Tailwind CSS, Phosphor + Iconify icons, `sonner` toasts
* **Testing:** Vitest + convex-test (repo convention)

**Why this stack?**

* Convex's `by_publicSlug` index gives O(log n) unique lookup for slug generation retries and the public read; no unique constraint is needed at the DB layer.
* Effect v4 is already the backend idiom (`effectAuthedMutation` + `AuthedContext` + `ConvexDB`); slug generation slots into the existing `create`/`update` generators with zero new wiring.
* The `(public)` route group + `proxy.ts` already leave `/p(.*)` unauthenticated, so the public page needs no auth middleware change.
* `OpenInAIButton`, `PromptPreview`, `DynamicFields`, `PromptNotFound`, and `lib/variables.ts` already exist and are production-tested; reusing them keeps the diff minimal and the visual language consistent.

## 3. High-Level Architecture

The feature is divided into three layers of responsibility:

**A. Backend — Convex (Effect v4 + plain query)**

* `convex/slugs.ts` — `generateUniqueSlug(ctx, title)` Effect generator (5 retries + timestamp fallback)
* `convex/authed/prompts.ts` — assigns/preserves `publicSlug` in `create` and `update`
* `convex/public/prompts.ts` — unauthenticated `getBySlug` query returning a `PublicPromptDTO`

**B. Database — Convex schema**

* Add `publicSlug: v.optional(v.string())` + `.index('by_publicSlug', ['publicSlug'])` to `prompts` (additive)
* `publicSlug` is retained across private/public toggles; the public read enforces `isPublic === true`

**C. Frontend — Next.js App Router**

* `app/(public)/p/[slug]/page.tsx` — server component with `generateMetadata`, renders `PublicPromptClient`
* `components/prompts/PublicPromptClient.tsx` — fetches by slug, renders dynamic fields, live preview, Copy, `OpenInAIButton`, Copy Link
* `app/(authed)/prompt/_components/PromptForm.tsx` — optional `publicSlug` prop renders a read-only share URL + Copy
* `app/(authed)/prompt/[id]/edit/page.tsx` — passes the loaded prompt's `publicSlug` into `PromptForm`

**ARCHITECTURE FLOW**
Visitor -> `/p/[slug]` (no Clerk) -> `api.public.prompts.getBySlug` (plain query) -> `by_publicSlug` index -> `PublicPromptDTO` (no `userId`/email) -> `PublicPromptClient` -> `OpenInAIButton` / Copy
Owner -> `/prompt/[id]/edit` (authed) -> `api.authed.prompts.update` (Effect) -> quota check -> `generateUniqueSlug` -> `by_publicSlug` collision check -> `patch({ publicSlug })` -> `PromptForm` share URL

## 4. Data Model

Two existing tables are involved; only `prompts` is modified (additively). The `users` table is read for the public author projection (`name`, `avatarUrl` only).

```ts
// convex/schema.ts — additive change to the prompts table only
prompts: defineTable({
	userId: v.id('users'),
	title: v.string(),
	content: v.string(),
	templateMode: v.boolean(),
	isPublic: v.boolean(),
	tags: v.array(v.string()),
	templateFields: v.array(
		v.object({
			id: v.string(),
			name: v.string(),
			type: v.union(v.literal('text'), v.literal('longText'), v.literal('number'), v.literal('singleSelect'), v.literal('multiSelect')),
			options: v.optional(v.array(v.string()))
		})
	),
	category: v.optional(v.string()),
	// NEW — URL-safe, stable identifier for a public prompt. Set once on first
	// isPublic transition; retained (not regenerated) across edits and when
	// toggled back to private. The public query gates on isPublic === true.
	publicSlug: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.optional(v.number())
})
	.index('by_userId', ['userId'])
	.index('by_userId_createdAt', ['userId', 'createdAt'])
	.index('by_userId_isPublic', ['userId', 'isPublic'])
	.index('by_isPublic', ['isPublic'])
	// NEW — powers O(log n) unique lookup for slug generation retries and the
	// unauthenticated public read. Convex has no unique insert constraint, so
	// uniqueness is enforced app-side (see section 6.A).
	.index('by_publicSlug', ['publicSlug'])
```

The unauthenticated DTO is a strict projection — it never carries `userId`, `tokenIdentifier`, `clerkId`, `email`, or `polarCustomerId`:

```ts
// PublicPromptDTO — the only shape ever returned by api.public.prompts.getBySlug
type PublicPromptDTO = {
	title: string;
	content: string;
	tags: string[];
	templateMode: boolean;
	templateFields: TemplateField[];
	category?: string;
	publicSlug: string;
	_creationTime: number;
	author: { name: string; avatarUrl?: string };
};
```

## 5. Core Design Decisions

**Decision 1: App-level uniqueness via `by_publicSlug` index + retry (not a DB unique constraint)**
*Why:* Convex does not enforce a unique constraint on insert. The indexed `.unique()`-style lookup returning at most one doc plus a bounded retry loop (5 attempts, then a `Date.now().toString(36)` fallback) makes collisions astronomically unlikely and the fallback deterministic within a deployment.

**Decision 2: The slug is generated once and never regenerated**
*Why:* Shared links must keep working. Regenerating on a title edit would silently break every shared link. Editing title/content on a public prompt patches everything *except* `publicSlug`.

**Decision 3: The slug is retained when toggled private; the public read returns `null`**
*Why:* Security boundary, not optimization. If a user un-publishes a prompt, its old link must show "not found" rather than leak private content. Re-publicizing restores the *same* link, which is the desired UX. The gate `if (!prompt || prompt.isPublic !== true) return null` makes no distinction between "missing" and "private" so existence is not leaked.

**Decision 4: The public read is a plain `query`, not `effectAuthedQuery`**
*Why:* The repo convention ("client-facing functions use `convex/authed/`") requires a Clerk identity; an unauthenticated read cannot satisfy it. This is a deliberate, minimal convention extension — one file (`convex/public/prompts.ts`), one read — not a general pattern. Writes stay in `convex/authed/`.

**Decision 5: A dedicated `PublicPromptDTO` with an explicit allowlist**
*Why:* `Doc<'prompts'>` carries `userId`, and `Doc<'users'>` carries `email`/`clerkId`/`polarCustomerId`. An explicit mapper returning only the public-safe fields prevents future field additions from accidentally leaking through to unauthenticated clients.

**Decision 6: Reuse the existing UI surface, do not fork it**
*Why:* `OpenInAIButton`, `PromptPreview`, `DynamicFields`, `PromptNotFound`, `interpolateVariables`, and `flattenFormValues` already implement the owner "use" page. The public page mirrors that composition with an author header + Copy Link; no component is duplicated.

## 6. Core Functional Flows

**A. Slug generation — `convex/slugs.ts`**
An Effect v4 generator that mirrors the existing `Effect.tryPromise` pattern in `convex/authed/prompts.ts`. The writer DB is threaded in so the uniqueness check runs inside the same mutation transaction.

```ts
// convex/slugs.ts
import { Effect } from 'effect';
import { DataModel } from './_generated/dataModel';
import { GenericDatabaseWriter } from 'convex/server';

const MAX_ATTEMPTS = 5;

function baseSlugFrom(title: string): string {
	const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
	return base.length > 0 ? base : 'prompt';
}

export function* generateUniqueSlug(db: GenericDatabaseWriter<DataModel>, title: string) {
	const baseSlug = baseSlugFrom(title);
	for (let i = 0; i < MAX_ATTEMPTS; i++) {
		const candidate = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
		const existing = yield* Effect.tryPromise(() =>
			db.query('prompts').withIndex('by_publicSlug', (q) => q.eq('publicSlug', candidate)).unique()
		);
		if (!existing) return candidate;
	}
	// Deterministic fallback — unique within the same deployment.
	return `${baseSlug}-${Date.now().toString(36)}`;
}
```

**B. Create — `convex/authed/prompts.ts` `create`**
Quota check runs *first*, so an over-quota `create` never orphans a slug. Slug generation only fires when `isPublic` is true.

```ts
yield* enforceHobbyQuota(db, viewer, { checkTotal: true, markPublic: args.isPublic });

const publicSlug = args.isPublic ? yield* generateUniqueSlug(writerDb, args.title) : undefined;

const promptId = yield* Effect.tryPromise(() =>
	writerDb.insert('prompts', {
		userId: viewer._id,
		title: args.title,
		content: args.content,
		templateMode: args.templateMode,
		isPublic: args.isPublic,
		tags: args.tags,
		templateFields: args.templateFields,
		category: args.category,
		publicSlug,
		createdAt: Date.now()
	})
);
```

**C. Update — `convex/authed/prompts.ts` `update`**
A slug is generated only on a private->public transition when none exists. An existing slug is always preserved, even if the title changed.

```ts
yield* enforceHobbyQuota(db, viewer, { checkTotal: false, markPublic: args.isPublic && !prompt.isPublic });

const needsSlug = args.isPublic && !prompt.publicSlug;
const publicSlug = needsSlug ? yield* generateUniqueSlug(writerDb, args.title) : prompt.publicSlug;

yield* Effect.tryPromise(() =>
	writerDb.patch(args.id, {
		title: args.title,
		content: args.content,
		templateMode: args.templateMode,
		isPublic: args.isPublic,
		tags: args.tags,
		templateFields: args.templateFields,
		category: args.category,
		publicSlug,
		updatedAt: Date.now()
	})
);
```

**D. Public read — `convex/public/prompts.ts`**
A plain `query` (no auth guard). The gate collapses missing, private, and never-had-a-slug into a single `null` so existence is not leaked.

```ts
// convex/public/prompts.ts
import { v } from 'convex/values';
import { query } from '../_generated/server';

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const prompt = await ctx.db
			.query('prompts')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', args.slug))
			.unique();

		// No distinction between missing / private / no-slug — all return null.
		if (!prompt || prompt.isPublic !== true || !prompt.publicSlug) return null;

		const author = await ctx.db.get(prompt.userId);
		return {
			title: prompt.title,
			content: prompt.content,
			tags: prompt.tags,
			templateMode: prompt.templateMode,
			templateFields: prompt.templateFields,
			category: prompt.category,
			publicSlug: prompt.publicSlug,
			_creationTime: prompt._creationTime,
			author: author ? { name: author.name, avatarUrl: author.avatarUrl } : { name: 'Anonymous' }
		};
	}
});
```

**E. Public page — `app/(public)/p/[slug]/page.tsx` + `PublicPromptClient.tsx`**
The server component derives head metadata from the slug; the client component mirrors the owner "use" page composition (header + dynamic fields + live preview + Copy + `OpenInAIButton` + Copy Link) using the same hooks and helpers.

```tsx
// app/(public)/p/[slug]/page.tsx
export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	const readable = slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
	return {
		title: `${readable} — Public Prompt`,
		description: `Use and copy this public prompt.`,
		openGraph: { title: readable, type: 'article' },
		twitter: { card: 'summary' }
	};
}
```

```tsx
// components/prompts/PublicPromptClient.tsx — interpolation mirrors the use page
const flatValues = React.useMemo(() => flattenFormValues(formValues), [formValues]);
const interpolated = React.useMemo(
	() => prompt ? interpolateVariables(prompt.content, flatValues) : '',
	[prompt, flatValues]
);
// handleCopy -> navigator.clipboard.writeText(interpolated) + toast.success('Copied final prompt to clipboard!')
// Copy Link -> navigator.clipboard.writeText(`${window.location.origin}/p/${prompt.publicSlug}`)
//   + toast.success('Link copied to clipboard'), catch -> toast.error on failure
```

**F. Owner share URL — `PromptForm.tsx` + edit page**
`PromptForm` accepts an optional `publicSlug`; when `isPublic && publicSlug` are both set it renders a read-only `${origin}/p/${publicSlug}` field with a Copy button + success toast. The edit page passes the loaded prompt's `publicSlug` through so the URL appears once the prompt is public and saved.

## 7. Development Plan

1. **Schema (additive):** Add `publicSlug: v.optional(v.string())` and `.index('by_publicSlug', ['publicSlug'])` to `convex/schema.ts`; run `pnpm run convex:gen`. Do not alter existing fields or indexes.
2. **Slug service (`convex/slugs.ts`):** Implement `generateUniqueSlug(db, title)` as an Effect v4 generator (idiomatic `Effect.gen` + `Effect.tryPromise`, 5 retries + `Date.now().toString(36)` fallback, empty-title -> `prompt` base). **tdd:** add a small `convex/slugs.test.ts` (vitest + convex-test) asserting retry-on-collision and that the timestamp fallback is reached after 5 collisions; pure base-slug normalisation covered by inline `assert` checks.
3. **Wire slugs into writes (`convex/authed/prompts.ts`):** In `create`, generate a slug after the quota check when `isPublic`; in `update`, generate only on private->public with no existing slug, otherwise preserve. Patch `publicSlug` alongside the existing fields.
4. **Public read (`convex/public/prompts.ts`):** Implement `getBySlug` as a plain `query` returning the `PublicPromptDTO` (explicit allowlist — no `userId`/email/`clerkId`/`polarCustomerId`). **tdd:** add `convex/public-prompts.test.ts` asserting the DTO shape strips internal fields and that a private prompt (and a missing slug) both resolve to `null`.
5. **Domain language (domain-modeling):** Add **Public Slug** ("the URL-safe, unique, stable identifier for a public prompt") and **Public Prompt DTO** ("the unauthenticated-safe projection of a prompt + author") to the Domain Glossary in `docs/CONTEXT.md`.
6. **Public route (`app/(public)/p/[slug]/page.tsx`):** Add `generateMetadata` (title/description/OpenGraph/Twitter from the slug) and render `<PublicPromptClient slug={slug} />`. Confirm `proxy.ts` is unchanged (`/p` stays public).
7. **Public client (`components/prompts/PublicPromptClient.tsx`):** Build the page reusing `OpenInAIButton`, `PromptPreview`, `DynamicFields` (variant `"use"`), `PromptNotFound`, `interpolateVariables`, `flattenFormValues`. Loading -> skeleton; `null` -> `PromptNotFound` ("This prompt doesn't exist or is no longer public."). **design-taste-frontend:** match the owner "use" page visual language (two-column grid, card system, slate palette, same Copy/`OpenInAIButton` affordance) without looking templated — add an author header (avatar + name + category) and a Copy Link button.
8. **Owner share affordance:** Add an optional `publicSlug` prop to `PromptForm`; render a read-only share URL (`${origin}/p/${publicSlug}`) with a Copy button + toast when `isPublic && publicSlug`. Update `app/(authed)/prompt/[id]/edit/page.tsx` to pass the loaded prompt's `publicSlug` into `PromptForm`.
9. **Verify:** `pnpm run convex:gen`, then `pnpm run lint`, then `pnpm run typecheck`; `pnpm run test:run` for the two new test files. Manual: an unauthenticated visitor opens `/p/[slug]`, fills dynamic fields, copies, and opens in any of the 8 providers; a toggled-private prompt returns not-found; an existing public prompt with no slug stays owner-only (backfill out of scope — noted as a follow-up).
