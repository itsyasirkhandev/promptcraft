# Public Slug Sharing Specification

## 1. Problem Statement

Users can already mark a prompt as public (`isPublic: true`) and pick a category, but a "public" prompt currently has no public address. The only way to open a prompt is the owner-only `/prompt/[id]/use` route, which sits behind Clerk auth (`proxy.ts` protects `/prompt(.*)`). A non-owner cannot view, fill, copy, or run a public prompt at all.

This makes it impossible to:

* Share a prompt by link.
* Let a visitor fill in a template's dynamic fields and generate the final prompt.
* Let a visitor copy the generated prompt or open it directly in their AI tool of choice.

**Solution:** Introduce a stable, URL-safe **public slug** for every public prompt. Toggling `isPublic` on generates a unique slug derived from the title and stores it on the prompt document. The slug powers a new unauthenticated route — `/p/[slug]` — that renders the prompt the same way the owner "use" page does: dynamic-field inputs, live preview, Copy, and `OpenInAIButton`. The owner sees the shareable URL in the prompt form and can copy it to share.

This mirrors the reference implementation at `I:\promptamist` (see `convex/slugs.ts`, `convex/publicPrompts.ts`, `app/p/[slug]/page.tsx`, `src/components/prompts/PublicPromptClient.tsx`), adapted to this project's Effect v4 + Convex + Clerk stack.

---

## 2. Functional Requirements

The system should:

* **Generate a unique public slug** when a prompt is marked public for the first time, derived from the prompt title (lowercased, non-alphanumerics collapsed to `-`, leading/trailing `-` trimmed) with a short random suffix for uniqueness.
* **Store the slug** on the prompt document in a new `publicSlug` field, indexed for unique lookup.
* **Assign the slug in `create` and `update` mutations**: when `isPublic` transitions to `true` and no slug exists, generate one; otherwise keep the existing slug.
* **Keep the slug stable across edits**: editing a public prompt's title or content must NOT regenerate the slug — shared links remain valid.
* **Preserve the slug when toggled back to private**: the slug stays on the document, but the public route returns "not found" for it until the prompt is made public again (a private prompt must never leak via its old slug).
* **Expose an unauthenticated public read** that fetches a prompt by slug and returns only public-safe fields (no `userId`, no author email — only author `name` and `avatarUrl`).
* **Render a public page at `/p/[slug]`** that, for any visitor (signed-in or not):
  * Shows the prompt title, author name + avatar, tags, and category.
  * For templated prompts (`templateMode: true`), renders the dynamic-field inputs and a live preview that interpolates the template.
  * For static prompts, renders the content directly.
  * Provides a **Copy** button that copies the generated prompt to the clipboard.
  * Provides the **`OpenInAIButton`** (existing, reused as-is) to copy + open the generated prompt in ChatGPT / Claude / Cursor / Zed / T3 Chat / Grok / Perplexity / v0.
  * Provides a **Copy Link** button to copy the share URL itself.
* **Show the shareable URL in the prompt form** (Create and Edit) when `isPublic` is on and a `publicSlug` exists, with a Copy button.
* **Reject slug collisions** at write time via the `by_publicSlug` index, retrying slug generation up to 5 times before falling back to a timestamp-suffixed slug guaranteed unique within the deployment.
* **Respect the existing Hobby quota** (10 public prompts) — no change to `enforceHobbyQuota`, but slug generation happens only for prompts that pass the quota check.

---

## 3. Inputs and Outputs

### 3.1 Mark a prompt public (Create)

* **INPUT:** User toggles "Public Prompt" on in `/prompt/create`, fills required fields, and submits.
* **SYSTEM BEHAVIOR:**
  1. Client Zod validation runs (`promptSchema`); `isPublic` requires `category`.
  2. `api.authed.prompts.create` runs `validatePrompt` and `enforceHobbyQuota({ checkTotal: true, markPublic: true })`.
  3. Because `isPublic` is true and there is no existing slug, `generateUniqueSlug(ctx, title)` produces a unique candidate.
  4. The prompt is inserted with `publicSlug` set.
  5. The created prompt document (including `publicSlug`) is returned to the client.
  6. On success, the user is redirected to `/dashboard/prompts`. (Slug display happens on the Edit page, which loads the prompt via `api.authed.prompts.get`.)

### 3.2 Mark an existing prompt public (Edit)

* **INPUT:** User opens `/prompt/[id]/edit`, toggles "Public Prompt" on, and saves.
* **SYSTEM BEHAVIOR:**
  1. `api.authed.prompts.update` verifies ownership, runs validation, runs `enforceHobbyQuota({ checkTotal: false, markPublic: !prompt.isPublic })`.
  2. If the prompt had no `publicSlug` (was private) and `isPublic` is now true, `generateUniqueSlug(ctx, title)` runs and the slug is patched onto the document.
  3. If the prompt already had a `publicSlug`, it is preserved (no regeneration — even if the title changed).
  4. The updated prompt (including `publicSlug`) is returned.

### 3.3 Visit a public slug

* **INPUT:** A visitor (authenticated or not) navigates to `/p/[slug]`.
* **SYSTEM BEHAVIOR:**
  1. `proxy.ts` does NOT match `/p` (it protects only `/dashboard` and `/prompt`), so Clerk does not intercept the request.
  2. The route's server component derives a human-readable title from the slug for `<head>` metadata (`generateMetadata`).
  3. The client component calls the new unauthenticated query `api.public.prompts.getBySlug` with `{ slug }`.
  4. The backend looks up the prompt by `by_publicSlug` index. If not found, or if `isPublic !== true`, returns `null`.
  5. If found and public, returns a public-safe DTO (title, content, tags, templateMode, templateFields, category, publicSlug, `_creationTime`, and author `{ name, avatarUrl }` — never `userId` or email).
  6. The page renders: header (title, author, tags), dynamic-field inputs (if templated), live `PromptPreview`, Copy, `OpenInAIButton`, and Copy Link.
  7. While the query is loading, a skeleton is shown. If the result is `null`, the `PromptNotFound` component is shown with a "not public / no longer available" message.

### 3.4 Copy the generated prompt

* **INPUT:** Visitor clicks **Copy** on `/p/[slug]`.
* **SYSTEM BEHAVIOR:** `navigator.clipboard.writeText(generatedPrompt)`; success toast "Copied final prompt to clipboard!". (Mirrors the owner use page's existing copy handler.)

### 3.5 Open in an AI provider

* **INPUT:** Visitor clicks the primary button or a dropdown item in `OpenInAIButton`.
* **SYSTEM BEHAVIOR:** The existing `OpenInAIButton` copies the generated prompt, toasts success, URL-encodes it, and `window.open`s the provider URL in a new tab (or `window.location.href` for the `zed://` scheme). No new component is built.

### 3.6 Copy the share link (owner)

* **INPUT:** Owner clicks **Copy** next to the share URL shown in the prompt form, or **Copy Link** on the public page.
* **SYSTEM BEHAVIOR:** `navigator.clipboard.writeText(`${origin}/p/${publicSlug}`)`; success toast "Link copied to clipboard".

---

## 4. Constraints

* **Schema (Additive only):** Add `publicSlug: v.optional(v.string())` and a `.index('by_publicSlug', ['publicSlug'])` to the `prompts` table. Do not alter existing fields or indexes. Existing prompts (public without a slug) will have `publicSlug = undefined`; they must remain functional on the owner use page and continue to count toward the public quota. A one-time backfill is out of scope for this spec (see Edge Cases).
* **Slug format:** `baseSlug` from title via `/[^a-z0-9]+/g → '-'`, trim leading/trailing `-`, then append `-${random6}` where `random6 = Math.random().toString(36).substring(2, 8)`. No length cap on `baseSlug` (title is already capped at 300).
* **Uniqueness (app-level):** Convex does not enforce a unique constraint on insert. Uniqueness is guaranteed by checking `by_publicSlug` (a `.unique()`-style indexed lookup returning at most one doc) and retrying up to 5 times; a `Date.now().toString(36)` suffix is the deterministic fallback.
* **Effect v4:** Slug generation is an `Effect.gen` generator yielding `Effect.tryPromise` for the indexed uniqueness check (matching the pattern already used in `convex/authed/prompts.ts`). It runs inside the existing `effectAuthedMutation` handlers for `create` and `update`.
* **Public read must NOT be authed:** The project convention ("client-facing functions use `convex/authed/`") cannot apply to an unauthenticated read. This spec introduces a new `convex/public/prompts.ts` file using Convex's plain `query` (no `effectAuthedQuery`), for the single public lookup. This is a deliberate, minimal convention extension, not a general pattern.
* **Public DTO safety:** The public query must never return `userId`, `tokenIdentifier`, `clerkId`, `email`, `polarCustomerId`, or any internal field. It returns a dedicated `PublicPromptDTO` containing only: `title`, `content`, `tags`, `templateMode`, `templateFields`, `category`, `publicSlug`, `_creationTime`, and a nested `author: { name, avatarUrl }`.
* **No proxy change:** `/p/[slug]` lives under the existing `(public)` route group and is not matched by `isProtectedRoute` in `proxy.ts`. Do not add `/p` to the protected matcher.
* **Reuse existing UI:** The public page must reuse `components/prompts/OpenInAIButton.tsx`, `components/prompts/PromptPreview.tsx`, `components/prompts/use/DynamicFields.tsx` (or its input pattern), `PromptNotFound`, and `lib/variables.ts` (`interpolateVariables`, `flattenFormValues`). Do not duplicate these.
* **No new dependencies:** Everything needed (`effect`, `zod`, `convex`, `@iconify/react`, `sonner`, Phosphor icons) is already installed. Do not add packages.
* **Run checks after Convex changes:** `pnpm run convex:gen`, then `pnpm run lint`, then `pnpm run typecheck`.

---

## 5. Edge Cases and Error Handling

* **Slug collision on insert:** Retry generation up to 5 times via the `by_publicSlug` index; on the 6th attempt use `${baseSlug}-${Date.now().toString(36)}`. Collisions after the random suffix are astronomically unlikely (36^6 space) but the check makes it correct.
* **Prompt toggled private after being public:** The `publicSlug` is retained on the document. The public query MUST return `null` whenever `prompt.isPublic !== true` so the old link shows the "not found" state instead of leaking private content. This is a security boundary, not an optimization.
* **Visitor opens `/p/[slug]` for a non-existent slug:** Public query returns `null`; page renders `PromptNotFound` with message "This prompt doesn't exist or is no longer public."
* **Visitor opens `/p/[slug]` for a slug that exists but `isPublic === false`:** Same as above — return `null`, render not-found. No distinction in the UI between "missing" and "private" (do not leak existence).
* **Existing public prompts created before this feature (have `isPublic: true` but `publicSlug = undefined`):** They continue to work on the owner use page and in the dashboard. They are NOT reachable at `/p/[slug]` (no slug). Backfilling slugs for them is explicitly out of scope for this spec; owners can regenerate a slug by editing and re-saving with `isPublic` on (the update handler generates a slug when none exists). Note this as a follow-up, not a blocker.
* **Title edited on a public prompt:** Slug is NOT regenerated. The share link keeps working and keeps pointing at the same prompt. (A future "regenerate slug" affordance is out of scope.)
* **Empty/whitespace title produces an empty base slug:** Fallback to `prompt-${random6}` (i.e. if `baseSlug` is empty after normalization, use the literal string `prompt` as the base). Prevents slugs that start with `-`.
* **Clipboard API blocked/fails (Copy / Copy Link):** Catch and toast an error, mirroring the existing handler in `app/(authed)/prompt/[id]/use/page.tsx`. Do not throw to the user.
* **Hobby user at the 10-public-prompt quota:** `enforceHobbyQuota` already rejects the `create`/`update` with `PlanLimitError` BEFORE slug generation runs, so no orphaned slug is generated. Keep the ordering: quota check first, then slug generation, then insert/patch.
* **`OpenInAIButton` with empty generated content:** The existing component already toasts "No prompt content to copy." and does not open a link. No change needed.
* **Unauthenticated mutation attempt on the public query path:** Not possible — the public query is read-only (`query`, not `mutation`) and returns only a DTO.

---

## 6. Acceptance Criteria

The feature is considered complete if:

* `convex/schema.ts` adds `publicSlug: v.optional(v.string())` and `.index('by_publicSlug', ['publicSlug'])` to the `prompts` table; `pnpm run convex:gen` succeeds.
* `convex/slugs.ts` exists and exports `generateUniqueSlug(ctx, title)` as an Effect generator (5 retries + timestamp fallback), using the `by_publicSlug` index for collision checks.
* `convex/authed/prompts.ts` `create` assigns a `publicSlug` when `isPublic` is true; `update` assigns one when transitioning private→public and none exists; both preserve an existing slug otherwise. Quota is checked before slug generation.
* `convex/public/prompts.ts` exists and exports `getBySlug` as a plain (non-authed) `query` returning a `PublicPromptDTO` (or `null` when not found / not public). It never returns `userId` or author email.
* `app/(public)/p/[slug]/page.tsx` exists with `generateMetadata` (title/description/OpenGraph/Twitter derived from the slug) and renders a `PublicPromptClient` component.
* `components/prompts/PublicPromptClient.tsx` renders: title, author (name + avatar), tags, dynamic-field inputs for templated prompts (with defaults from template fields where applicable), live `PromptPreview`, **Copy**, **`OpenInAIButton`**, and **Copy Link**. Loading → skeleton; null → `PromptNotFound`.
* An unauthenticated visitor can open `/p/[slug]`, fill dynamic fields, copy the generated prompt, and open it in any of the 8 supported AI providers.
* `app/(authed)/prompt/_components/PromptForm.tsx` accepts an optional `publicSlug` prop and, when `isPublic && publicSlug` are both set, displays a read-only share URL (`${origin}/p/${publicSlug}`) with a Copy button and success toast.
* `app/(authed)/prompt/[id]/edit/page.tsx` passes the loaded prompt's `publicSlug` into `PromptForm`; the share URL appears once the prompt is public and saved.
* `proxy.ts` is unchanged (`/p` remains public).
* A private prompt (or a toggled-back-to-private prompt) is NOT reachable at its slug (public query returns `null`).
* `pnpm run lint` and `pnpm run typecheck` pass after the changes.

---

## 8. Relevant MCPs, Skills, and Tools

* **effect-ts:** Used to implement `generateUniqueSlug` as an idiomatic Effect v4 generator (`Effect.gen` + `Effect.tryPromise` + `Schema.TaggedErrorClass` for any slug errors) consistent with the existing `convex/authed/prompts.ts` pattern.
* **design-taste-frontend:** Applied to the `PublicPromptClient` and the form's share-URL affordance so the public page matches the existing owner "use" page visual language without looking templated.
* **tdd:** Used to validate slug generation uniqueness/retry/fallback behavior and the public DTO field-stripping (one small assert-based check for slug collisions and DTO shape).
* **domain-modeling:** Adds two terms to the project's ubiquitous language — **Public Slug** (the URL-safe, unique, stable identifier for a public prompt) and **Public Prompt DTO** (the unauthenticated-safe projection of a prompt + author) — to be reconciled with `docs/CONTEXT.md` Domain Glossary during implementation.
* **Reference implementation:** `I:\promptamist` (`convex/slugs.ts`, `convex/publicPrompts.ts`, `convex/dto.ts`, `app/p/[slug]/page.tsx`, `src/components/prompts/PublicPromptClient.tsx`, `src/components/prompts/OpenInAIButton.tsx`) serves as the behavior reference; this spec adapts it to this project's Effect v4 helpers (`effectAuthedMutation`/`AuthedContext`/`ConvexDB`) and existing UI components.
