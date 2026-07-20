# Pro Upgrade Email Specification

## 1. Problem Statement

Promptcraft can move a user from the Hobby plan to the Pro plan, but that upgrade currently happens silently. When a user pays for Pro, they receive no confirmation that their payment succeeded and that Pro is now active on their account. This is a missing post-purchase touchpoint: the user has just spent money and has no reassurance that it worked.

The verified Polar webhook — not the checkout success redirect — is the only thing that sets `users.plan = "pro"` (see `.agents/specs/05-polar-billing/spec.md`, §2 "Billing source of truth" and §3.6 "Checkout redirects alone never modify `users.plan`"). So a "paid successfully" email must be tied to that webhook-driven plan transition, never to the browser reaching a success URL.

**Solution:** Add a one-shot Pro upgrade confirmation email, dispatched from the `updateSubscriptionFromPolar` internal mutation in `convex/users.ts` at the exact moment a user's plan transitions from `"hobby"` to `"pro"`. The email itself is sent through the existing Brevo transactional integration already established by the welcome email (`.agents/specs/04-brevo-welcome-email/spec.md`), reusing the same `BrevoApiError` tagged error class, Effect v4 `Effect.gen` + `Effect.tryPromise` pattern, and `Promptcraft Team` sender identity.

---

## 2. Functional Requirements

The system should:

* **Send the Pro upgrade email exactly when a verified Polar webhook moves a user from Hobby to Pro.** The trigger is the `updateSubscriptionFromPolar` internal mutation in `convex/users.ts`. It schedules the email only when the resolved existing user's `plan === "hobby"` **and** the incoming `args.plan === "pro"`. This is the only condition that fires the email, and it is what guarantees "only when the user is paid" — because `users.plan` becomes `"pro"` exclusively through a verified Polar subscription webhook (spec 05, §3.6).
* **Fire on every Hobby→Pro transition.** A user who upgrades, later cancels (drops back to Hobby), and then re-subscribes receives the email again on each new Hobby→Pro transition. This intentionally differs from the welcome email's "exactly once per user" rule, because an upgrade confirmation is appropriate each time a new paid term begins.
* **Never fire on a non-transition.** If the user is already Pro (e.g. a replayed `subscription.active` event, or a `subscription.updated` that keeps Pro), the existing `plan === "pro"` so the `wasHobby` check is false and no email is scheduled. If the transition is Pro→Hobby (canceled/revoked/unpaid), `args.plan === "hobby"` so no email is scheduled.
* **Send via the Brevo transactional API** from a new `sendProUpgradeEmail` `internalAction` in `convex/emails.ts` (alongside the existing `sendWelcomeEmail`), using `POST https://api.brevo.com/v3/smtp/email` with the `api-key` header, sender `Promptcraft Team <yasirwebio@gmail.com>`, a `to` array containing the user's email and name, subject `Your Pro subscription is active`, and inline Promptcraft-branded `htmlContent`.
* **Personalize the email:** Greet the user by name when available, falling back to a generic greeting (`Hi there,`) when the user's `name` is empty.
* **Never block or fail the upgrade.** Email dispatch runs asynchronously via `ctx.scheduler.runAfter(0, ...)` after the `users` document is patched to `plan: "pro"`. A Brevo outage, missing API key, or invalid email must never cause the webhook mutation or the plan transition to fail. The patch to `plan: "pro"` commits regardless of the email outcome.
* **Degrade gracefully without configuration:** If `BREVO_API_KEY` is not set in the Convex environment, the action logs a warning and skips sending (no thrown error), matching the welcome email behavior. Local/dev environments keep working without a Brevo account.
* **Link to the in-app billing page, not directly to Polar.** The email's "manage your subscription" link points to the app's authenticated billing route (`/dashboard/billing`), where the existing "Manage Subscription" button generates a fresh, short-lived Polar customer-portal session on demand. Polar portal URLs are per-session and short-lived, so they cannot be embedded as a static link in a transactional email.

---

## 3. Inputs and Outputs: Pro Upgrade Email Flow

### 3.1 User Upgrades and the Webhook Grants Pro
* **INPUT:** The user completes Polar checkout. Polar fires a signed `subscription.active` (or equivalent granting) webhook to `/polar-webhook` (`convex/http.ts`).
* **SYSTEM BEHAVIOR:**
  1. The existing `httpAction` verifies the Polar signature via `verifyPolarWebhook`. Invalid signatures return `400` and perform no writes (unchanged from spec 05, Phase 5).
  2. `filterRelevantSubscription` confirms the event is for `POLAR_PRODUCT_ID` and maps the status to a plan via `mapSubscriptionToPlan`. For an active subscription this is `"pro"`.
  3. `resolvePolarUser` confirms a Convex user exists (by `clerkId` then `polarCustomerId`). If not, the webhook returns `409` for Polar retry (unchanged).
  4. The `httpAction` calls `internal.users.updateSubscriptionFromPolar` with `{ clerkId, polarCustomerId, polarSubscriptionId, polarSubscriptionStatus, plan: "pro" }`.
  5. Inside `updateSubscriptionFromPolar` (the new behavior added by this feature): the handler resolves the existing `user` (by `clerkId` then `polarCustomerId`), reads `user.plan` **before** patching, performs the existing patch (`polarCustomerId`, `polarSubscriptionId`, `polarSubscriptionStatus`, `plan`), and **then**, if `wasHobby === true && args.plan === "pro"` and `user.email` is non-empty, schedules the email:
     ```ts
     await ctx.scheduler.runAfter(0, internal.emails.sendProUpgradeEmail, {
       email: user.email,
       name: user.name || undefined,
     });
     ```
  6. The webhook returns `200`. The email sends in the background.

### 3.2 Sending the Email
* **INPUT:** Scheduler invokes `internal.emails.sendProUpgradeEmail` (a new `internalAction` in `convex/emails.ts`) with `{ email: string, name?: string }`.
* **SYSTEM BEHAVIOR:**
  1. Read `BREVO_API_KEY` from `process.env`. If missing, `Effect.logWarning` and return.
  2. Build the Promptcraft-branded HTML confirmation template, interpolating the user's name (fallback `"there"`). Use subject `Your Pro subscription is active`; confirm the payment succeeded; confirm Pro is now enabled on the account; provide a "Manage your subscription" link to `https://<app-origin>/dashboard/billing` (see §7 for the link handling); sign off as `The Promptcraft Team`.
  3. Wrap the `fetch` call to `https://api.brevo.com/v3/smtp/email` in `Effect.tryPromise`, composed inside `Effect.gen(function* () { ... })` per the project's Effect v4 conventions, reusing the existing `BrevoApiError` tagged error class already defined in `convex/emails.ts`.
  4. On non-OK response, read the response body text and fail with `BrevoApiError`, then catch it via `Effect.catchTag('BrevoApiError', ...)` and log — do not rethrow out of the action.
  5. On success, log that the Pro upgrade email was sent to the address.

---

## 4. Constraints

* **Effect v4 Syntax:** The handler body for `sendProUpgradeEmail` in `convex/emails.ts` must use `Effect.gen` + `Effect.tryPromise`, the existing `BrevoApiError` tagged error class (`Schema.TaggedErrorClass`), and `Effect.runPromise` via the existing `runEffect` helper in `convex/effectHelpers.ts` — matching the `sendWelcomeEmail` implementation already in that file. Do not introduce a second error class or a different runtime boundary.
* **Function placement:** Use a plain Convex `internalAction` (from `./_generated/server`) for `sendProUpgradeEmail`, added to `convex/emails.ts`. This is neither `authed` (not client-exposed) nor `private` (not called over the network from the Next.js backend) — it is invoked only through the Convex scheduler, so the internal function API is the correct guard. This matches the welcome email reference.
* **Actions, not mutations, call the network:** Convex mutations cannot `fetch`. The Brevo call must live in the action, scheduled from the mutation — never inline in `updateSubscriptionFromPolar`.
* **Trigger lives in the existing mutation:** The Hobby→Pro detection and `scheduler.runAfter` call are added to the existing `updateSubscriptionFromPolar` internal mutation in `convex/users.ts`. Do not create a new mutation or a new webhook route for this feature.
* **No new packages:** Brevo is called with plain `fetch`; `effect` is already installed. Nothing to `pnpm add`.
* **No schema changes:** `users` already has `email`, `name`, and `plan`. No new fields, indexes, or validators are added by this feature.
* **Environment variable:** `BREVO_API_KEY` is already documented in `.env.example` by the welcome email spec and must already be set in the Convex dashboard for the welcome email to work. No `.env.example` change is required for this feature unless the variable is missing, in which case add it as already specified by spec 04.
* **Sender identity:** Use `Promptcraft Team` as sender name and `yasirwebio@gmail.com` as sender email, identical to the welcome email. This address must remain verified in the Brevo account.
* **Minimal diff:** Only `convex/users.ts` (add the Hobby→Pro detection + scheduling in `updateSubscriptionFromPolar`) and `convex/emails.ts` (add the `sendProUpgradeEmail` internalAction). `convex/http.ts`, `convex/billing/*`, `convex/schema.ts`, and everything else stay untouched.
* **Codegen and checks:** Run `pnpm run convex:gen` after adding the new `internalAction` (so `internal.emails.sendProUpgradeEmail` is registered), then `pnpm run lint; pnpm run typecheck`. Do not run `dev` or `build`.

---

## 5. Edge Cases and Error Handling

* **User is already Pro (replayed granting event, `subscription.updated` keeping Pro):** `user.plan === "pro"` before the patch, so `wasHobby` is `false`. No email is scheduled. This makes Polar webhook replay safe and idempotent — a replay of the same active event does not resend the email.
* **Pro→Hobby transition (`canceled`/`revoked`/`unpaid`):** `args.plan === "hobby"`, so the `args.plan === "pro"` condition is `false`. No email is scheduled. Downgrades are silent (no downgrade email in this feature).
* **Re-subscription after cancellation:** User upgrades (Hobby→Pro, email fires) → subscription cancels (Pro→Hobby, no email) → user re-subscribes (Hobby→Pro, email fires again). This is the intended "every Hobby→Pro transition" behavior.
* **`past_due` event for an already-Pro user:** `mapSubscriptionToPlan("past_due")` returns `"pro"` (spec 05 retains Pro during the retry window). The user is already Pro, so `wasHobby` is `false` and no email fires. Correct.
* **`past_due` / `uncanceled` event that reaches a Hobby user (abnormal race):** These states presuppose an existing active subscription, so in normal Polar flow a Hobby user is never the target. If it does happen (e.g. a webhook ordering race), the Hobby→Pro transition fires the email. This is acceptable because these states represent paid or recovering access, and the user's explicit requirement is "fire on every Hobby→Pro transition." The normal grant path is the `subscription.active` event.
* **Missing `BREVO_API_KEY`:** The action warns and returns without error. The upgrade and `plan: "pro"` patch are unaffected.
* **Empty `email` on the user document:** `users.email` is a required `v.string()` but may be `""` if Clerk had no email. The mutation must skip scheduling the email when `user.email` is empty (log a warning), mirroring the welcome email's `if (profile.email)` guard. Brevo would reject an empty `to` address anyway.
* **Missing `name`:** `name` is a required `v.string()` but may be `""`. The scheduling call passes `name: user.name || undefined`, and the template falls back to `Hi there,`. The `to` entry omits `name` when absent.
* **Brevo API failure (4xx/5xx, network error):** Caught inside the action via `Effect.catchTag('BrevoApiError', ...)`, logged with status and response body via `Effect.logError`. The action completes without throwing; the user's `plan: "pro"` is already committed and unaffected. No retry logic in v1.
* **Scheduler failure:** `ctx.scheduler.runAfter` is transactional with the mutation — if the patch commits, the email is scheduled; if the mutation aborts, no email is scheduled. This is the same transactional guarantee the welcome email relies on.
* **Webhook returns non-2xx for transient DB error (existing behavior):** If `updateSubscriptionFromPolar` throws, the `httpAction` returns `500` and Polar retries (unchanged from spec 05). On retry, if the user is now Pro, `wasHobby` is `false` and the email is not re-sent — so a retry after a partial commit cannot double-send. (The patch + scheduling are in the same mutation transaction; a throw rolls back the schedule too, so this case is moot, but documented for clarity.)

---

## 6. Acceptance Criteria

The feature is considered complete if:

* `convex/emails.ts` exports a new `sendProUpgradeEmail` `internalAction` with args `{ email: v.string(), name: v.optional(v.string()) }`, implemented with Effect v4 (`Effect.gen`, `Effect.tryPromise`, the existing `BrevoApiError` tagged error class, `Effect.catchTag`, `runEffect`), structurally mirroring `sendWelcomeEmail` in the same file.
* `convex/users.ts` -> `updateSubscriptionFromPolar` reads the existing `user.plan` before patching, performs the existing patch unchanged, and schedules `internal.emails.sendProUpgradeEmail` via `ctx.scheduler.runAfter(0, ...)` **only** when `wasHobby === true && args.plan === "pro"` and `user.email` is non-empty.
* No email is scheduled when the user is already Pro, when the transition is Pro→Hobby, or when the webhook is a no-op replay of an already-Pro state.
* A user who upgrades, cancels, and re-subscribes receives the email on each Hobby→Pro transition.
* With `BREVO_API_KEY` unset, the webhook completes the upgrade and the Convex logs show a warning instead of an error; no email is sent and no exception propagates.
* `pnpm run convex:gen` regenerates the API successfully (registering `internal.emails.sendProUpgradeEmail`), and `pnpm run lint; pnpm run typecheck` pass.
* Manual verification: completing a sandbox Polar checkout that activates a subscription delivers the Pro upgrade email; triggering a second granting webhook for the same already-Pro user does not send another; downgrading the user and re-upgrading sends another.

---

## 7. Confirmed Email Content and Identity

* **Product name:** Promptcraft.
* **Sender:** `Promptcraft Team <yasirwebio@gmail.com>` (same as the welcome email).
* **Subject:** `Your Pro subscription is active`.
* **Greeting:** `Hi {name},` when a name exists; otherwise `Hi there,`.
* **Body (concise confirmation/receipt tone):** Confirm that the payment succeeded and that Pro is now enabled on the account. Keep it short and factual — one or two sentences stating the upgrade is active, plus a line inviting the user to manage their subscription.
* **Manage-subscription link:** Points to the in-app authenticated billing page at `/dashboard/billing` (`app/(authed)/dashboard/billing/page.tsx`), which already renders a "Manage Subscription" button that generates a fresh Polar customer-portal session on click. The link must be rendered as a full URL (`https://<app-origin>/dashboard/billing`) in the HTML. Because the email is sent from a Convex action with no Next.js request context, the app origin must come from a trusted server environment variable (e.g. `NEXT_PUBLIC_CONVEX_SITE_URL` if already exposed to the Convex deployment, or a dedicated `SITE_URL` Convex deployment variable). If no origin is configured, omit the link and keep the rest of the confirmation text rather than emitting a broken/`localhost` link. **Confirm at implementation time which env var already provides the public app origin in the Convex deployment; prefer reusing an existing one over adding a new variable.**
* **Support callout:** Tell the user they can reply to the email for help. Replies go to `yasirwebio@gmail.com`; no separate Brevo `replyTo` address is needed because it matches the sender (same as the welcome email).
* **Sign-off:** `The Promptcraft Team`.

---

## 8. Relevant MCPs, Skills, and Tools

* **create-spec skill:** Used to produce this specification document, following the established `.agents/specs/` structure and the EXAMPLE.md detail level.
* **effect ts skill:** Required for the Effect v4 syntax in the new action handler (`Effect.gen`, `Schema.TaggedErrorClass`, `Effect.tryPromise`, `Effect.catchTag`), per `docs/adr/0005-effect-v4-beta-syntax.md` and the existing `sendWelcomeEmail` reference in `convex/emails.ts`.
* **convex skill / `convex/_generated/ai/guidelines.md`:** Read before implementing to follow Convex `internalAction` + scheduler + `internal.*` reference patterns correctly (and to avoid the TS7022 `internal`/`api` circularity already encountered in specs 04/05 — if `sendProUpgradeEmail` is referenced inline inside `updateSubscriptionFromPolar` and triggers a circular type, extract it through an explicitly-typed helper as Phases 3/4 of spec 05 did).
* **Reference implementation:** `convex/emails.ts` (`sendWelcomeEmail`, this repo) is the direct structural template for `sendProUpgradeEmail` — same file, same Effect v4 shape, same `BrevoApiError`, same sender. The trigger/scheduling pattern mirrors `convex/users.ts` `insertNewUser`'s welcome-email scheduling, adapted to the `updateSubscriptionFromPolar` Hobby→Pro transition.
* **Dependency specs:** `.agents/specs/04-brevo-welcome-email/spec.md` (Brevo integration, sender identity, Effect error handling) and `.agents/specs/05-polar-billing/spec.md` (the verified-webhook plan-transition source of truth that this feature hooks into; specifically §3.6 lifecycle mapping and the `updateSubscriptionFromPolar` mutation in `convex/users.ts`).
