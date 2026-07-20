# Pro Upgrade Email — Phased Task Breakdown (3 phases)

**Source:** `.agents/specs/08-pro-upgrade-email/spec.md`

This file is the executable phased plan derived from the Pro Upgrade Email specification. Each phase is a self-contained chunk handoff-able to a subagent, tagged `[Phase X]` in its content. Tasks are also tracked via the `todo_write` tool with `[Phase X]` prefixes.

## Dependency & parallelization graph

```
Phase 1  (email action: sendProUpgradeEmail in convex/emails.ts)
   └─▶ Phase 2  (trigger: Hobby→Pro detection + scheduling in convex/users.ts)
         └─▶ Phase 3  (consolidated verification gate + manual checklist)
```

- **Strictly sequential.** Unlike spec 05 (which had a parallel 4∥5 branch), this feature has **no safe parallelization**:
  - Phase 2 references `internal.emails.sendProUpgradeEmail`, which only exists in the generated API after Phase 1 lands and `pnpm run convex:gen` runs. Phase 2's `typecheck` therefore fails in isolation until Phase 1 is merged.
  - Both phases also touch the shared generated `internal`/`api` tree, so concurrent worktrees would conflict on `_generated/`.
- Do **not** hand Phase 1 and Phase 2 to parallel subagents. Hand Phase 1, wait for its verify gate to go green, then hand Phase 2.

## Locked assumptions (recorded, not asked)

1. **Reuse, don't re-create.** `sendProUpgradeEmail` lives in `convex/emails.ts` next to the existing `sendWelcomeEmail` and reuses the same `BrevoApiError` tagged error class, the same `runEffect` boundary helper, the same Effect v4 shape (`Effect.gen` + `Effect.tryPromise` + `Effect.catchTag`), and the same sender `Promptcraft Team <yasirwebio@gmail.com>`. No second error class, no new packages, no new env var unless §7 forces one.
2. **No schema changes.** `users` already has `email`, `name`, and `plan`. No new fields, indexes, or validators.
3. **Trigger is the existing mutation.** The Hobby→Pro detection and `scheduler.runAfter` call are added inside the existing `updateSubscriptionFromPolar` internal mutation in `convex/users.ts`. No new mutation, no new webhook route, no change to `convex/http.ts` or `convex/billing/*`.
4. **App origin for the email link (spec §7).** The "manage subscription" link points to the in-app `/dashboard/billing` route (`app/(authed)/dashboard/billing/page.tsx`), which already generates a fresh Polar portal session on click. Polar portal URLs are short-lived, so they cannot be embedded directly. The `<app-origin>` for the full URL must come from a trusted env var already present in the Convex deployment. **Confirm at Phase 1 which env var that is** (e.g. `NEXT_PUBLIC_CONVEX_SITE_URL` or a dedicated `SITE_URL`); prefer reusing an existing one. If none is configured, omit the link and keep the confirmation text — never emit `localhost` or a broken link in a production email.
5. **TS7022 circularity (already hit in specs 04/05).** `updateSubscriptionFromPolar` is an `internalMutation` whose file is referenced by the generated `internal`/`api` trees. If inlining `internal.emails.sendProUpgradeEmail` inside its handler triggers TS7022 ("circularity ... inferred type"), extract the scheduling through an explicitly-`Promise<void>`-typed helper (same workaround as Phase 3/4 of spec 05). Do not change runtime behavior to appease the type checker.
6. **Never run `dev` or `build`.** Run `pnpm run convex:gen` after adding the action (Phase 1) and again after the trigger (Phase 2). Run `pnpm run lint; pnpm run typecheck` per phase. PowerShell 5 syntax: `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`.

---

## [Phase 1] Email action: `sendProUpgradeEmail` in `convex/emails.ts`

**Files:** `convex/emails.ts`
**Depends on:** nothing (start first)
**Build:**
- Add a new `sendProUpgradeEmail` `internalAction` (from `./_generated/server`) to `convex/emails.ts`, with args `{ email: v.string(), name: v.optional(v.string()) }`. Structurally mirror the existing `sendWelcomeEmail` in the same file.
- Reuse the existing `BrevoApiError` tagged error class — do **not** add a second error class.
- Handler body: `Effect.gen(function* () { ... })` + `Effect.tryPromise` (the `fetch` to `https://api.brevo.com/v3/smtp/email`) + `Effect.catchTag('BrevoApiError', ...)` + `runEffect(program)`. Identical Effect v4 shape to `sendWelcomeEmail`.
- Missing `BREVO_API_KEY` → `yield* Effect.logWarning(...)` and `return` (no throw), exactly like the welcome email.
- HTML template (inline, Promptcraft-branded, no external assets):
  - Subject: `Your Pro subscription is active`.
  - Greeting: `Hi {name},` when a name exists; otherwise `Hi there,`.
  - Tone: concise confirmation/receipt — confirm the payment succeeded, confirm Pro is now enabled on the account, one short line inviting subscription management, a support callout ("reply to this email for help"), sign off `The Promptcraft Team`.
  - Manage-subscription link: full URL `https://<app-origin>/dashboard/billing`. Resolve `<app-origin>` per locked assumption #4. If no origin is configured, omit the link and keep the rest of the text; never emit `localhost` or a broken URL.
- Sender: `{ name: 'Promptcraft Team', email: 'yasirwebio@gmail.com' }`. No separate `replyTo` (matches sender, same as welcome email).
- `to`: `[{ email: args.email, ...(args.name ? { name: args.name } : {}) }]`.
- **No `.env.example` change** unless locked assumption #4 reveals a missing origin env var; in that case document it as a Convex-deployment variable only (no `NEXT_PUBLIC_*`).
**Verify:** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`
**Done when:** `sendProUpgradeEmail` compiles and reuses `BrevoApiError`; the missing-key path warns without throwing; the template matches spec §7; `internal.emails.sendProUpgradeEmail` exists in the generated API; the verify gate is green.

---

## [Phase 2] Trigger: Hobby→Pro detection + scheduling in `updateSubscriptionFromPolar`

**Files:** `convex/users.ts`
**Depends on:** Phase 1 (needs `internal.emails.sendProUpgradeEmail` registered via `convex:gen`)
**Build:**
- In the existing `updateSubscriptionFromPolar` internal mutation (`convex/users.ts`), capture the resolved existing user's `plan` as `wasHobby` **before** the existing `ctx.db.patch` call. `wasHobby` is `true` only when `user.plan === "hobby"`.
- Keep the existing patch **exactly as-is** — it sets `polarCustomerId`, `polarSubscriptionId`, `polarSubscriptionStatus`, and `plan`. Do not alter the resolution logic (clerkId first, `polarCustomerId` fallback) or the "never insert a user from a webhook" guard.
- After the existing patch, add the scheduling:
  - If `wasHobby && args.plan === "pro"` and `user.email` is non-empty: `await ctx.scheduler.runAfter(0, internal.emails.sendProUpgradeEmail, { email: user.email, name: user.name || undefined });`
  - If `user.email` is empty: `console.warn` and skip scheduling (mirror the welcome email's `if (profile.email)` guard; Brevo would reject an empty `to` anyway).
  - Do nothing extra when `wasHobby` is `false` (already Pro → replay idempotent) or when `args.plan === "hobby"` (Pro→Hobby downgrade — no email in this feature).
- **TS7022 caveat (locked assumption #5):** if inlining `internal.emails.sendProUpgradeEmail` triggers a circular type, extract the scheduling through an explicitly-`Promise<void>`-typed helper. Do not change runtime behavior to work around a type error.
- **Do not touch** `savePolarCustomerId`, `upsertFromClerk`, `insertNewUser`, `updateExistingUser`, `deleteFromClerk`, `convex/http.ts`, `convex/billing/*`, or `convex/schema.ts`.
**Verify:** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck`
**Done when:** a Hobby→Pro transition schedules the email; an already-Pro replay and a Pro→Hobby downgrade do not; an empty email skips scheduling with a warning; the existing patch + resolution logic is byte-for-byte unchanged; typecheck is clean (with the TS7022 helper if needed).

---

## [Phase 3] Consolidated verification gate + manual checklist

**Files:** none (verification only). An optional focused test file (`convex/emails.test.ts` or similar) may be added here — see the decision below.
**Depends on:** Phase 1 + Phase 2
**Build:**
- **Final gate (PowerShell 5):** `pnpm run convex:gen; pnpm run lint; pnpm run typecheck; pnpm run test:run` — all pass, **without** running `dev` or `build`. (`test:run` confirms no regression in the existing suite, e.g. the spec 05 billing tests.)
- **Manual verification checklist** (from spec §6 acceptance criteria):
  - [ ] A sandbox Polar checkout that activates a subscription delivers the Pro upgrade email to the user's inbox.
  - [ ] Triggering a second granting webhook for the same already-Pro user does **not** send another email (idempotent replay).
  - [ ] Downgrading the user (cancel/revoke/unpaid → Hobby) and then re-upgrading sends the email again on the new Hobby→Pro transition.
  - [ ] With `BREVO_API_KEY` unset, the webhook completes the upgrade; Convex logs show a warning (not an error); no email is sent; no exception propagates to the webhook response.
- **Optional automated test decision:** the spec's acceptance bar is manual verification, not automated tests. Per AGENTS.md "simplest solution first", do **not** add tests unless they are cheap and cover non-trivial logic. If added, cover only the Hobby→Pro scheduling decision and the already-Pro / Pro→Hobby no-op cases in `updateSubscriptionFromPolar` — do **not** test the Brevo HTTP call (network boundary, out of scope). Keep it minimal and resolve the Vitest environment the same way spec 05 Phase 8 did (per-file `@vitest-environment` annotation, `edge-runtime` or `node`).
**Done when:** the full gate is green; each manual checklist item is confirmed or explicitly noted as deferred; no existing test regressed.

---

## Implementation progress (live)

- [ ] **Phase 1** — Pending.
- [ ] **Phase 2** — Pending.
- [ ] **Phase 3** — Pending.
