# Vandly Payment Integration Specification

## 1. Problem Statement

Promptcraft currently uses Polar billing for user subscriptions. To offer users flexibility and support additional regional payment processing, we need to integrate **Vandly** as a co-existing subscription provider.

This feature introduces Vandly subscription support alongside the existing Polar integration, allowing users to purchase "Promptcrafts Pro" subscriptions via Vandly checkout links, process incoming Vandly webhook events (`subscription.created`, `subscription.renewed`, `subscription.canceled`), verify HMAC-SHA256 signatures, and seamlessly sync entitlement states (`hobby` vs `pro`) in Convex.

---

## 2. Functional Requirements

The system should:

* **Support Co-existing Payment Providers**: Allow users to select between Vandly and Polar on the Upgrade and Billing pages.
* **Integrate Vandly Checkout**: Provide an "Upgrade via Vandly" option pointing to the server-configured Vandly checkout link (`https://stg-app.vandly.co/checkout/pay_aa56e06fa51495015f2b8ce3461bbd1f?interval=month`), prefilling user email parameter if applicable.
* **Expose HTTP Webhook Endpoint**: Host a dedicated `POST /vandly-webhook` HTTP route in Convex to process subscription events from Vandly.
* **HMAC-SHA256 Signature Verification**: Validate the `X-Vandly-Signature` header (`sha256=<hex>`) against the raw request body using `VANDLY_WEBHOOK_SECRET`. Reject unsigned or invalid requests with status `400`.
* **Validate Event Headers and Product ID**: Inspect `X-Vandly-Event` and ensure `event.data.productId` matches the configured `VANDLY_PRODUCT_ID` (e.g., `6`). Ignore events for unrelated products with status `200`.
* **Process Subscription Events**:
  * `subscription.created`: Upgrade user entitlement to `pro` plan; store `vandlySubscriptionId`, set `vandlySubscriptionStatus = "active"`, and record `vandlyLastEventAt`.
  * `subscription.renewed`: Maintain user entitlement as `pro` plan; update `vandlySubscriptionStatus = "active"` and `vandlyLastEventAt`.
  * `subscription.canceled`: Downgrade user entitlement to `hobby` plan (unless the user has an active Polar subscription); set `vandlySubscriptionStatus = "canceled"` and `vandlyLastEventAt`.
* **Out-of-Order Safety**: Guard updates using `timestamp` checks against `vandlyLastEventAt` so outdated redeliveries do not overwrite newer subscription states.
* **User Resolution**: Resolve users by matching `event.data.customerEmail` against `users.email` using the Convex `by_email` index.

---

## 3. Inputs and Outputs: Webhook & Checkout Flows

### A. Webhook Event Processing Flow

**INPUT (HTTP Request from Vandly)**
```
POST /vandly-webhook
X-Vandly-Event: subscription.created
X-Vandly-Signature: sha256=<hex-digest>

{
  "event": "subscription.created",
  "data": {
    "subscriptionId": "922d11fa-064a-4c88-9d9a-7335ed4d3541",
    "productId": 6,
    "productName": "Promptcrafts Pro",
    "customerEmail": "yasirwebio@gmail.com"
  },
  "timestamp": "2026-07-30T07:56:10.905Z"
}
```

**EXPECTED SYSTEM BEHAVIOR**
1. Read raw request body before JSON parsing.
2. Read `X-Vandly-Signature` header and compute HMAC-SHA256 hex digest using `VANDLY_WEBHOOK_SECRET`.
3. If signature fails to match, respond with `HTTP 400 Bad Request` ("Invalid signature") and perform zero writes.
4. Extract `productId` from `data`. If `productId` != `VANDLY_PRODUCT_ID`, log and respond `HTTP 200 OK` without modifying database state.
5. Query `users` table by `email` (`customerEmail`).
6. If user exists:
   - Compare `timestamp` against stored `vandlyLastEventAt`. If timestamp is older, respond `HTTP 200 OK` (no-op).
   - If event is `subscription.created` or `subscription.renewed`: set `plan = "pro"`, `vandlySubscriptionId = data.subscriptionId`, `vandlySubscriptionStatus = "active"`, `vandlyLastEventAt = timestamp`.
   - If event is `subscription.canceled`: check if `polarSubscriptionStatus == "active"`. If active in Polar, preserve `plan = "pro"`; otherwise set `plan = "hobby"`. Set `vandlySubscriptionStatus = "canceled"`, `vandlyLastEventAt = timestamp`.
   - Respond `HTTP 200 OK`.
7. If user does NOT exist:
   - Log warning for unresolved customer email and respond `HTTP 200 OK` (or park event if required).

---

### B. User Upgrade & Checkout Flow

**USER ACTION (INPUT)**
* Authenticated user navigates to `/upgrade` or `/dashboard/billing`.
* User chooses "Pay with Vandly" button.

**EXPECTED SYSTEM BEHAVIOR**
* Redirect user to `https://stg-app.vandly.co/checkout/pay_aa56e06fa51495015f2b8ce3461bbd1f?interval=month` (configured via `NEXT_PUBLIC_VANDLY_CHECKOUT_URL`), prefilling email parameter (`?customerEmail=...` or `?email=...`) with user's account email.

---

## 4. Database & Schema Changes

Modify `convex/schema.ts` to include optional Vandly subscription fields on the `users` table:

```typescript
users: defineTable({
  name: v.string(),
  email: v.string(),
  avatarUrl: v.optional(v.string()),
  tokenIdentifier: v.string(),
  clerkId: v.optional(v.string()),
  plan: v.union(v.literal('hobby'), v.literal('pro')),
  polarCustomerId: v.optional(v.string()),
  polarSubscriptionId: v.optional(v.string()),
  polarSubscriptionStatus: v.optional(v.string()),
  polarLastEventAt: v.optional(v.number()),
  // New Vandly Fields
  vandlySubscriptionId: v.optional(v.string()),
  vandlySubscriptionStatus: v.optional(v.string()),
  vandlyLastEventAt: v.optional(v.number())
})
  .index('by_token', ['tokenIdentifier'])
  .index('by_clerk_id', ['clerkId'])
  .index('by_polar_customer_id', ['polarCustomerId'])
  .index('by_email', ['email'])
  .index('by_vandly_subscription_id', ['vandlySubscriptionId'])
```

---

## 5. Constraints

* **Security**: HMAC-SHA256 raw body signature verification is mandatory. Secrets must be stored in Convex environment variables (`VANDLY_WEBHOOK_SECRET`).
* **Coexistence**: Vandly state must not inadvertently wipe out or override an active Polar subscription. Entitlement (`plan`) calculation must evaluate both providers: user is `pro` if `polarSubscriptionStatus === "active"` OR `vandlySubscriptionStatus === "active"`.
* **Idempotency & Ordering**: Replayed webhooks or out-of-order deliveries must be ignored using event timestamps.
* **Performance**: Webhook HTTP endpoint must respond quickly with `2xx` within 10 seconds to avoid trigger timeouts.

---

## 6. Edge Cases and Error Handling

* **Missing Webhook Secret**: If `VANDLY_WEBHOOK_SECRET` environment variable is not configured, log error and return `500 Webhook not configured`.
* **Invalid Signature**: If HMAC-SHA256 signature does not match, return `400 Invalid signature`.
* **Unmatched Product ID**: If webhook payload `productId` does not match `VANDLY_PRODUCT_ID`, return `200 OK` and log ignored event.
* **Out-of-Order Webhooks**: If an event's `timestamp` is prior to `vandlyLastEventAt`, log and return `200 OK` without altering user plan.
* **Unregistered Customer Email**: If no user matches `customerEmail`, log warning and return `200 OK`.
* **Cancellation with Dual Subscriptions**: If user cancels Vandly subscription but has an active Polar subscription, user plan remains `pro`.

---

## 7. Acceptance Criteria

This feature is considered complete when:

1. `users` schema in `convex/schema.ts` includes `vandlySubscriptionId`, `vandlySubscriptionStatus`, and `vandlyLastEventAt`.
2. Convex environment variables (`VANDLY_WEBHOOK_SECRET`, `VANDLY_PRODUCT_ID`, `NEXT_PUBLIC_VANDLY_CHECKOUT_URL`) are defined and documented in `.env.example`.
3. `POST /vandly-webhook` HTTP route in `convex/http.ts` correctly verifies raw HMAC-SHA256 signatures using `crypto.createHmac`.
4. `subscription.created` and `subscription.renewed` events correctly upgrade the user's plan to `pro` in Convex.
5. `subscription.canceled` event correctly downgrades user plan to `hobby` (unless Polar subscription is active).
6. Out-of-order events are guarded and safely ignored.
7. Upgrade and Billing pages provide distinct checkout options for both Vandly and Polar.
8. Type checks (`pnpm run typecheck`), linting (`pnpm run lint`), and Convex code generation (`pnpm run convex:gen`) pass cleanly without errors.

---

## 8. Relevant MCPs, Skills, and Tools

### Model Context Protocols (MCPs)
* **ref (ref_search_documentation, ref_read_url)**: Utilized to cross-reference Convex HTTP action standards and Node.js HMAC crypto functions.

### Core Architecture & Implementation Skills
* **effect-ts**: Applied for pure functional error handling and Effect v4 patterns on backend logic.
* **domain-modeling**: Used to ensure clear boundary terms between Polar subscriptions, Vandly subscriptions, and overall user entitlements (`plan`).
* **create-spec**: Used to generate and structure this specification document.
