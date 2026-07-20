# Public Marketplace Specification

## 1. Problem Statement

Users can already mark a prompt as public (`isPublic: true`) and every public prompt now has a shareable `/p/[slug]` page (spec `06-public-slug-sharing`). But there is **no way to discover public prompts**. A visitor has to know a direct `/p/[slug]` link in advance — there is no browsable directory.

This makes it impossible to:

* Browse the community's public prompts in one place.
* Filter public prompts by category.
* Search public prompts by title / description / tags.
* Sort public prompts (newest first or A–Z) and share a filtered view by URL.

**Solution:** Introduce a public, unauthenticated **Marketplace** page at `/marketplace` that lists every public prompt (`isPublic: true`) as cards, with the **exact same filtering, sorting, and URL-state behavior** as the reference implementation at `I:\promptamist` (`src/app/marketplace/page.tsx`, `src/components/marketplace/MarketplaceSearch.tsx`, `convex/publicPrompts.ts`, `convex/dal/prompts.dal.ts`), but adapted to this project's data model and categories.

This is a faithful port of the reference's marketplace *listing/search/sort/URL-state* behavior — not a copy of its marketing/SEO/FAQ copy (see §4, out of scope). The categories, DTO shape, schema, icon set, and UI components are this project's own (see §2, §3, §4).

---

## 2. Functional Requirements

The system should:

* **Render a public `/marketplace` route** (unauthenticated) under the existing `app/(public)` route group, with a page header ("Public Marketplace" + subtitle) and a `MarketplaceSearch` client component.
* **List every public prompt** (`isPublic: true`), bounded to a sane default page size (matching the reference: `take(50)`), via a new unauthenticated Convex query.
* **Expose three URL state parameters** with `nuqs`, identical in name, parser, default, and history behavior to the reference (`src/components/marketplace/MarketplaceSearch.tsx`):
  * `q` — free-text search string. `parseAsString.withDefault('')`. Options: `{ history: 'replace', limitUrlUpdates: throttle(50) }`. (Reference: `MarketplaceSearch.tsx`.)
  * `category` — active category id. `parseAsString.withDefault('all')`. Options: `{ history: 'push' }`.
  * `sort` — sort order. `parseAsStringLiteral(['recent', 'a-z']).withDefault('recent')`. Options: `{ history: 'push' }`.
* **Debounce the search query by 300ms** before it reaches the Convex query (mirrors the reference's `useDebounce(q, 300)` + `isSearchPending` spinner), so a server query fires once per typing pause, not per keystroke.
* **Provide category tabs** rendered as a horizontal, scrollable row of pill buttons with an icon + label. The active tab is `category`. The tabs are **this project's 7 categories + an "All" tab** (see §3.1), not the reference's `general/productivity/development/…` set.
* **Provide a Sort dropdown** (`recent` → "Recently Published", `a-z` → "A-Z") and a **Reset Filters** button that clears `q`, `category`, and `sort` back to defaults (sets each to `null`, which nuqs resolves to the `withDefault` value and clears the URL param).
* **Render one `MarketplacePromptCard` per prompt** in a responsive auto-fill grid (matching the reference's `@container` + `grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-6`).
* **Card content:** category badge (icon + label), title (`line-clamp-2`), author (avatar + name, "Anonymous" fallback), creation date, content preview (`line-clamp-4`), tags, a Template/Static badge (`templateMode`), and action buttons.
* **Card actions:** a **Copy** button that copies `prompt.content` to the clipboard with a success toast; a **Use** button (shown for `templateMode` prompts that have a `publicSlug`) that opens `/p/[publicSlug]` in a new tab — reusing the existing public page from spec `06` (which renders dynamic fields, live preview, Copy, and `OpenInAIButton`). For static prompts only the Copy button is shown, matching the reference.
* **Show a loading state** ("Loading prompts…" with spinner) while the Convex query is `undefined`, an **empty state** when results are `[]` (with per-category messaging), and a **search-pending** spinner in the search input while `q !== debouncedQuery`.
* **Replicate the reference backend filtering/sorting exactly** in a new `listPublicPrompts` query (see §3.3): full-text search when `q` is present, A–Z via an index when `sort=a-z`, newest-first (`desc` by `_creationTime`) otherwise, and category filtering applied on top.
* **Never leak private/internal data:** the list query returns a strict `PublicPromptDTO` projection (no `userId`, no author email, no `tokenIdentifier`/`clerkId`/`polarCustomerId`). It returns `null`/omits any prompt that is not `isPublic: true`.

---

## 3. Inputs and Outputs

### 3.1 Category set (this project's data — different from the reference)

The reference hard-codes `general, productivity, development, marketing, creative, education`. This project's public-prompt categories are defined in `convex/authed/validation.ts` (`allowedCategories`) and rendered by `components/prompts/CategorySelector.tsx` + the dashboard's `CATEGORY_MAP`. The marketplace uses **these** values plus an `all` sentinel:

| id           | label                  | icon (Phosphor)     |
| ------------ | ---------------------- | ------------------- |
| `all`        | All                    | (layout/squares)   |
| `coding`     | Coding & Tech          | `Code`              |
| `writing`    | Writing & Content      | `PencilSimple`     |
| `marketing`  | Marketing & Growth     | `Megaphone`        |
| `analysis`   | Data & Analysis        | `ChartBar`         |
| `design`     | Design & Art           | `Palette`          |
| `education`  | Education & Learning    | `GraduationCap`    |
| `other`      | General / Other        | `Globe`            |

Because `validateCategory` (validation.ts) already **requires** a category for every public prompt, every public prompt is guaranteed to carry one of the 7 category values — so category filtering always has a real value to match against (no `?? 'general'` fallback is needed, but the query tolerates a missing category defensively).

### 3.2 User interaction: search / filter / sort / reset

**INPUT:** A visitor types into the search box, clicks a category tab, changes the sort, or clicks Reset.

**EXPECTED SYSTEM BEHAVIOR:**

* Typing updates the `q` URL param (throttled at 50ms, `history: replace` so the back button isn't polluted). The displayed input value follows `q` immediately (responsive). A 300ms debounce gates the value passed to the Convex `useQuery`; while `q !== debouncedQuery` the search input shows a spinner.
* Clicking a category tab sets `category` (`history: push` — navigable). The active tab is visually highlighted.
* Changing the sort sets `sort` (`history: push`).
* Reset sets `q`, `category`, and `sort` to `null` (nuqs resolves each to its `withDefault` and strips the URL params).
* The Convex query re-runs reactively whenever `debouncedQuery`, `category`, or `sort` changes.

### 3.3 Backend query: `api.public.prompts.listPublicPrompts`

A new **unauthenticated** `query` added to `convex/public/prompts.ts` (the same file as the existing `getBySlug` from spec `06`, which is left untouched). The entry point is a plain `query` (it cannot be `effectAuthedQuery` — no Clerk identity for an anonymous visitor), but its **handler is Effect-based** via `runEffect(Effect.gen(...).pipe(Effect.provideService(ConvexDB, { db: ctx.db })))`, using `Effect.tryPromise` for each `ctx.db` call and the `ConvexDB` service for `db` — matching the reference `runEffect` pattern and the project `convex/effectHelpers.ts`. Args and behavior mirror the reference `convex/publicPrompts.ts` → `convex/dal/prompts.dal.ts` `listPublicPromptsWithAuthors`:

```
args: {
  searchQuery: v.optional(v.string()),
  category:    v.optional(v.string()),
  sortBy:      v.optional(v.union(v.literal('recent'), v.literal('a-z'))),
}
```

Filtering/sorting logic (faithful port of `prompts.dal.ts`):

* **If `searchQuery` present:**
  * `withSearchIndex('search_all', q => q.search('searchableText', searchQuery).eq('isPublic', true)).take(50)`.
  * If `category && category !== 'all'`: in-memory filter `p.category === category`.
  * If `sortBy === 'a-z'`: in-memory sort `a.title.localeCompare(b.title)`.
* **Else (no search):**
  * If `sortBy === 'a-z'`: `withIndex('by_isPublic_and_title', q => q.eq('isPublic', true)).order('asc')`; if a specific category, iterate with `for await` and push matches until 50 (else `.take(50)`).
  * Else (`recent`, the default): `withIndex('by_isPublic', q => q.eq('isPublic', true)).order('desc')`; same category `for await` push-until-50 behavior when a specific category is set.
* Then resolve each prompt's author (`ctx.db.get(prompt.userId)`) and map to a `PublicPromptDTO` (see §3.4).

> ⚠️ This logic requires two schema additions that the reference has but this project currently lacks (see §4): a `searchableText` field + `search_all` search index, and a `by_isPublic_and_title` index. The existing `by_isPublic` index already covers the `recent` path. These additive schema changes are part of this spec.

### 3.4 `PublicPromptDTO` (list projection)

The list query returns an array of DTOs — a strict projection, consistent with the security boundary already established by `getBySlug` in spec `06` (never `userId`, never author email). List-view needs enough to render the card and link to `/p/[slug]`:

```
{
  _id: Id<'prompts'>,
  _creationTime: number,
  title: string,
  content: string,        // needed for line-clamp preview + Copy
  tags: string[],
  templateMode: boolean,  // Template vs Static badge + whether to show "Use"
  category?: string,
  publicSlug?: string,    // powers the "Use" link to /p/[slug]
  author: { name: string; avatarUrl?: string } | { name: 'Anonymous' }
}
```

No `templateFields` are returned (the card does not render dynamic fields). `author` mirrors `getBySlug`'s author shape exactly (`{ name, avatarUrl }`, "Anonymous" when the user row is missing).

### 3.5 Card "Use" / "Copy"

* **INPUT:** Visitor clicks **Copy**.
  * **BEHAVIOR:** `navigator.clipboard.writeText(prompt.content)`; toast "Prompt copied to clipboard!"; show a "Copied" state for 2s. (Mirrors reference `MarketplacePromptCard.handleCopy`.)
* **INPUT:** Visitor clicks **Use** (only rendered when `templateMode && publicSlug`).
  * **BEHAVIOR:** `window.open('/p/' + publicSlug, '_blank')` — opens the existing public page (spec `06`) which handles dynamic fields, live preview, Copy, and `OpenInAIButton`. (Mirrors reference `handleUse`.)

---

## 4. Constraints

* **New dependency — `nuqs`:** This project does **not** currently have `nuqs` installed and the root `app/layout.tsx` has **no `NuqsAdapter`**. This feature requires it (the user explicitly asked for the same nuqs URL state as the reference). Add it with `pnpm add nuqs` (do **not** hand-edit `package.json`). Wrap the app in `<NuqsAdapter>` from `nuqs/adapters/next/app` inside the existing `app/layout.tsx` (place it inside `ConvexClientProvider`, around `children` + `Toaster`, matching the reference layout). This intentionally revises the "No new dependencies" constraint from spec `06` — that spec did not need URL state; this one does.
* **Route placement:** `app/(public)/marketplace/page.tsx` (route `/marketplace`), inside the existing `(public)` route group alongside `p/[slug]`, `privacy`, `terms`. `proxy.ts` is **unchanged** — `/marketplace` is public, just like `/p`.
* **Backend convention (unauthenticated entry, Effect inside):** `convex/public/prompts.ts` holds unauthenticated public reads as a **plain `query`** (the entry point cannot be `effectAuthedQuery`, which requires a Clerk identity). To honor the project "use effect v4 for all backend code" guideline, `listPublicPrompts`'s handler is **Effect-based**: it wraps its logic in `Effect.gen`, uses `Effect.tryPromise` for each `ctx.db` operation, pulls `db` from the `ConvexDB` service, and runs via the existing `runEffect` helper — `runEffect(Effect.gen(...).pipe(Effect.provideService(ConvexDB, { db: ctx.db })))` (same pattern the reference uses, already exported by `convex/effectHelpers.ts`). This keeps all public read-only queries in one file alongside `getBySlug` (spec `06`), which is left **untouched** ("don't touch unrelated code").
* **Schema changes (additive only):** Add to the `prompts` table:
  * `searchableText: v.optional(v.string())`
  * `.searchIndex('search_all', { searchField: 'searchableText', filterFields: ['isPublic'] })`
  * `.index('by_isPublic_and_title', ['isPublic', 'title'])`
  Do **not** alter existing fields or indexes. `by_isPublic` already exists (used by the `recent` path).
* **Keep `searchableText` populated:** `convex/authed/prompts.ts` `create` and `update` must set `searchableText` to a denormalized, lowercased blob of the prompt's searchable text (title + content + tags), mirroring the reference's approach, so full-text search works for newly-created/edited public prompts. (Exact composition: `${title} ${content} ${tags.join(' ')}`, lowercased — simple and matches the reference's single-field FTS intent.)
* **No backfill needed (dev environment):** This is a dev Convex deployment and the database will be wiped before launch, so there are no pre-existing public prompts to backfill. Every prompt created after this change has `searchableText` populated by the updated `create`/`update` mutations, so full-text search works immediately for all data. Do NOT add a backfill mutation — "simplest solution first." (See §5.)
* **Icons:** Use **`@phosphor-icons/react`** for category tabs and card badges (matching this project's existing `CategorySelector.tsx` / dashboard `CATEGORY_MAP`), **not** the reference's `@iconify/react`. Phosphor is already installed. This keeps the marketplace visually consistent with the rest of the app.
* **UI components:** Reuse this project's shadcn components — `components/ui/card` (`Card`, `CardContent`, `CardHeader`, `CardTitle`), `components/ui/input`, `components/ui/button`, `components/ui/select` — matching the dashboard prompts page. Do **not** import the reference's `TextureCard`.
* **Debounce hook:** This project has no `use-debounce` hook. Add a small `hooks/use-debounce.ts` (a `useState` + `useEffect` timer mirroring the reference's `useDebounce(value, 300)`). (Alternative: React `useDeferredValue` — but to match the reference's `isSearchPending` spinner semantics, the explicit debounce hook is the faithful port.)
* **Bounded query:** Follow the Convex guideline "return a bounded collection." Use `.take(50)` (matching the reference default). No pagination UI in scope.
* **No Convex `.filter()` operator:** Category filtering is done in-memory on the already-bounded `.take(50)` array (or via `for await` push-until-limit), exactly as the reference does — never the Convex query `.filter()` method.
* **Run checks after Convex changes:** `pnpm run convex:gen`, then `pnpm run lint`, then `pnpm run typecheck`.

---

## 5. Edge Cases and Error Handling

* **No public prompts exist at all:** Query returns `[]`; render the empty state with the "All" message ("No prompts found — Try adjusting your search terms or keywords.").
* **Category selected but has no prompts:** Query returns `[]`; render the per-category empty message ("No prompts in {Category Label} yet — Be the first to share a prompt in this category and contribute to the community!"), using the selected category's icon. (Mirrors reference.)
* **Search returns nothing:** Same "No prompts found" empty state with the active category's icon (or the search icon when `all`).
* **Visitor opens a category link directly (e.g. `/marketplace?category=coding&sort=a-z`):** nuqs hydrates `category` and `sort` from the URL on first render; the tabs/select reflect it and the query runs with those values. Shareable filtered URLs work out of the box (this is the whole point of "same URL state").
* **Prompt missing `searchableText` (should not happen post-wipe):** With the dev DB wiped, every prompt is created via the updated `create` mutation and thus always has `searchableText`, so this case does not arise in practice. Defensively, a prompt whose `searchableText` is `undefined` is simply not returned by a *search* query (it is not in the `search_all` index) but IS still returned by the no-search `recent`/`a-z` browse paths (those use `by_isPublic` / `by_isPublic_and_title`, not the search index) — so it remains browsable even if its search blob is missing.
* **Private / toggled-private prompt:** The list query only ever returns `isPublic === true` prompts (the `eq('isPublic', true)` filter in every branch). A prompt toggled private disappears from the marketplace immediately, consistent with spec `06`'s public route returning `null`.
* **Prompt with missing author:** `author` falls back to `{ name: 'Anonymous' }` (card shows "Anonymous" + the fallback avatar), matching `getBySlug`.
* **Clipboard API blocked (Copy):** Catch and toast an error ("Failed to copy prompt"). Do not throw to the user. (Mirrors reference.)
* **`Use` clicked on a prompt whose `publicSlug` is missing:** The button is only rendered when `publicSlug` exists, so this is unreachable; defensively, no-op if `publicSlug` is falsy.
* **Very long search string:** Passed straight to `search('searchableText', …)`; Convex FTS handles it. No client truncation needed.
* **Rapid typing:** `throttle(50)` on the URL + 300ms debounce on the query means at most one in-flight query per pause; no request storm.
* **Deep link with an unknown `category` value (e.g. `?category=foo`):** `parseAsString` accepts any string; the tabs simply won't highlight any of them and the query filters by `foo` (returns `[]` → per-category empty state using the fallback search icon). Acceptable; matches reference behavior (reference does not validate `category` against the literal set either — it uses `parseAsString`, not a literal parser, for `category`).

---

## 6. Acceptance Criteria

This feature is considered complete if:

* `nuqs` is added via `pnpm add nuqs`, and `app/layout.tsx` wraps the app in `<NuqsAdapter>` from `nuqs/adapters/next/app` (inside `ConvexClientProvider`).
* `app/(public)/marketplace/page.tsx` exists, is unauthenticated, renders a page header + `<MarketplaceSearch />`, and exposes basic `metadata` (title/description). `proxy.ts` is unchanged.
* `components/marketplace/MarketplaceSearch.tsx` is a `'use client'` component using `nuqs` with **exactly** these three params (names, parsers, defaults, options matching the reference):
  * `q` — `parseAsString.withDefault('').withOptions({ history: 'replace', limitUrlUpdates: throttle(50) })`
  * `category` — `parseAsString.withDefault('all').withOptions({ history: 'push' })`
  * `sort` — `parseAsStringLiteral(['recent', 'a-z']).withDefault('recent').withOptions({ history: 'push' })`
  * and a 300ms debounce before the value reaches the Convex query, with a search-pending spinner.
* The category tabs render **this project's 7 categories + "All"** with Phosphor icons/labels (§3.1); a Sort dropdown (`recent`/`a-z`); and a Reset Filters button that nulls all three params.
* `components/marketplace/MarketplacePromptCard.tsx` renders the card (category badge, title, author, date, content preview, tags, Template/Static badge) with Copy + Use actions, in the reference's responsive auto-fill grid.
* `convex/public/prompts.ts` exports a new `listPublicPrompts` as an unauthenticated **plain `query`** whose **handler is Effect-based** (`runEffect(Effect.gen(...).pipe(Effect.provideService(ConvexDB, { db: ctx.db })))`, `Effect.tryPromise` per db op), with args `{ searchQuery?, category?, sortBy? }` implementing the reference's filtering/sorting (search index → FTS; `by_isPublic_and_title` for A–Z; `by_isPublic` desc for recent; in-memory/`for await` category filtering; `.take(50)`), returning `PublicPromptDTO[]` with no `userId`/email. `getBySlug` is left untouched.
* `convex/schema.ts` additively adds `searchableText` + the `search_all` search index + the `by_isPublic_and_title` index to the `prompts` table; `pnpm run convex:gen` succeeds.
* `convex/authed/prompts.ts` `create` and `update` populate `searchableText` (`title + content + tags`, lowercased) for the prompt being written.
* The dev Convex database is wiped before launch so no pre-existing public prompts lack `searchableText`; no backfill mutation is added (every prompt created via the updated `create` carries `searchableText`).
* An unauthenticated visitor can: open `/marketplace`; see public prompt cards; type to search (debounced, URL updates `q`); click a category tab (URL updates `category`); change sort (URL updates `sort`); click Reset; click **Copy** (clipboard + toast); click **Use** on a template card (opens `/p/[slug]`); and share a filtered URL that reproduces the exact same view on open.
* `pnpm run lint` and `pnpm run typecheck` pass.

---

## 8. Relevant MCPs, Skills, and Tools

* **nuqs:** Used to implement the three URL state params (`q`, `category`, `sort`) with the exact parsers, defaults, and options (`throttle`, `history: replace/push`, `parseAsStringLiteral`) from the reference. The project's installed nuqs skill (`I:\YT projects\.agents\skills\nuqs`) is the source of truth for `NuqsAdapter` setup, `limitUrlUpdates: throttle`, and history options.
* **effect-ts:** Used to implement `listPublicPrompts` idiomatically: the handler is `runEffect(Effect.gen(function* () { const { db } = yield* ConvexDB; ... yield* Effect.tryPromise(() => db.query(...)) }).pipe(Effect.provideService(ConvexDB, { db: ctx.db })))` — Effect v4 `Effect.gen` + `Effect.tryPromise` + `ConvexDB` service, consistent with the existing `convex/authed/prompts.ts` pattern and the `runEffect` helper in `convex/effectHelpers.ts`. The `searchableText` population in `authed/prompts.ts` `create`/`update` is a small addition inside the existing `effectAuthedMutation` handlers, where the same Effect idioms already apply.
* **design-taste-frontend:** Applied to the `MarketplaceSearch` + `MarketplacePromptCard` UI so the marketplace matches this project's existing dashboard card visual language (Phosphor icons, shadcn `Card`, slate palette) rather than copying the reference's `TextureCard`/iconify look.
* **tdd:** Used to test `listPublicPrompts` filtering/sorting (search vs. browse, A–Z vs. recent, category filter, `isPublic`-only boundary, DTO field-stripping) with `convex-test` + `vitest`, matching the existing `convex/public-prompts.test.ts` style.
* **domain-modeling:** Adds/clarifies two ubiquitous-language terms — **Public Marketplace** (the unauthenticated browsable directory of public prompts at `/marketplace`) and **Public Prompt List DTO** (the bounded, author-joined, field-stripped projection returned by `listPublicPrompts`, distinct from the single-prompt `PublicPromptDTO` of spec `06`) — to be reconciled with `docs/CONTEXT.md` during implementation.
* **Reference implementation:** `I:\promptamist` — `src/app/marketplace/page.tsx`, `src/components/marketplace/MarketplaceSearch.tsx`, `src/components/marketplace/MarketplacePromptCard.tsx`, `src/app/layout.tsx` (`NuqsAdapter`), `convex/publicPrompts.ts`, `convex/dal/prompts.dal.ts` (`listPublicPromptsWithAuthors`), `convex/dto.ts` (`toPublicPromptDTO`), `convex/schema.ts` (`searchableText` + `search_all` + `by_isPublic_and_title`). This spec ports the **listing/filter/sort/URL-state** behavior to this project's Effect-Convex-Clerk stack, schema, categories, and Phosphor/shadcn UI — and deliberately excludes the reference's JSON-LD/FAQ/GEO marketing section (out of scope; "simplest solution first").