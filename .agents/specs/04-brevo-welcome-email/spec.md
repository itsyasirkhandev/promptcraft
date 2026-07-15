# Brevo Welcome Email Specification

## 1. Problem Statement

Currently, when a new user signs up through Clerk, the Clerk `user.created` webhook inserts a `users` document in Convex (`convex/users.ts` -> `upsertFromClerk`), but no communication is sent to the user. New users receive no confirmation or onboarding touchpoint after creating their account.

**Solution:** Integrate the Brevo transactional email API to send a one-time welcome email when a user successfully signs up for the **first time**. The email is dispatched from a Convex `internalAction` scheduled by the user-creation mutation, mirroring the proven implementation in the `promptamist` project (`convex/emails.ts` and `convex/users.ts`), but adapted to this project's Effect v4 conventions.

---

## 2. Functional Requirements

The system should:

* **Send a welcome email exactly once per new user:** Triggered only on the *insert* branch of `upsertFromClerk` (when no existing user matches the `clerkId`). The *update* branch must never send an email — this is what guarantees "first time only" and makes Clerk webhook retries safe.
* **Send via the Brevo transactional API:** `POST https://api.brevo.com/v3/smtp/email` with the `api-key` header, sender `Promptcraft Team <yasirwebio@gmail.com>`, a `to` array containing the new user's email and name, subject `Welcome to Promptcraft!`, and inline Promptcraft-branded `htmlContent`.
* **Personalize the email:** Greet the user by name when available, falling back to a generic greeting (e.g. "Hi there") when the Clerk payload has no name.
* **Never block or fail signup:** Email dispatch runs asynchronously via `ctx.scheduler.runAfter(0, ...)` after the user document is inserted. A Brevo outage, missing API key, or invalid email must never cause the webhook mutation or user creation to fail.
* **Degrade gracefully without configuration:** If `BREVO_API_KEY` is not set in the Convex environment, log a warning and skip sending (no thrown error). This keeps local/dev environments working without a Brevo account.

---

## 3. Inputs and Outputs: Welcome Email Flow

### 1. New User Signs Up
* **INPUT:** Clerk fires the `user.created` webhook to `/clerk-users-webhook` (`convex/http.ts`).
* **SYSTEM BEHAVIOR:**
  1. The existing `httpAction` verifies the Svix signature and calls `internal.users.upsertFromClerk`.
  2. `upsertFromClerk` looks up the user by `clerkId` via the `by_clerk_id` index.
  3. **Existing user found:** patch profile as today. Do NOT send an email. Return.
  4. **No existing user:** insert the `users` document as today, then schedule the email:
     ```ts
     await ctx.scheduler.runAfter(0, internal.emails.sendWelcomeEmail, {
       email,
       name: name || undefined,
     });
     ```
  5. The webhook returns `200` immediately; the email sends in the background.

### 2. Sending the Email
* **INPUT:** Scheduler invokes `internal.emails.sendWelcomeEmail` (an `internalAction` in a new file `convex/emails.ts`) with `{ email: string, name?: string }`.
* **SYSTEM BEHAVIOR:**
  1. Read `BREVO_API_KEY` from `process.env`. If missing, `Effect.logWarning` and return.
  2. Build the Promptcraft-branded HTML welcome template, interpolating the user's name (fallback `"there"`). Use subject `Welcome to Promptcraft!`; welcome the user to Promptcraft; confirm account creation; invite them to start creating, refining, and organizing prompts; offer help by replying to the email; sign off as `The Promptcraft Team`.
  3. Wrap the `fetch` call to `https://api.brevo.com/v3/smtp/email` in `Effect.tryPromise`, composed inside `Effect.gen(function* () { ... })` per the project's Effect v4 conventions (see `convex/private/demo.ts` and `docs/adr/0005-effect-v4-beta-syntax.md`).
  4. On non-OK response, read the response body text and fail with a typed domain error (e.g. `BrevoApiError` via `Schema.TaggedErrorClass`), then catch it and log — do not rethrow out of the action.
  5. On success, log that the email was sent to the address.

---

## 4. Constraints

* **Effect v4 Syntax:** The handler body in `convex/emails.ts` must use `Effect.gen` + `Effect.tryPromise`, typed errors via `Schema.TaggedErrorClass`, and `Effect.runPromise` (or the existing `runEffect` helper in `convex/effectHelpers.ts`) at the boundary — matching the patterns in `convex/private/demo.ts`.
* **Function placement:** Use a plain Convex `internalAction` (from `./_generated/server`) in `convex/emails.ts`. This is neither `authed` (not client-exposed) nor `private` (not called over the network from the Next.js backend) — it is invoked only through the Convex scheduler, so the internal function API is the correct guard. This matches the promptamist reference.
* **Actions, not mutations, call the network:** Convex mutations cannot `fetch`. The Brevo call must live in an action, scheduled from the mutation — never inline in `upsertFromClerk`.
* **No new packages:** Brevo is called with plain `fetch`; `effect` is already installed. Nothing to `pnpm add`.
* **Environment variable:** `BREVO_API_KEY` must be set in the Convex dashboard (Settings -> Environment Variables) for dev and prod deployments. Also add it (empty) to `.env.example` with a comment noting it lives in the Convex deployment, not Next.js.
* **Sender identity:** Use `Promptcraft Team` as sender name and `yasirwebio@gmail.com` as sender email. This address must remain verified in the Brevo account.
* **Minimal diff:** Only `convex/users.ts` (add the scheduler call in the insert branch), new file `convex/emails.ts`, and `.env.example` change. `convex/http.ts` and everything else stay untouched.
* **Codegen and checks:** Run `pnpm run convex:gen` after adding the new Convex file, then `pnpm run lint; pnpm run typecheck`.

---

## 5. Edge Cases and Error Handling

* **Clerk webhook retry / duplicate `user.created` events:** The `by_clerk_id` lookup routes retries to the patch branch, so no duplicate email is scheduled.
* **`user.updated` events:** Handled by the same `upsertFromClerk`, but only the insert branch schedules the email — updates never trigger it.
* **Missing `BREVO_API_KEY`:** Warn and return without error. Signup is unaffected.
* **Empty email from Clerk payload:** `upsertFromClerk` currently defaults email to `""`. If `email` is empty, skip scheduling the email entirely (log a warning) — Brevo would reject it anyway.
* **Missing name:** `name` is optional; the template falls back to `Hi there,`, and the `to` entry omits `name` when absent.
* **Brevo API failure (4xx/5xx, network error):** Caught inside the action, logged with status and response body via `Effect.logError`. The action completes without throwing; the user's signup is already committed and unaffected. No retry logic in v1.
* **Scheduler failure:** `ctx.scheduler.runAfter` is transactional with the mutation — if the insert commits, the email is scheduled; if the mutation aborts, no email is scheduled.

---

## 6. Acceptance Criteria

The feature is considered complete if:

* New file `convex/emails.ts` exports `sendWelcomeEmail` as an `internalAction` with args `{ email: v.string(), name: v.optional(v.string()) }`, implemented with Effect v4 (`Effect.gen`, `Effect.tryPromise`, tagged error class for Brevo failures).
* `convex/users.ts` -> `upsertFromClerk` schedules `internal.emails.sendWelcomeEmail` via `ctx.scheduler.runAfter(0, ...)` **only** in the insert branch, and skips scheduling when the email is empty.
* No email is sent for `user.updated` events or repeated `user.created` deliveries for the same `clerkId`.
* With `BREVO_API_KEY` unset, signup completes and the Convex logs show a warning instead of an error.
* `.env.example` documents `BREVO_API_KEY` as a Convex-deployment variable.
* `pnpm run convex:gen` regenerates the API successfully, and `pnpm run lint; pnpm run typecheck` pass.
* Manual verification: signing up with a fresh account delivers the welcome email; signing in again with the same account does not send another.

---

## 7. Confirmed Email Content and Identity

* **Product name:** Promptcraft.
* **Sender:** `Promptcraft Team <yasirwebio@gmail.com>`.
* **Subject:** `Welcome to Promptcraft!`.
* **Greeting:** `Hi {name},` when a name exists; otherwise `Hi there,`.
* **Body:** Welcome the user to Promptcraft, confirm successful account creation, and invite them to start creating, refining, and organizing prompts.
* **Support callout:** Tell users they can reply directly to the welcome email for help. Replies go to `yasirwebio@gmail.com`; no separate Brevo `replyTo` address is needed because it matches the sender.
* **Sign-off:** `The Promptcraft Team`.

---

## 8. Relevant MCPs, Skills, and Tools

* **effect ts skill:** Required for the Effect v4 beta syntax in the action handler (`Effect.gen`, `Schema.TaggedErrorClass`, `Effect.tryPromise`), per `docs/adr/0005-effect-v4-beta-syntax.md`.
* **convex skill / `convex/_generated/ai/guidelines.md`:** Read before implementing to follow Convex `internalAction` + scheduler patterns correctly.
* **Reference implementation:** `I:\promptamist\convex\emails.ts` (welcome email, plain try/catch) and `I:\promptamist\convex\private\emails.ts` (Effect-wrapped Brevo call) — combine the trigger/idempotency pattern of the former with the Effect error handling of the latter.

