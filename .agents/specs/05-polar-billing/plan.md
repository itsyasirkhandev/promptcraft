# Polar Billing — Phased Task Breakdown (8 phases)

**Source:** `.agents/specs/05-polar-billing/spec.md`

This file is the executable phased plan derived from the Polar Billing specification. Each phase is a self-contained chunk handoff-able to a subagent, tagged `[Phase X]` in its content. Tasks are also tracked via the `update_plan` tool.

## Dependency & parallelization graph

```
Phase 1  (foundation: schema + env + SDK)
   └─▶ Phase 2  (Polar core: client + provider + lifecycle mapping)
         └─▶ Phase 3  (internal user-sync mutations + customer-sync action + scheduling wiring)
               └─▶ { Phase 4  ∥  Phase 5 }   ← PARALLEL BRANCH
                     │           │
                     ├─▶ Phase 6 (Pricing CTAs + authed plan control)      [after 4]
                     └─▶ Phase 7 (signed-out upgrade continuation)         [after 4, after 6]
                               │
                               └─▶ Phase 8 (consolidated tests + verification) [after 1–7]
```

- **Sequential backbone:** 1 → 2 → 3. Each establishes contracts the next consumes.
- **Parallel pair:** 4 and 5 both start only after 3, touch disjoint files (`convex/authed/billing.ts` vs `convex/http.ts` + `convex/billing/webhooks.ts`), and can run concurrently.
- **Frontend tail:** 6 after 4; 7 after 4 and 6; 8 last.

## Locked assumptions (recorded, not asked)

1. **Env config:** Extend the existing Effect `ServerConfig` service (`convex/services/ServerConfig.ts`) to read + strictly validate the 4 Polar vars via Effect `Config`, fail-closed on missing/invalid `POLAR_SERVER`. Matches the repo's Effect v4 convention; no `NEXT_PUBLIC_*`; no new `convex.config.ts` (YAGNI — repo already routes env through Effect `ServerConfig`).
2. **Polar SDK:** Install current `@polar-sh/sdk` via `pnpm add`. Action files importing it use `"use node";`. Confirm the installed SDK's current `customers` (create/get-by-externalId/list/update), `checkouts.create`, `customerSessions.create`, server selection, and webhook payload/signature APIs during Phase 2 — the reference (`I:\promptamist`) is behavior-only, not copy source.
3. **`plan` remains the sole entitlement field**; Polar IDs/status are server-side only and never returned to unauthenticated clients.
4. **Tests consolidated** in Phase 8. Resolve the Vitest environment for `convex-test` during Phase 8 (repo `vitest.config.ts` uses `jsdom`; Convex guidelines suggest `edge-runtime` — pick edge-runtime for the convex test file via a per-file env annotation or a second config entry, recorded in Phase 8).
5. **Never run `dev` or `build`.** Run `pnpm run convex:gen` after any schema/API change; run `pnpm run lint; pnpm run typecheck; pnpm run test:run` at the end of phases that touch Convex (1, 3, 4, 5) and as the final gate in Phase 8. PowerShell 5 syntax: `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`.

---

## [Phase 1] Foundation: schema, Polar env config, SDK install, codegen

**Files:** `convex/schema.ts`, `convex/services/ServerConfig.ts`, `package.json`, `.env.example`
**Depends on:** nothing (start first)
**Build:**
- `convex/schema.ts` — add to `users` table:
  - `polarCustomerId: v.optional(v.string())`
  - `polarSubscriptionId: v.optional(v.string())`
  - `polarSubscriptionStatus: v.optional(v.string())`
  - `.index("by_polar_customer_id", ["polarCustomerId"])`
  - Keep `plan: v.union(v.literal('hobby'), v.literal('pro'))` unchanged.
- `convex/services/ServerConfig.ts` — extend the service shape with `polarAccessToken`, `polarWebhookSecret`, `polarProductId`, `polarServer` (use `Config.literal('sandbox','production')('POLAR_SERVER')` or `Config.string` + Schema validation that throws on anything other than `sandbox|production`). Fail closed: missing/invalid `POLAR_SERVER` or token must error, never silently fall back. Keep existing `convexPrivateBridgeKey`.
- `pnpm add @polar-sh/sdk` (do NOT hand-edit `package.json`).
- `.env.example` — append a `# Polar (Convex deployment variables, not Next.js)` section documenting `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_PRODUCT_ID`, `POLAR_SERVER=sandbox|production`. State sandbox product `31b0505a-9ff3-4fa0-a370-adf5e6ad3143`. No `NEXT_PUBLIC_`.
**Verify:** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`
**Done when:** schema has the 3 optional fields + index; `ServerConfig` strictly validates Polar env and fails closed; SDK installed; `.env.example` documents all 4 vars; commands pass.

---

## [Phase 2] Polar core: client factory, billing provider, lifecycle mapping (pure)

**Files:** `convex/billing/polarClient.ts`, `convex/billing/provider.ts`, `convex/billing/lifecycle.ts`
**Depends on:** Phase 1
**Build:**
- `convex/billing/polarClient.ts` — `"use node";` factory returning a `Polar` client from `ServerConfig` (accessToken + `server: polarServer`). Throws a typed config error if env invalid.
- `convex/billing/provider.ts` — `"use node";` Effect v4 `PolarBillingProvider` with:
  - `ensureCustomer(clerkId, email, name?) -> polarCustomerId`: read stored `polarCustomerId` first; if none, look up Polar customer by Clerk `externalId`; create only if neither exists (email/name, `externalId: clerkId`, metadata `{ clerkId, convexUserId }`); on Polar external-ID conflict, fetch and reuse the winner. Save the real ID via internal mutation. Never use placeholder IDs; never save to a different user. Empty email -> abort customer creation with a clear error.
  - `createCheckout(polarCustomerId, productId, appSuccessUrl) -> url`: single product, bound customer, validated HTTPS Polar-hosted return (localhost app success URL allowed). Validate returned URL is HTTPS Polar-hosted.
  - `createPortal(polarCustomerId) -> url`: `customerSessions.create`; validate returned `customerPortalUrl` is HTTPS Polar-hosted.
- `convex/billing/lifecycle.ts` — **pure** `mapSubscriptionToPlan(status: string): "pro"|"hobby"` implementing spec 3.6 exactly:
  - `active` (incl. scheduled-to-cancel at period end), `past_due` (retry window), `uncanceled`/reactivated-active → `"pro"`
  - `canceled`, `revoked`, `unpaid` → `"hobby"` immediately
  - Unknown status → preserve existing plan (return `null`/sentinel so caller skips writes) — decide explicitly and record.
- Confirm installed SDK's current API shapes (customers/checkouts/customerSessions/server) before coding; do not copy promptamist's pinned syntax.
**Verify:** `pnpm run lint; pnpm run typecheck` (no `convex:gen` needed — pure module)
**Done when:** provider compiles under Effect v4 with reuse + external-ID conflict recovery + URL validation; lifecycle pure function covers all 8 events with the exact keep/downgrade rules.

---

## [Phase 3] Internal user-sync mutations + customer-sync action + scheduling wiring

**Files:** `convex/users.ts`, `convex/authed/users.ts`, `convex/billing/sync.ts` (new), `convex/private/users.ts` (new internal query)
**Depends on:** Phase 2 (needs `ensureCustomer` + lifecycle mapping)
**Build:**
- `convex/users.ts` — make `upsertFromClerk` convergent: resolve by `clerkId` **then** by reconstructed `tokenIdentifier` before inserting (mirror the by_token + by_clerk_id lookup already used in `getViewer`). **Only the branch that actually inserts** schedules the shared internal `ensurePolarCustomer` action (after the existing welcome-email schedule). On `user.updated` with email/name change, schedule Polar profile sync (only if `polarCustomerId` exists; else schedule `ensurePolarCustomer`). Keep `deleteFromClerk` unchanged (delete Convex user only; never touch Polar).
- `convex/authed/users.ts` — `getOrCreateUser`: only the insert branch schedules the same `ensurePolarCustomer` action. Keep Effect v4 `effectAuthedMutation` shape. Do not change `currentUser`'s return shape beyond what UI needs (`plan` already present).
- `convex/billing/sync.ts` — `"use node";` `ensurePolarCustomer` `internalAction` (calls provider; logs failures, never throws into the signup path) and `syncPolarCustomerProfile` `internalAction` (email/name update on an existing customer).
- `convex/private/users.ts` — `getUserInfoForPolar` `internalQuery` (clerkId → `{ userId, email, name, polarCustomerId, plan }`) used by the provider; `getByPolarCustomerId` `internalQuery` for webhook fallback correlation.
- New internal mutations (in `convex/users.ts` or `convex/billing/sync.ts`): `savePolarCustomerId({ clerkId, polarCustomerId })`, `updateSubscriptionFromPolar({ clerkId, polarCustomerId, polarSubscriptionId, polarSubscriptionStatus, plan })` — resolve by clerkId first, `polarCustomerId` (via `by_polar_customer_id` index) as fallback. Atomic patch only; never insert a user from a webhook.
**Verify:** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`
**Done when:** webhook/sign-in races yield one user and at most one Polar customer; only inserts schedule sync; Polar-down signup still succeeds; email change schedules async Polar profile sync that never blocks the Convex update.

---

## [Phase 4] Authed client actions: checkout + portal (discriminated response)

**Files:** `convex/authed/billing.ts` (new)
**Depends on:** Phase 3 (needs provider + internal queries/mutations). **Parallel with Phase 5.**
**Build:**
- `effectAuthedAction` `generateBillingUrl` (no client args except optionally none — derive identity/product/price entirely server-side):
  - Load canonical user; if `plan === "pro"` → `createPortal` (requires a real stored `polarCustomerId`; Hobby here is impossible by definition but guard anyway) → return `{ destination: "portal", url }`.
  - Hobby → `ensureCustomer` (retryable error if no real customer ID resolves) → `createCheckout` for `POLAR_PRODUCT_ID` → return `{ destination: "checkout", url }`.
  - Never accept customer ID, Clerk ID, email, product ID, plan, price, or success host from the client. Derive success URL from trusted server config / fixed allowlist; never concatenate a client origin.
  - A Hobby user hitting the portal path must receive a safe authorization error and no URL.
- Add a `portalUrl` `effectAuthedAction` too if the UI calls portal separately (decide: single discriminated action vs two actions — spec 3.5 says "separate authenticated Convex action"; implement **two** actions: `generateCheckoutUrl` and `generatePortalUrl`, where `generateCheckoutUrl` routes Pro users to a portal destination). Lock the shared return type `{ destination: "checkout" | "portal", url: string }`.
**Verify:** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`
**Done when:** Hobby→checkout, Pro→portal; portal requires pro + real customer; no client-supplied identity/product/price; returned URLs validated as HTTPS Polar-hosted.

---

## [Phase 5] Polar webhook HTTP route

**Files:** `convex/http.ts`, `convex/billing/webhooks.ts` (new)
**Depends on:** Phase 3 (needs lifecycle mapping + internal mutations). **Parallel with Phase 4** (disjoint files).
**Build:**
- `convex/billing/webhooks.ts` — `verifyPolarWebhook(request, secret)`: read the **exact raw body** (`request.text()`/`.bytes()` before parsing), verify against `POLAR_WEBHOOK_SECRET` using Polar's documented signature headers (`webhook-id`/`webhook-timestamp`/`webhook-signature`; base64 the secret if the installed SDK requires). Reject missing/invalid signature with 4xx and perform **no** writes.
- `convex/http.ts` — add `POST /polar-webhook` `httpAction`:
  1. Verify signature; on fail → 4xx, log safely, return.
  2. Parse; if `subscription.*` event:
     a. Resolve user by Polar customer `externalId`/Clerk metadata first, then stored `polarCustomerId` fallback (via `by_polar_customer_id`). Never trust a browser-supplied ID.
     b. Validate the subscription's product == `POLAR_PRODUCT_ID`; if not → 2xx + safe log, **no** plan change.
     c. Apply `mapSubscriptionToPlan(status)`, persist `polarCustomerId` + `polarSubscriptionId` + `polarSubscriptionStatus` + `plan` atomically via the Phase 3 internal mutation.
     d. Unknown user → safe diagnostic + retryable (non-2xx) response; never create an incomplete user from a webhook.
     e. Transient DB error → non-2xx so Polar retries. Valid no-op (unrelated product) → 2xx after logging.
  3. Replay must be idempotent (same persisted state, no duplicates).
- Do not modify the existing `/clerk-users-webhook` route.
**Verify:** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`
**Done when:** invalid signature rejected; wrong product ignored; all 8 events map correctly; scheduled-cancel/past_due keep Pro, canceled/revoked/unpaid downgrade immediately; replay idempotent; checkout redirects never set plan.

---

## [Phase 6] Frontend: dynamic Pricing CTAs + authed layout plan control

**Files:** `components/templates/nexto/sections/Pricing.tsx`, `app/(authed)/layout.tsx`
**Depends on:** Phase 4 (action contract `{ destination, url }`).
**Build:**
- `Pricing.tsx` — render per spec section 3.8 table for **signed-out / Hobby / Pro / Loading**. Hobby card shows "Current Plan" (non-interactive) for Hobby users; Pro card CTA is Upgrade→checkout (Hobby) / Manage Subscription→portal (Pro) / Get Pro Access→auth-then-continue (signed-out). Keep existing copy, `$5/month`, styling, and layout. Pending labels "Securing checkout…" / "Loading portal…"; `disabled` + `aria-disabled`; `aria-live="polite"` status region; retryable error restores the action; prevent repeat clicks while pending.
- `app/(authed)/layout.tsx` — add a plan control near the existing `PlanBadge`: Hobby → "Upgrade to Pro" (checkout action), Pro → "Manage Subscription" (portal action). Reuse the Phase 4 actions. Redirect in the current tab (or clearly communicated new tab). Keep existing `PlanBadge`/sidebar code untouched except the directly required control.
- Accessibility: semantic `<button>`/`<a>`, visible focus, color-not-only loading, decorative icons `aria-hidden`, persistent inline error (not toast-only).
**Verify:** `pnpm run lint; pnpm run typecheck`
**Done when:** all 4 viewer states render correctly; pending/error accessible; no double-submit; existing layout/styling preserved except the required CTA behavior.

---

## [Phase 7] Signed-out upgrade continuation (Next.js)

**Files:** minimal fixed internal upgrade-continuation route/component (e.g. `app/(authed)/upgrade/page.tsx` or equivalent), `components/templates/nexto/sections/Pricing.tsx` (wire signed-out Pro CTA).
**Depends on:** Phase 4 + Phase 6.
**Build:**
- Signed-out visitor clicks Pro CTA → start Clerk auth with **fixed upgrade intent** (no arbitrary redirect from query params). Use a fixed internal upgrade-continuation route/state to prevent open redirects.
- After auth + Convex user sync: wait for `currentUser` to exist, then invoke `generateBillingUrl` **once** and `window.location`/`redirect` to its URL. Accessible pending state while syncing; retryable error (no loop) if checkout fails — leave the user signed in.
- Read the relevant guides in `node_modules/next/dist/docs/` (authentication, redirecting, environment variables, server/client boundaries) before coding — this Next.js version has breaking changes.
**Verify:** `pnpm run lint; pnpm run typecheck`
**Done when:** signed-out visitor reaches checkout without re-clicking the CTA; no open redirect; errors show a retry action, not a loop; keyboard operable.

---

## [Phase 8] Consolidated tests + verification gate

**Files:** one focused convex-test/Vitest file (e.g. `convex/billing/billing.test.ts`) + any per-file env setup.
**Depends on:** Phases 1–7 (backend 1–5 required; 6/7 for any UI-level checks).
**Build:**
- Mock the Polar network boundary (do not hit real Polar). Cover at minimum: customer reuse/fallback, Hobby checkout, Pro-to-portal routing, portal authorization, product rejection, signature rejection, lifecycle-to-plan mapping, past-due retention, terminal downgrade, webhook replay.
- Resolve the test environment: repo `vitest.config.ts` uses `jsdom`; use `edge-runtime` (or node) for the convex test file via a per-file `// @vitest-environment` annotation or a second config entry. Add `/// <reference types="vite/client" />` + `import.meta.glob` module map per Convex guidelines.
- Do **not** write tests for trivial one-liners; this file covers the non-trivial billing/webhook behavior only.
**Final gate (PowerShell 5):** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck; pnpm run test:run` — all pass, **without** running `dev` or `build`.
**Done when:** all listed scenarios pass and the full gate is green.

---

## Notes for implementers (do not act on, per AGENTS.md)

- `convex/users.ts` `upsertFromClerk` currently uses `v.any()` for the Clerk payload and reconstructs `tokenIdentifier` only on insert — the convergence fix in Phase 3 is the main behavior change to that file; avoid unrelated refactors.
- `.env.example` parse warning during exploration was a shell artifact, not a file problem; verify the file content directly before editing in Phase 1.
- The reference `I:\promptamist` uses `POLAR_ENVIRONMENT`/`subscriptionTier` and a 2-state active/hobby mapping with **no product validation** — our spec uses `POLAR_SERVER`/`plan`/`polarSubscriptionStatus`, the full 8-event lifecycle, and mandatory product validation. Reuse behavior, not syntax.

---

## Implementation progress (live)

- [x] **Phase 1** — Foundation. Schema (3 optional Polar fields + `by_polar_customer_id` index), `ServerConfig` extended with 4 Polar env vars (fail-closed, nullable at layer so unrelated private calls keep working), `@polar-sh/sdk@0.48.1` installed via `pnpm add`, `.env.example` documents all 4 vars. Gate green: `convex:gen; lint; typecheck`.
- [x] **Phase 2** — Polar core. `convex/billing/{lifecycle,polarClient,provider}.ts` written. `mapSubscriptionToPlan` covers all 8 events (`active`/`past_due`→pro, `canceled`/`unpaid`/`revoked`→hobby, unknown→null). Provider has `ensureCustomer` (stored ID → externalId lookup → create with 409/422 conflict recovery inside the Promise try-block), `createCheckout` (validated success URL + validated Polar-hosted return), `createPortal` (customerSessions.create), `syncCustomerProfile` (best-effort via catchTag→null). Gate green: `lint; typecheck`. **Deviation recorded:** Effect beta `4.0.0-beta.78` has no `Effect.catchAll` (only `catchTag`), so race recovery moved into the Promise try-block — cleaner single-error path.
- [x] **Phase 3** — Internal user-sync mutations + customer-sync action + scheduling wiring. `convex/users.ts` convergent upsertFromClerk (clerkId then tokenIdentifier) + `savePolarCustomerId`/`updateSubscriptionFromPolar` internal mutations (clerkId-first, `by_polar_customer_id` fallback, atomic patch, never insert from webhook). `convex/billing/sync.ts` new: `ensurePolarCustomer` + `syncPolarCustomerProfile` `internalAction`s ("use node", provider via a `BillingBackend` of internal query/mutation, `catchTag` PolarBillingError + PolarConfigError to `Effect.logError`, never throw into signup). `convex/private/users.ts` new: `getUserInfoForPolar` + `getByPolarCustomerId` `internalQuery`s. `ConvexScheduler` service provided in `effectAuthedMutation`/`effectAuthedAction`/`effectPrivateMutation`/`effectPrivateAction` (queries left unchanged — no scheduler). `getOrCreateUser` insert branch schedules `ensurePolarCustomer` only (update branch untouched; `currentUser` shape untouched). Gate green: `convex:gen; lint; typecheck` (and `test:run` passes with no tests).
  - **Deviation recorded:** (a) `convex/private/users.ts` uses `internalQuery` (spec-explicit "internalQuery"), not the bridge-key `effectPrivateQuery` — these are intra-Convex calls from `convex/billing/sync.ts` via `ctx.runQuery`/`ctx.runMutation`, so `internalQuery` is correct (not internet-exposed, no secret plumbing); the AGENTS.md "private setup in convex/private" guidance targets cross-server (Next.js to Convex) calls. (b) `getOrCreateUser` schedules via an explicitly-`Promise<void>`-typed `schedulePolarCustomerSync` helper rather than an inline `scheduler.runAfter(0, internal.billing.sync.ensurePolarCustomer, ...)`: `getOrCreateUser` is a public function referenced by the generated `api` tree, and an inline `internal.*` reference inside the `effectAuthedMutation` handler's inferred R/E created a circular type (TS7022). The explicit helper return type breaks the cycle; remove it only if Convex codegen stops tying `internal` and `api` to the same per-file type.
- [x] **Phase 4** — Authed client actions: checkout + portal (discriminated response). `convex/authed/billing.ts` new: `generateCheckoutUrl` + `generatePortalUrl` `effectAuthedAction`s (zero client args; identity/product/price/success-host derived server-side). Hobby -> `ensureCustomer` (retryable `PolarBillingError` if no real customer ID) -> `createCheckout` for `POLAR_PRODUCT_ID` -> `{ destination: "checkout", url }`. Pro -> `createPortal` (requires real stored `polarCustomerId`) -> `{ destination: "portal", url }`. Hobby hitting portal path -> safe `PolarBillingError`, no URL. Supporting (additive, non-breaking): `ConvexActions` service added to `convex/services/ConvexDB.ts` (`{ runQuery, runMutation }` from `ActionCtx`) + provided in `effectAuthedAction` (`helpers.ts`) so the action handler can reach DB-backed internal queries/mutations (actions can't use `ctx.db`); `effectAuthedMutation` left untouched. `ServerConfig` extended with `polarCheckoutSuccessUrl` (`POLAR_CHECKOUT_SUCCESS_URL`, nullable) so the checkout success URL is server-derived trusted config — never concatenated from a client origin; documented in `.env.example`. Returned URLs validated HTTPS Polar-hosted by the provider. Gate green: `convex:gen; lint; typecheck`.
  - **Deviation recorded:** (a) New `POLAR_CHECKOUT_SUCCESS_URL` Convex deployment env var (full HTTPS success URL; localhost allowed) added in Phase 4 rather than reusing `NEXT_PUBLIC_CONVEX_SITE_URL` — the latter is a Next.js browser-side var not guaranteed to be a Convex deployment var, and the spec (3.3 / §6) requires the success host be trusted server config, never client-supplied. (b) `effectAuthedAction` now provides a new `ConvexActions` service (`{ runQuery, runMutation }`) in addition to `AuthedContext` + `ConvexScheduler` — the wrapper previously had no DB accessor for action handlers (actions can't use `ctx.db`, and the existing `ConvexDB` service wraps the mutation/query `ctx.db` which doesn't exist on `ActionCtx`). Additive/non-breaking: there were zero existing `effectAuthedAction` consumers. (c) Same TS7022 circularity Phase 3 hit — `billing.ts` actions are public functions referenced by the generated `api` tree, so inline `internal.*` references inside the `effectAuthedAction` handler's inferred R/E created a circular type. Fixed by extracting `internal.*` calls into explicitly-`Promise<...>`-typed helpers (`loadPolarUserInfo`, `makeBillingBackend`); remove only if Convex codegen stops tying `internal` and `api` to the same per-file type.
- [ ] **Phase 5** — Pending.
- [ ] **Phase 6** — Pending.
- [ ] **Phase 7** — Pending.
- [ ] **Phase 8** — Pending.
