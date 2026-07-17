# Polar Billing and Subscription Lifecycle Specification

## 1. Problem Statement

Promptcraft currently displays Hobby and Pro ($5/month) plans and stores the user's access level in `users.plan`, but it has no Polar billing integration. Signed-in users cannot purchase Pro, existing Pro users cannot manage their subscription, and Convex cannot reconcile subscription changes from Polar.

This creates several problems:

* Checkout cannot be generated securely from the backend with a known Polar customer.
* A user's email is not prefilled through a persistent Polar customer identity.
* The application cannot reliably grant or revoke Pro access after billing changes.
* Pro users have no route to Polar's hosted customer portal.
* The pricing and authenticated-layout CTAs do not reflect the current user's plan.
* Sandbox and production billing must not share products, credentials, or API servers.

**Solution:** Add a Convex-owned Polar billing integration, based on the working implementation in `I:\promptamist` but adapted to this repository's current schema, Effect v4 helpers, and `plan` domain field. Convex will synchronize one Polar customer per Clerk user, create checkout and customer-portal sessions, verify Polar webhooks, and update `users.plan` from the complete subscription lifecycle. `users.plan` remains the sole application access-control field.

---

## 2. Domain Model and Source-of-Truth Rules

* **User:** The existing Convex `users` document identified by Clerk identity. The Clerk user ID is the stable cross-system identity and is stored as `clerkId`.
* **Polar Customer:** The billing identity associated one-to-one with a Promptcraft user. Its Polar `externalId` is the Clerk user ID. Its ID is stored as `users.polarCustomerId`.
* **Subscription:** The Polar recurring subscription for the configured Pro product. Its ID and latest status are stored as `users.polarSubscriptionId` and `users.polarSubscriptionStatus`.
* **Plan:** The existing `users.plan` union (`"hobby" | "pro"`). This is the **only** field application features use to authorize Hobby versus Pro capabilities.
* **Billing source of truth:** Verified Polar subscription webhooks determine `users.plan`. A checkout success redirect must never grant Pro by itself.
* **Identity source of truth:** Clerk determines the user's current email and profile identity. Convex persists those values and asynchronously synchronizes relevant changes to Polar.
* **Environment boundary:** Each Convex deployment has exactly one Polar credential/product set. `POLAR_SERVER` selects whether that deployment calls Polar's sandbox or production API.

---

## 3. Functional Requirements

The system should:

### 3.1 Synchronize a Polar Customer on First Signup

* Preserve both existing user-creation entry points: the verified Clerk webhook and authenticated `getOrCreateUser` mutation.
* Make both paths converge on the same Convex user by stable Clerk identity; do not create duplicate Convex users when webhook delivery and first authenticated app load race.
* Schedule the same idempotent internal Polar-customer synchronization action only when a Convex user is actually inserted.
* Create the Polar customer with the user's email, optional name, and Clerk ID as `externalId`; include Clerk/Convex identifiers in Polar metadata where supported.
* Save the real Polar customer ID to the matching `users.polarCustomerId` field.
* Before creating a customer, check the stored ID and Polar's customer identified by the Clerk `externalId`. Reuse either existing customer rather than creating another.
* Handle concurrent attempts safely: if Polar reports an external-ID conflict, retrieve and store the already-created customer instead of producing a duplicate.
* Never use placeholder customer IDs and never save an ID to a different user.
* Never block or roll back signup when Polar is unavailable. A missing `polarCustomerId` is a temporary **pending synchronization** state, not an invalid user record.
* Log background synchronization failures without exposing tokens or sensitive webhook contents.

### 3.2 Keep Polar Customer Email Synchronized

* On a verified Clerk `user.updated` event, update the Convex profile first using the existing flow.
* If the user's email or name changed and `polarCustomerId` exists, schedule an internal Polar customer update.
* If no Polar customer has been synchronized yet, schedule the idempotent ensure-customer operation with the latest Clerk profile instead.
* A Polar failure must not roll back or block the Clerk/Convex profile update. Log the failure; the next profile update or checkout can repair synchronization.

### 3.3 Generate a Pro Checkout URL on Convex

* Expose an authenticated client action through the existing `convex/authed` setup.
* Derive the Clerk/user identity exclusively from authenticated Convex context; never accept a customer ID, Clerk ID, email, product ID, plan, or price from the client.
* Require a complete and valid server configuration before calling Polar.
* For a Hobby user, idempotently ensure a real Polar customer exists, then create a Polar checkout for the single `POLAR_PRODUCT_ID` and that `polarCustomerId`.
* Pass the existing Polar customer ID so Polar prefills the customer's email and associates the purchase with the known customer.
* Add Clerk/user identity metadata to the checkout/subscription where the Polar API supports it, while treating the customer external ID as the canonical webhook correlation key.
* Return only a validated Polar checkout URL to the client.
* For a Pro user, do **not** create another checkout or subscription. Generate and return a customer-portal URL instead, with a discriminated response such as `{ destination: "checkout" | "portal", url: string }`, so the client redirects correctly.
* Do not mark `users.plan` as `"pro"` when creating checkout or when the browser reaches the success URL. Wait for a verified Polar webhook.

### 3.4 Preserve Upgrade Intent Through Authentication

* Signed-out visitors clicking the Pro CTA must be sent through Clerk sign-in/sign-up while preserving an explicit, validated upgrade intent.
* After authentication and Convex user synchronization complete, automatically invoke the authenticated checkout action and redirect to its returned URL.
* Do not accept arbitrary post-authentication redirect URLs from query parameters. Use a fixed internal upgrade continuation route/state to prevent open redirects.
* Display an accessible pending state while user synchronization and checkout creation are in progress, and a retryable error if checkout creation fails.

### 3.5 Provide the Polar Customer Portal to Pro Users

* Expose a separate authenticated Convex action that creates a short-lived Polar customer session and returns its hosted customer-portal URL.
* Authorize the action server-side by requiring `users.plan === "pro"` and an associated real Polar customer.
* A Hobby user calling the portal action directly must receive a safe authorization/domain error and must not receive a portal URL.
* Use the portal action from both agreed entry points:
  1. The Pro pricing-card CTA displays **Manage Subscription**.
  2. The plan control in the authenticated layout opens **Manage Subscription** for Pro users.
* Hobby users see an upgrade/checkout action in both locations.
* Redirect in the current tab unless the existing interaction clearly communicates a new tab; do not create an unannounced new browsing context.

### 3.6 Process the Full Polar Subscription Lifecycle

* Add a Convex HTTP `POST` route for Polar webhooks (for example `/polar-webhook`).
* Verify every request against `POLAR_WEBHOOK_SECRET` using the exact raw request body and Polar's documented signature headers before parsing or mutating data.
* Reject missing/invalid signatures with a 4xx response and perform no database writes.
* Handle the subscription lifecycle events needed to keep the local plan accurate:
  * `subscription.created`
  * `subscription.active`
  * `subscription.updated`
  * `subscription.canceled`
  * `subscription.revoked`
  * `subscription.uncanceled`
  * `subscription.past_due`
  * `subscription.unpaid`
* Correlate the event to a Convex user using the Polar customer `externalId`/Clerk metadata first, then the stored `polarCustomerId` as a safe fallback. Never trust a user identifier supplied by the browser.
* Validate that the subscription belongs to the deployment's configured `POLAR_PRODUCT_ID` before granting or retaining Pro. Events for unrelated products must not change `users.plan`.
* Persist the event's current Polar customer ID, subscription ID, and normalized latest subscription status when the event is valid for the configured product.
* Apply these plan rules from the subscription's current state, not merely the event name:
  * Active paid access, including a subscription scheduled to cancel at period end: `plan = "pro"`.
  * `past_due` while Polar is retrying payment: keep `plan = "pro"`.
  * `uncanceled`/reactivated and active: `plan = "pro"`.
  * Fully `canceled`, `revoked`, or `unpaid`: immediately set `plan = "hobby"`.
* A scheduled cancellation must retain Pro until Polar reports that paid access has actually ended.
* Repeated delivery of the same event must be safe and result in the same persisted state. State assignments must not create duplicate users, customers, or subscriptions.
* Return a non-2xx response for a verified event that fails due to a transient database error so Polar can retry. Return 2xx for known, valid events that require no state change (for example, an unrelated product), after logging the reason.

### 3.7 Handle Clerk Account Deletion

* Keep the existing behavior of deleting only the matching Convex user after a verified Clerk `user.deleted` event.
* Do **not** delete the Polar customer or historical Polar billing records.
* Do not add automatic Polar cancellation/deletion behavior to this feature.

### 3.8 Dynamically Render Pricing and Plan CTAs

The existing pricing section and authenticated layout must react to auth/loading state and `users.plan`:

| Viewer state | Hobby CTA | Pro CTA / plan control |
| --- | --- | --- |
| Signed out | Start/sign up for free | Get Pro Access -> authenticate -> continue checkout |
| Signed in, Hobby | Current Plan (non-interactive) | Upgrade to Pro -> Polar checkout |
| Signed in, Pro | Hobby Plan (non-interactive) | Manage Subscription -> Polar portal |
| Loading | Stable skeleton/disabled placeholder | Stable skeleton/disabled placeholder |

* Prevent repeated clicks while checkout/portal generation is pending.
* Provide visible text for pending states such as **Securing checkout...** and **Loading portal...**.
* Surface a user-friendly error and restore the action for retry if Convex or Polar fails.
* Keep current pricing content, price (`$5/month`), visual styling, and layout except for the directly required dynamic CTA behavior and accessible states.

---

## 4. Inputs and Outputs: End-to-End Flows

### 4.1 First Signup and Customer Synchronization

**INPUT:** A new user completes Clerk signup; either Clerk's `user.created` webhook or authenticated `getOrCreateUser` reaches Convex first.

**EXPECTED SYSTEM BEHAVIOR:**

1. Convex resolves the stable Clerk identity and inserts at most one `users` record with `plan: "hobby"`.
2. Only the path that performed the insert schedules the shared internal ensure-customer action.
3. The action checks `polarCustomerId`, then checks Polar by Clerk `externalId`.
4. It creates a Polar customer only if neither exists, using the current email/name.
5. Convex stores the returned Polar customer ID on that exact user.
6. If Polar fails, signup remains successful and the missing ID stays pending for a later safe retry.

**OUTPUT:** One Convex user, at most one Polar customer for that Clerk identity, and eventually a synchronized `polarCustomerId`.

### 4.2 Hobby User Upgrades

**INPUT:** An authenticated Hobby user selects **Upgrade to Pro**.

**EXPECTED SYSTEM BEHAVIOR:**

1. The client disables the CTA and calls the authed Convex billing action.
2. Convex authorizes the identity and loads the canonical user.
3. Convex ensures the Polar customer exists; checkout stops with a retryable error if synchronization cannot produce a real customer ID.
4. Convex creates checkout for `POLAR_PRODUCT_ID` and the stored customer.
5. The client redirects to the returned Polar-hosted checkout URL, where email is prefilled.
6. The user remains Hobby until the verified active subscription webhook arrives.
7. The webhook validates signature, user correlation, and product, then sets `users.plan = "pro"` immediately.

**OUTPUT:** A Polar checkout URL followed by webhook-driven Pro access.

### 4.3 Signed-Out Visitor Chooses Pro

**INPUT:** A signed-out visitor selects **Get Pro Access**.

**EXPECTED SYSTEM BEHAVIOR:**

1. The app starts Clerk authentication with fixed upgrade continuation intent.
2. After authentication, the client waits until the Convex user exists/synchronizes.
3. The client invokes the authenticated checkout action once and redirects to Polar.
4. Errors leave the user signed in and show a retry action instead of looping.

**OUTPUT:** The visitor continues to checkout without needing to find and click the upgrade CTA again.

### 4.4 Pro User Manages Subscription

**INPUT:** A Pro user selects **Manage Subscription** from pricing or the authenticated plan control.

**EXPECTED SYSTEM BEHAVIOR:**

1. Convex verifies authentication and `users.plan === "pro"`.
2. Convex creates a Polar customer session for the stored customer ID.
3. The client redirects to the validated Polar-hosted customer portal URL.
4. A Hobby user attempting the same backend call receives no URL.

**OUTPUT:** A short-lived Polar-hosted portal session for an authorized Pro user.

### 4.5 Subscription Changes

**INPUT:** Polar sends a signed subscription event.

**EXPECTED SYSTEM BEHAVIOR:**

1. Convex verifies the signature before trusting the payload.
2. Convex confirms the configured product and resolves the user.
3. Convex stores the latest customer/subscription identifiers and status.
4. Convex derives `plan` using the lifecycle mapping in section 3.6.
5. Convex acknowledges successful processing; duplicate delivery produces the same state.

**OUTPUT:** `users.plan` reflects current paid entitlement without relying on browser redirects.

### 4.6 Clerk Email Changes

**INPUT:** Clerk sends a verified `user.updated` event with a changed primary email or name.

**EXPECTED SYSTEM BEHAVIOR:**

1. Convex updates the matching local user.
2. Convex schedules Polar profile synchronization after the local write.
3. Polar is updated using the stored customer ID or resolved Clerk external ID.
4. Failure is logged and does not revert the local Clerk profile update.

**OUTPUT:** Convex updates immediately and Polar converges asynchronously to the same email/profile.

---

## 5. Data and Backend Changes

### 5.1 Existing `users` Table

Add optional fields so current records migrate without a destructive backfill:

```ts
polarCustomerId: v.optional(v.string()),
polarSubscriptionId: v.optional(v.string()),
polarSubscriptionStatus: v.optional(v.string()),
```

Add an index for webhook fallback correlation:

```ts
.index("by_polar_customer_id", ["polarCustomerId"])
```

Keep the existing required `plan` validator unchanged. Do not expose Polar IDs or raw billing metadata to unauthenticated clients. The existing authenticated current-user query may return only what the UI needs (`plan`); portal and checkout actions resolve billing identifiers server-side.

### 5.2 Convex Function Boundaries

* Client-exposed checkout and portal functions must use the repository's `authed` action setup and derive identity from auth context.
* Scheduler/webhook-only reads and writes must be `internalQuery`, `internalMutation`, or `internalAction`; they are not public client APIs.
* If Next.js backend code is needed for the fixed auth continuation, any backend-to-Convex call must use the project's private setup and Convex service. Prefer calling Convex directly from the authenticated client when no Next.js server boundary is needed.
* Polar network calls belong in Convex actions. Mutations perform only transactional database reads/writes and scheduling.
* Backend logic must use Effect v4 conventions already established in this project. Use the installed SDK only where it reduces protocol/signature risk; do not add unrelated abstractions.

### 5.3 Environment Variables

Configure these separately in **each Convex deployment**:

```text
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_PRODUCT_ID=
POLAR_SERVER=sandbox|production
```

* Development/sandbox Convex deployment:
  * `POLAR_SERVER=sandbox`
  * `POLAR_PRODUCT_ID=31b0505a-9ff3-4fa0-a370-adf5e6ad3143`
  * Sandbox access token and sandbox webhook secret.
* Production Convex deployment:
  * `POLAR_SERVER=production`
  * Production access token, webhook secret, and production product ID.
* Never define both sandbox and production credentials in the same deployment.
* Never expose these values through `NEXT_PUBLIC_*` variables or send them to the browser.
* Validate `POLAR_SERVER` strictly as `sandbox | production`; fail closed for missing/invalid configuration rather than silently calling the wrong environment.
* Document all four variables in `.env.example` as Convex-deployment variables. Do not commit real values.

### 5.4 Polar Dependency

Use the current Polar SDK version compatible with this project's runtime and Polar's current API. During implementation, install it with:

```powershell
pnpm add @polar-sh/sdk
```

Do not copy the reference project's pinned SDK behavior blindly. Confirm the installed SDK's current `customers`, `checkouts`, `customerSessions`, server selection, and webhook payload APIs/types before implementation.

---

## 6. Security, Validation, and Accessibility Constraints

### Security

* Verify Clerk and Polar webhook signatures over the untouched raw body.
* Read secrets only from the Convex deployment environment.
* Never trust client-provided identity, plan, customer ID, product ID, price, success host, or portal destination.
* Checkout is limited to the configured product; webhook entitlement is limited to the same product.
* Validate any client origin/return location against a fixed allowlist or derive it from trusted server configuration. Do not concatenate an arbitrary client-provided origin into success URLs.
* Validate returned redirect URLs as HTTPS Polar-hosted URLs (allow the documented localhost case only for local app return URLs, not third-party redirect destinations).
* Log operational identifiers and error categories, not access tokens, webhook secrets, full signatures, or payment details.
* Portal authorization and duplicate-subscription prevention must be enforced in Convex, not only hidden in React.

### Accessibility

* All CTAs must use semantic `<button>` or `<a>` elements with visible, descriptive labels.
* Pending controls use `disabled` and `aria-disabled` as appropriate, retain a visible focus indicator, and expose status text to assistive technology (`aria-live="polite"` for asynchronous status/error messages).
* Loading indicators cannot be color-only and decorative icons must be hidden from assistive technology.
* Error feedback must be perceivable without relying only on transient toast notifications; provide persistent inline/status messaging or an accessible live region.
* Authentication continuation, checkout, and portal redirects must remain keyboard operable.
* Dynamic CTA updates should not unexpectedly move focus or trigger checkout more than once.

---

## 7. Edge Cases and Error Handling

* **Polar unavailable during signup:** Keep the valid Hobby user, log the background failure, and leave customer synchronization pending.
* **Checkout with pending customer:** Run the same ensure-customer operation. Do not create checkout until a real customer ID is resolved and stored.
* **Repeated/concurrent user sync:** Resolve by Clerk identity and let only the actual insert schedule customer synchronization. Never insert another Convex user merely because one lookup path used a different identifier.
* **Repeated/concurrent Polar sync:** Reuse stored customer or Polar external-ID match. Recover from external-ID conflict by loading the winner.
* **Missing Clerk email:** Do not create a Polar customer with an empty email. Keep synchronization pending and return a clear account-email error if checkout is attempted.
* **Clerk email update while Polar is down:** Commit Convex profile update, log Polar failure, and retry lazily later.
* **Pro user requests checkout:** Return a portal destination; never create a second checkout/subscription.
* **Hobby user requests portal:** Reject safely without returning a URL.
* **Checkout abandoned or success page forged:** Keep Hobby unless a valid Polar webhook grants Pro.
* **Scheduled cancellation:** Keep Pro while the subscription remains paid/active through period end.
* **Past-due payment:** Keep Pro during Polar's retry window.
* **Unpaid, revoked, or fully canceled:** Change to Hobby immediately when the verified event is processed.
* **Subscription recovers/uncancels:** Restore or retain Pro when the current subscription state is active.
* **Webhook replay:** Reapplying the same normalized state is harmless; no duplicate records or one-time side effects are created.
* **Webhook arrives before customer ID is stored:** Resolve via Polar customer external ID/Clerk metadata and patch the correct user atomically.
* **Unknown user:** Log a non-sensitive diagnostic and return a retryable response when the state may be a creation race; do not create an incomplete user from a Polar webhook.
* **Wrong product:** Acknowledge and ignore; never grant Pro.
* **Invalid signature or malformed payload:** Return 4xx, log safely, and perform no writes.
* **Missing/invalid environment configuration:** Return a safe configuration error and do not fall back from production to sandbox or vice versa.
* **Clerk account deleted:** Delete only Convex user data. Retain Polar billing records.

---

## 8. Acceptance Criteria

The feature is complete when:

* `users` includes optional `polarCustomerId`, `polarSubscriptionId`, and `polarSubscriptionStatus`, plus an indexed Polar customer lookup, while `plan` remains `"hobby" | "pro"` and the sole entitlement field.
* A first-time user inserted by either current creation path schedules one shared idempotent Polar-customer synchronization action.
* Webhook/sign-in races produce one Convex user and at most one Polar customer for the Clerk external ID.
* Polar customer creation uses the current email and stores the returned ID; signup succeeds if Polar is unavailable.
* A verified Clerk email/name update synchronizes the existing Polar customer asynchronously without blocking the Convex update.
* A Hobby user can generate a checkout for only `POLAR_PRODUCT_ID`; Polar receives the stored customer ID and prefills the known email.
* A Pro checkout request returns a customer-portal destination instead of creating another subscription.
* Signed-out Pro intent survives Clerk authentication and automatically continues checkout once the Convex user is ready.
* Only an authenticated user whose Convex `plan` is `"pro"` can generate a customer-portal URL.
* Pricing and authenticated plan controls dynamically show current-plan, upgrade, or manage-subscription actions for signed-out, loading, Hobby, and Pro states.
* The Polar webhook endpoint rejects invalid signatures and handles all agreed subscription lifecycle events.
* Webhooks for the wrong product never modify plan access.
* Active, scheduled-to-cancel, uncanceled, and past-due subscriptions retain Pro; fully canceled, revoked, and unpaid subscriptions become Hobby immediately after webhook processing.
* Checkout redirects alone never modify `users.plan`.
* Replayed webhooks and repeated customer synchronization are idempotent.
* Development uses `POLAR_SERVER=sandbox` and sandbox product `31b0505a-9ff3-4fa0-a370-adf5e6ad3143`; production uses its separately configured production values.
* No Polar secret or billing identifier required only by the backend is exposed to the browser.
* Pending and error states satisfy the accessibility constraints in section 6.
* Automated checks cover at minimum: customer reuse/fallback, Hobby checkout, Pro-to-portal routing, portal authorization, product rejection, signature rejection, lifecycle-to-plan mapping, past-due retention, terminal downgrade, and webhook replay.
* After Convex changes, `pnpm run convex:gen` succeeds; `pnpm run lint; pnpm run typecheck; pnpm run test:run` pass without running `dev` or `build`.

---

## 9. Implementation Scope and Likely Touchpoints

Implementation should make the smallest task-focused change set. Expected touchpoints are:

* `convex/schema.ts` — optional billing fields and customer ID index.
* `convex/users.ts` and `convex/authed/users.ts` — convergent insert behavior, synchronization scheduling, and internal billing patches.
* New focused Convex billing files under `convex/authed`, `convex/private`/internal, or a minimal `convex/billing` module — customer ensure/update, checkout, portal, configuration, and lifecycle mapping.
* `convex/http.ts` — verified Polar webhook route.
* `components/templates/nexto/sections/Pricing.tsx` — dynamic pricing CTAs and accessible pending/error states.
* `app/(authed)/layout.tsx` — Hobby upgrade and Pro portal plan control.
* A minimal fixed internal upgrade-continuation route/component only if Clerk's installed primitives cannot preserve intent directly.
* `.env.example` — document Convex Polar variables.
* One focused Vitest/Convex test file for non-trivial billing and webhook behavior.

Do not refactor unrelated user, prompt, layout, pricing-copy, email, or styling code. Do not delete existing files or dependencies as part of this feature.

---

## 10. Verification Plan

### Automated

1. Install the Polar SDK with `pnpm add @polar-sh/sdk` during implementation.
2. Add focused tests using the repository's existing Vitest/`convex-test` setup and mocked Polar network boundary.
3. Run:

```powershell
pnpm run convex:gen; pnpm run lint; pnpm run typecheck; pnpm run test:run
```

### Manual Sandbox Verification

1. Configure the development Convex deployment with sandbox token, webhook secret, product ID `31b0505a-9ff3-4fa0-a370-adf5e6ad3143`, and `POLAR_SERVER=sandbox`.
2. Register a fresh Clerk account and verify one Polar sandbox customer with matching email/external ID and one saved Convex customer ID.
3. Click Pro while signed out, authenticate, and confirm automatic checkout continuation.
4. Confirm checkout email is prefilled and the checkout is for $5/month.
5. Complete sandbox checkout and verify the signed webhook changes `users.plan` to `"pro"` without relying on the return URL.
6. Confirm pricing and authenticated plan control both show **Manage Subscription** and open the hosted portal.
7. Schedule cancellation and verify Pro remains through the paid period; deliver/observe final cancellation and verify immediate Hobby downgrade.
8. Verify `past_due` retains Pro, while `unpaid`/`revoked` changes to Hobby.
9. Reactivate/uncancel and verify Pro is restored from the webhook.
10. Change the Clerk primary email and verify Convex updates first and Polar converges to the new email.
11. Replay a webhook and repeat customer synchronization; verify no duplicate customer/user and no incorrect plan transition.
12. Send an invalid signature and wrong-product event; verify neither changes billing state.
13. Delete the Clerk account; verify the Convex user is removed while the Polar customer remains.

---

## 11. Relevant Skills, Documentation, and References

* **create-spec skill:** Defines this specification workflow and required detail level.
* **grilling + domain-modeling skills:** Used to resolve terminology, ownership, lifecycle behavior, failure policy, environment boundaries, and entitlement rules before writing.
* **Convex AI guidelines:** `convex/_generated/ai/guidelines.md` is mandatory before implementation and overrides remembered Convex patterns.
* **Effect v4 project conventions:** Reuse the repository's current Effect helpers and backend patterns; consult its Effect v4 guidance/ADRs before implementation.
* **Next.js bundled documentation:** Read the relevant guides in `node_modules/next/dist/docs/`, especially authentication, redirecting, environment variables, and server/client boundaries, before changing Next.js code.
* **Working reference project:** `I:\promptamist`, especially its Polar billing provider, authed actions, internal customer synchronization, webhook route, subscription domain mapping, pricing client, and subscription controls. Reuse behavior, not stale package syntax or unrelated architecture.
* **Polar documentation and installed SDK types:** Confirm current server selection, customer external-ID lookup/update, checkout customer binding, customer sessions, webhook signature verification, event payload fields, and lifecycle statuses during implementation.
