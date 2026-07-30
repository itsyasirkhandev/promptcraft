# Technical Design Plan: Vandly Payment Integration

Technical design specification for implementing co-existing Vandly payment checkout, HMAC-SHA256 webhook processing, and entitlement state management in Convex.

---

## 1. Objective

Implement Vandly payment integration alongside existing Polar billing, allowing users to:

* Purchase "Promptcrafts Pro" subscriptions via Vandly checkout links.
* Process incoming Vandly webhook events (`subscription.created`, `subscription.renewed`, `subscription.canceled`).
* Authenticate incoming webhooks using raw HMAC-SHA256 body signature verification.
* Safely manage entitlement state (`plan`: `hobby` vs `pro`) without corrupting or overriding existing Polar subscriptions.
* Select between Vandly and Polar options on the Upgrade and Billing pages.

---

## 2. Tech Stack

* **Frontend:** Next.js (App Router), React, Tailwind CSS
* **Backend:** Convex (HTTP Actions, Internal Mutations, Internal Queries)
* **Functional Runtime / Effect:** Effect v4 (for typed error handling and server config)
* **Security / Crypto:** Node.js `crypto` (`crypto.createHmac('sha256', secret)`)
* **Database:** Convex Database Schema

**Why this stack?**

* Convex provides low-latency serverless state management and HTTP endpoint hosting (`httpAction`).
* Node.js `crypto` natively supports HMAC-SHA256 hex encoding required for Vandly signature verification.
* Effect v4 maintains unified backend environment configuration across all Convex handlers.
* Tailwind CSS facilitates building clean, responsive co-existing payment option cards on the UI.

---

## 3. High-Level Architecture

The feature is divided into three distinct layers of responsibility:

**A. Frontend (Next.js / React)**

* Render payment option cards on `/upgrade` and `/dashboard/billing`.
* Provide direct checkout triggers for both Vandly and Polar.
* Pass authenticated user email to Vandly checkout link parameters.

**B. HTTP Webhook Layer (Convex `httpAction`)**

* Receive `POST /vandly-webhook` requests.
* Extract raw request body string and verify `X-Vandly-Signature` header.
* Parse event payload, validate `X-Vandly-Event` and `productId === VANDLY_PRODUCT_ID`.
* Resolve user record via Convex `by_email` index.

**C. Database & Business Logic (Convex Mutations)**

* Atomically apply subscription state changes (`vandlySubscriptionId`, `vandlySubscriptionStatus`, `vandlyLastEventAt`).
* Recalculate `users.plan` (`pro` if either Polar OR Vandly subscription is active; `hobby` otherwise).
* Prevent out-of-order state overwrites using timestamp comparison.

```
[ Vandly Webhook Service ]
            │
            ▼ (HTTP POST /vandly-webhook)
[ Convex httpAction Handler ] ── (Verify HMAC-SHA256 Signature)
            │
            ▼ (Run Internal Mutation)
[ User Resolution & Entitlement ] ── (Index: by_email)
            │
            ▼ (Patch Record)
[ Convex Database (users table) ]
```

---

## 4. Data Model

The `users` table schema in `convex/schema.ts` is updated with optional Vandly tracking fields:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    tokenIdentifier: v.string(),
    clerkId: v.optional(v.string()),
    plan: v.union(v.literal("hobby"), v.literal("pro")),
    
    // Existing Polar Billing Fields
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
    polarSubscriptionStatus: v.optional(v.string()),
    polarLastEventAt: v.optional(v.number()),

    // New Vandly Billing Fields
    vandlySubscriptionId: v.optional(v.string()),
    vandlySubscriptionStatus: v.optional(v.string()),
    vandlyLastEventAt: v.optional(v.number()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_clerk_id", ["clerkId"])
    .index("by_polar_customer_id", ["polarCustomerId"])
    .index("by_email", ["email"])
    .index("by_vandly_subscription_id", ["vandlySubscriptionId"]),

  prompts: defineTable({ /* ... */ }),
  pendingSubscriptions: defineTable({ /* ... */ }),
});
```

---

## 5. Core Design Decisions

### Decision 1: HMAC-SHA256 Signature Verification on Raw Request Body
*Why:* Vandly computes the signature on the exact raw request payload. Parsing JSON first and re-serializing will alter whitespace or key ordering, leading to signature mismatch. We use `request.text()` to capture the exact string for `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`.

### Decision 2: Dual-Provider Co-existing Entitlement Logic
*Why:* A user may have an active subscription in Polar or Vandly. When processing a `subscription.canceled` event from Vandly, the mutation checks if `polarSubscriptionStatus === 'active'` before downgrading `plan` to `hobby`. This guarantees a user with an active Polar subscription is never accidentally downgraded by a Vandly cancellation.

### Decision 3: User Resolution via Email Index
*Why:* Vandly webhooks pass `customerEmail` inside `data`. Using Convex's `by_email` index allows sub-millisecond user lookup without extra database scanning.

### Decision 4: Timestamp Ordering Guards
*Why:* Network delays or retries can cause webhooks to arrive out of sequence. Comparing incoming event `timestamp` against stored `vandlyLastEventAt` ensures an older redelivered event cannot overwrite a newer status.

---

## 6. Core Functional Flows

### A. Signature Verification & Event Routing (`convex/http.ts`)

```typescript
import crypto from "node:crypto";

function verifyVandlySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader)
  );
}
```

### B. Entitlement Recalculation & Mutation

```typescript
// Inside convex/users.ts or internal mutation handler
export const updateSubscriptionFromVandly = internalMutation({
  args: {
    email: v.string(),
    subscriptionId: v.string(),
    event: v.string(),
    eventTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      console.warn(`vandly-webhook: no user found for email ${args.email}`);
      return;
    }

    if (user.vandlyLastEventAt && args.eventTimestamp <= user.vandlyLastEventAt) {
      console.log("vandly-webhook: ignored out-of-order event");
      return;
    }

    let isVandlyActive = false;
    let newStatus = user.vandlySubscriptionStatus;

    if (args.event === "subscription.created" || args.event === "subscription.renewed") {
      isVandlyActive = true;
      newStatus = "active";
    } else if (args.event === "subscription.canceled") {
      isVandlyActive = false;
      newStatus = "canceled";
    }

    const isPolarActive = user.polarSubscriptionStatus === "active";
    const computedPlan = isVandlyActive || isPolarActive ? "pro" : "hobby";

    await ctx.db.patch(user._id, {
      plan: computedPlan,
      vandlySubscriptionId: args.subscriptionId,
      vandlySubscriptionStatus: newStatus,
      vandlyLastEventAt: args.eventTimestamp,
    });
  },
});
```

### C. Webhook HTTP Route Handler

```typescript
http.route({
  path: "/vandly-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.VANDLY_WEBHOOK_SECRET;
    if (!secret) return new Response("Webhook not configured", { status: 500 });

    const rawBody = await request.text();
    const signature = request.headers.get("x-vandly-signature");

    if (!verifyVandlySignature(rawBody, signature, secret)) {
      return new Response("Invalid signature", { status: 400 });
    }

    const payload = JSON.parse(rawBody);
    const configuredProductId = Number(process.env.VANDLY_PRODUCT_ID || 6);

    if (payload.data?.productId !== configuredProductId) {
      return new Response(null, { status: 200 });
    }

    const eventTimestamp = new Date(payload.timestamp).getTime();

    await ctx.runMutation(internal.users.updateSubscriptionFromVandly, {
      email: payload.data.customerEmail,
      subscriptionId: payload.data.subscriptionId,
      event: payload.event,
      eventTimestamp,
    });

    return new Response(null, { status: 200 });
  }),
});
```

---

## 7. Development Plan

1. **Schema Update & Codegen**: Update `convex/schema.ts` with Vandly fields and index. Execute `pnpm run convex:gen`.
2. **Environment Variables**: Add `VANDLY_WEBHOOK_SECRET`, `VANDLY_PRODUCT_ID`, and `NEXT_PUBLIC_VANDLY_CHECKOUT_URL` to `.env.example`.
3. **Backend Internal Mutation**: Implement `updateSubscriptionFromVandly` in Convex with dual-provider entitlement check.
4. **HTTP Webhook Route**: Register `POST /vandly-webhook` in `convex/http.ts` with HMAC-SHA256 signature verification.
5. **UI Integration**: Update Upgrade (`app/(authed)/upgrade/page.tsx`) and Billing (`app/(authed)/dashboard/billing/page.tsx`) pages to present Vandly payment alongside Polar.
6. **Verification**: Run `pnpm run convex:gen`, `pnpm run lint`, and `pnpm run typecheck` to verify complete type safety.
