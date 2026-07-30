# Promptcraft Convex Backend Review

**Repository:** [itsyasirkhandev/promptcraft](https://github.com/itsyasirkhandev/promptcraft)  
**Reviewed revision:** `adfbb2f15452ff3044ab58964af2c0340ddea2cf` on `main`  
**Review date:** July 30, 2026  
**Scope:** Convex schema, authentication, prompt operations, Effect integration, billing, Clerk and Polar webhooks, tests, repository instructions, and generated Convex AI guidelines.

> This is a static review of the checked-in code. The repository's tests, linting, type checking, and Convex code generation were not executed as part of this review.

---

## Executive summary

The backend has a good structural foundation. Authentication is centralized, prompt ownership is checked server-side, public responses avoid exposing full user records, billing URLs are validated, webhook signatures are checked, and the billing test suite covers several important lifecycle scenarios.

The primary weakness is the identity model. The code deliberately merges Convex users and Polar customers by email even when stable identifiers disagree. Email is contact data, not proof of account ownership. This can connect a Clerk identity to another user's prompts, plan, or billing customer.

There are also several direct departures from the generated Convex AI guidelines: unbounded `.collect()` calls, untyped environment access, inconsistent index naming, broad `v.any()` validation, large one-transaction cleanup operations, and test-environment deviations.

**Overall assessment: 6.5/10.**

**Release recommendation:** Do not consider account linking and billing production-safe until findings F-01 and F-02 are resolved. Address F-03 through F-06 before scaling usage or relying on webhook processing for revenue-critical entitlement changes.

---

## Severity summary

| ID | Severity | Finding | Primary risk |
|---|---|---|---|
| F-01 | Critical | Conflicting Clerk identities are merged by email | Cross-account access and ownership transfer |
| F-02 | Critical | Polar customers are claimed by matching email | Wrong billing customer or portal association |
| F-03 | High | Unbounded reads and writes | Convex limits, failed cleanup, oversized responses |
| F-04 | High | Partial subscription updates can clear known state | Lost billing identifiers/status |
| F-05 | High | Webhook idempotency uses timestamps instead of event IDs | Duplicate processing or ignored valid events |
| F-06 | High | Uncorrelatable billing events are acknowledged and lost | Permanent entitlement drift |
| F-07 | Medium | Environment variables are not centrally typed | Configuration drift and deployment failures |
| F-08 | Medium | Clerk webhook payload uses `v.any()` and first email | Malformed users and wrong email selection |
| F-09 | Medium | Schema index names are inconsistent with guidelines | Maintenance and convention drift |
| F-10 | Medium | Pro usage reports zero instead of actual usage | Incorrect product data |
| F-11 | Medium | Effect error serialization trusts arbitrary values | Secondary failures and internal data leakage |
| F-12 | Medium | Webhook tests mirror implementation secret encoding | False confidence in provider compatibility |
| F-13 | Medium | Email and customer uniqueness are not enforced | Duplicate or ambiguous identities |
| F-14 | Low | Some code/comments are stale or contradictory | Maintenance errors |
| F-15 | Low | Convex test setup departs from generated guidance | Environment-specific gaps |

---

## Detailed findings and best solutions

### F-01 — Critical: conflicting Clerk identities are merged by email

**Affected files**

- [`convex/users.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/users.ts)
- [`convex/authed/users.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/authed/users.ts)
- [`convex/users.test.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/users.test.ts)

The Clerk webhook resolves a user by `clerkId`, then reconstructed `tokenIdentifier`, then email. If an email match has a different Clerk ID, the code logs a warning and merges anyway. It subsequently overwrites the record's `clerkId` and `tokenIdentifier`.

The authenticated creation path also falls back to email if token and Clerk ID lookups fail. The test suite explicitly validates convergence when the stored Clerk ID and incoming Clerk ID differ.

**Impact**

A new or different identity can inherit another record's prompts, public content, plan, Polar customer ID, and subscription state. Email reuse, provider migration, duplicate test/production identities, webhook mistakes, or compromised email claims can trigger cross-account association.

**Best solution**

1. Use `identity.tokenIdentifier` as the canonical authenticated identity key.
2. Store the issuer and subject explicitly if provider-level correlation is required.
3. Never overwrite a nonmatching stable identity based only on email.
4. Treat an email collision as a conflict and stop the operation.
5. Create a controlled account-migration workflow for legitimate merges.
6. Replace the existing email-convergence test with tests proving that conflicting identities remain separate or fail closed.

**Recommended data model**

Create a dedicated identity table instead of placing every identity concern directly on `users`:

```ts
userIdentities: defineTable({
  userId: v.id("users"),
  tokenIdentifier: v.string(),
  issuer: v.string(),
  subject: v.string(),
  provider: v.literal("clerk"),
})
  .index("by_tokenIdentifier", ["tokenIdentifier"])
  .index("by_issuer_and_subject", ["issuer", "subject"]);
```

A verified identity row should be the only automatic path to a user. Email can help display or propose a migration, but it must not authorize one.

**Acceptance criteria**

- A matching email with a different token identifier never changes the existing user's identity.
- A webhook with a different Clerk ID cannot inherit another user's prompts or billing state.
- Legitimate migrations require an explicit, auditable operation.

---

### F-02 — Critical: Polar customers are claimed by email

**Affected file**

- [`convex/billing/provider.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/billing/provider.ts)

`ensureCustomer` checks the stored customer ID, then Polar external ID, then exact email. When it finds a customer by email, it saves that customer ID to the current Clerk user without proving that the customer's external ID belongs to the same identity.

**Impact**

The application can attach a user to another person's Polar customer. Portal creation subsequently trusts the stored customer ID, potentially exposing the wrong customer portal or associating checkout/subscription operations incorrectly.

**Best solution**

1. Use the Clerk ID as the Polar external ID and treat it as the ownership key.
2. Reuse a Polar customer only when its external ID matches the current Clerk ID.
3. If an email match has a different external ID, fail closed and alert.
4. If an email match has no external ID, migrate it only through a dedicated operation that first proves ownership.
5. Before creating a portal session, retrieve the customer and verify the external ID again.
6. Do not silently attach ambiguous legacy customers.

**Safer decision table**

| Polar lookup result | Action |
|---|---|
| Stored ID and matching external ID | Reuse |
| External ID match | Reuse and save locally |
| Email match with same external ID | Reuse |
| Email match with no external ID | Require controlled migration |
| Email match with different external ID | Reject and alert |
| No match | Create a new customer with Clerk ID as external ID |

**Acceptance criteria**

- A Polar customer with another external ID is never saved to the current user.
- Portal and checkout operations verify customer ownership.
- Tests cover matching email with different, missing, and matching external IDs.

---

### F-03 — High: unbounded reads and writes

**Affected files**

- [`convex/authed/prompts.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/authed/prompts.ts)
- [`convex/authed/promptAnalytics.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/authed/promptAnalytics.ts)
- [`convex/users.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/users.ts)

Problematic paths include:

- prompt listing that calls `.collect()`;
- analytics that loads the full user inventory;
- Clerk deletion that collects and deletes all prompts in one mutation;
- pending-subscription reconciliation that collects all matching records.

These directly conflict with the generated guidance to return bounded collections and batch large mutations.

**Impact**

- Queries can hit document, bandwidth, or execution limits.
- Pro users have unlimited prompt creation, so inventory growth is not bounded by product rules.
- User deletion can fail once the prompt count is large enough.
- Pending webhook reconciliation can exceed mutation transaction limits.

**Best solution**

#### Prompt list

Use Convex pagination:

```ts
args: { paginationOpts: paginationOptsValidator },
handler: async (ctx, args) =>
  ctx.db
    .query("prompts")
    .withIndex("by_userId_and_createdAt", q =>
      q.eq("userId", viewer._id),
    )
    .order("desc")
    .paginate(args.paginationOpts)
```

#### Analytics

Maintain a per-user aggregate document updated transactionally with prompt mutations:

```ts
promptStats: defineTable({
  userId: v.id("users"),
  total: v.number(),
  publicTotal: v.number(),
  templateTotal: v.number(),
})
  .index("by_userId", ["userId"]);
```

For 30-day trends, use daily bucket documents keyed by user and UTC date.

#### User deletion

Create a batched internal mutation that deletes, for example, 100 prompts at a time and schedules itself until no rows remain. Delete the user only after dependent records are gone.

#### Pending subscriptions

Read a small ordered batch, apply it, delete it, and schedule continuation. Add a retention/dead-letter policy.

**Acceptance criteria**

- No production user query returns an unbounded collection.
- Deleting a user with thousands of prompts completes through multiple transactions.
- Analytics cost does not grow linearly with the user's complete prompt history.

---

### F-04 — High: partial subscription updates can clear known state

**Affected file**

- [`convex/users.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/users.ts)

The comment above `buildSubscriptionPatch` says absent fields preserve known values, but `polarSubscriptionId` and `polarSubscriptionStatus` are assigned directly from optional arguments.

**Best solution**

Preserve existing values when arguments are absent:

```ts
return {
  polarCustomerId:
    args.polarCustomerId ?? user.polarCustomerId,
  polarSubscriptionId:
    args.polarSubscriptionId ?? user.polarSubscriptionId,
  polarSubscriptionStatus:
    args.polarSubscriptionStatus ?? user.polarSubscriptionStatus,
  plan: args.plan,
  polarLastEventAt:
    incomingAt ?? user.polarLastEventAt,
};
```

If clearing is a legitimate operation, model it explicitly with a discriminated update rather than using optional fields for both "preserve" and "clear."

**Acceptance criteria**

- Partial events cannot erase an existing subscription ID or status.
- Tests cover missing optional fields.

---

### F-05 — High: webhook idempotency uses timestamps rather than event IDs

**Affected files**

- [`convex/billing/webhooks.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/billing/webhooks.ts)
- [`convex/http.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/http.ts)
- [`convex/schema.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/schema.ts)

The parser extracts `eventId`, but it is not persisted. Replay protection relies on `eventTimestamp <= polarLastEventAt`.

**Impact**

- Duplicate pending rows can be created.
- Two legitimate events with identical timestamps can cause the second to be ignored.
- There is no durable audit trail showing which event changed an entitlement.

**Best solution**

Add a webhook-event ledger:

```ts
webhookEvents: defineTable({
  provider: v.literal("polar"),
  eventId: v.string(),
  eventType: v.string(),
  eventTimestamp: v.number(),
  status: v.union(
    v.literal("processing"),
    v.literal("applied"),
    v.literal("ignored"),
    v.literal("dead_letter"),
  ),
  processedAt: v.optional(v.number()),
  error: v.optional(v.string()),
})
  .index("by_provider_and_eventId", ["provider", "eventId"]);
```

The mutation applying the subscription should atomically check/claim the event ID and update the user. Keep timestamp comparison as a stale-order guard, not as primary idempotency.

**Acceptance criteria**

- Replaying an event ID produces no duplicate side effects.
- Different event IDs with equal timestamps are handled deterministically.
- Operators can inspect failed and ignored events.

---

### F-06 — High: uncorrelatable billing events are acknowledged and lost

**Affected file**

- [`convex/http.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/http.ts)

When a relevant, verified subscription event has neither a Clerk ID nor a Polar customer ID, the code logs the problem and returns success. Polar will not retry an acknowledged event.

**Best solution**

1. Always persist a verified relevant event by `eventId`, even when it cannot be correlated.
2. Mark it `dead_letter` or `unresolved` with the raw nonsecret identifiers and reason.
3. Return success only after durable persistence.
4. Add an alert and administrative retry/reconciliation path.
5. If persistence fails, return a retryable 5xx response.

**Acceptance criteria**

- No verified relevant event is acknowledged before being applied or durably recorded.
- Unresolved events are visible and retryable.

---

### F-07 — Medium: environment variables are not centrally typed

**Affected files**

- `convex/auth.config.ts`
- `convex/users.ts`
- `convex/emails.ts`
- `convex/http.ts`
- `convex/authed/billing.ts`
- `convex/services/ServerConfig.ts`

The generated Convex guidelines recommend declaring typed environment variables in `convex/convex.config.ts` and using generated environment access. The repository instead mixes direct `process.env`, Effect `Config`, ad hoc URL parsing, required values, and silently optional services.

**Best solution**

Create one typed configuration boundary and make every Convex module consume it. Categorize values as:

- required for all deployments;
- required only when billing is enabled;
- optional service configuration;
- public URL configuration.

Validate URLs, provider modes, and nonempty secrets once. Fail deployment or function initialization with a precise configuration error for required values.

**Acceptance criteria**

- Every Convex environment value has a declared type and one validation path.
- Missing billing configuration cannot produce a partially functional billing system.
- No module independently interprets the same variable differently.

---

### F-08 — Medium: Clerk payload uses `v.any()` and the first email

**Affected file**

- [`convex/users.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/users.ts)

`upsertFromClerk` accepts `data: v.any()`, and profile extraction uses explicit `any`. It selects `email_addresses[0]` rather than resolving Clerk's primary email address.

**Best solution**

- Define a narrow validator for the consumed Clerk fields.
- Require a nonempty Clerk user ID.
- Read `primary_email_address_id` and find the matching email entry.
- Track email verification status if email affects product behavior.
- Reject or dead-letter malformed events instead of creating incomplete users.
- Return `null` explicitly from Convex handlers.

**Acceptance criteria**

- A malformed payload cannot create a user with a missing ID.
- The stored email matches Clerk's selected primary email.
- Payload validation failures are observable.

---

### F-09 — Medium: schema index names do not consistently follow guidelines

**Affected file**

- [`convex/schema.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/schema.ts)

Examples include `by_userId_createdAt`, `by_userId_isPublic`, `by_clerkId`, and `by_polarCustomerId`. The generated guidance recommends including all indexed fields, joined consistently with `_and_`.

**Best solution**

Adopt one convention and update callers through code generation, for example:

- `by_userId`
- `by_userId_and_createdAt`
- `by_userId_and_isPublic`
- `by_isPublic_and_category_and_title`
- `by_clerkId`
- `by_polarCustomerId`

This is primarily maintainability work, but doing it before further schema growth will avoid a larger migration later.

---

### F-10 — Medium: Pro usage reports zero instead of actual usage

**Affected file**

- [`convex/authed/prompts.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/authed/prompts.ts)

`getUsage` returns zero prompts and zero public prompts for Pro users, regardless of actual inventory. Unlimited means there is no limit; it does not mean usage is zero.

**Best solution**

Return real counters with `null` limits:

```ts
{
  plan: "pro",
  promptsUsed: stats.total,
  promptsLimit: null,
  publicUsed: stats.publicTotal,
  publicLimit: null,
}
```

Use the aggregate counters proposed in F-03 rather than scanning the full prompt table.

---

### F-11 — Medium: Effect error serialization trusts arbitrary values

**Affected file**

- [`convex/effectHelpers.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/effectHelpers.ts)

`runEffect` enumerates all own properties and casts them to Convex `Value` without runtime validation. An error containing a class instance, function, cyclic object, or unsupported nested value can cause error serialization itself to fail. Provider bodies may also expose excessive internal details.

**Best solution**

Use an explicit client-safe error envelope:

```ts
type PublicError = {
  code: string;
  message: string;
  field?: string;
};
```

Map known tagged errors to this envelope. Convert unknown errors to a generic internal error with a correlation ID. Log full provider details server-side, not in client-visible `ConvexError` data.

**Acceptance criteria**

- All client errors contain Convex-safe values only.
- Unknown provider errors do not reveal secrets or raw response bodies.
- Error serialization cannot throw a second error.

---

### F-12 — Medium: webhook tests mirror the implementation's secret encoding

**Affected files**

- [`convex/billing/webhooks.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/billing/webhooks.ts)
- [`convex/billing/billing.test.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/billing/billing.test.ts)

The implementation passes `btoa(secret)` to Svix, and tests sign with the same transformation. This proves internal consistency but not compatibility with a real Polar signature.

**Best solution**

- Verify the expected secret format against the installed Polar/Svix documentation.
- Capture a sanitized real webhook fixture and its headers.
- Add a contract test that verifies the fixture without using the application's signing helper.
- Keep unit tests, but do not treat mirrored signing logic as provider-contract proof.

---

### F-13 — Medium: identity and customer uniqueness are assumed, not enforced

**Affected files**

- [`convex/schema.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/schema.ts)
- [`convex/userQueries.ts`](https://github.com/itsyasirkhandev/promptcraft/blob/adfbb2f15452ff3044ab58964af2c0340ddea2cf/convex/userQueries.ts)

`.unique()` detects duplicates only when the lookup runs; indexes do not themselves prevent duplicate values. Concurrent creation paths and historical data can still produce duplicate token identifiers, Clerk IDs, emails, or Polar customer IDs.

**Best solution**

- Consolidate user creation behind one internal mutation.
- Use deterministic identity documents or reservation records.
- Never use email as a unique authorization key.
- Add a maintenance query that detects duplicate stable identifiers.
- Fail closed if duplicates are detected instead of arbitrarily converging them.

---

### F-14 — Low: stale or contradictory comments and code

Examples:

- `convex/authed/users.ts` says Firebase even though the project uses Clerk.
- The slug update comments describe generating a fresh slug for private-to-public prompts with an existing slug, but the implementation preserves any existing slug.
- The partial-subscription comment says values are preserved while the code can clear them.
- Billing actions accept `productId` and `successUrl` arguments but intentionally ignore them, which creates a misleading client API.

**Best solution**

- Remove stale provider references.
- Make comments explain invariants, not historical implementation details.
- Remove unused client arguments from billing actions.
- Add lint rules for unused values where possible.

---

### F-15 — Low: Convex tests depart from generated testing guidance

The generated guidance recommends the Edge runtime and the `vite/client` reference for tests using `import.meta.glob`. Several test files override the environment to Node and locally cast `import.meta` instead.

This may be intentional for Node SDK behavior, but it means tests are not exercising exactly the runtime recommended by the Convex guidance.

**Best solution**

Split tests by runtime:

- Edge-runtime tests for queries, mutations, HTTP actions, and default-runtime code.
- Node-runtime tests for files requiring the Polar SDK or Node APIs.
- Add at least one deployed or integration-level billing contract test.

Also regenerate the AI guidelines because they target Convex `^1.41.0` while the project depends on `^1.42.1`.

---

## Positive findings

The following implementation choices are strong and should be preserved:

1. Authentication is centralized through custom authenticated wrappers.
2. Prompt update and deletion operations verify ownership server-side.
3. Hobby quota checks use indexed, bounded reads.
4. Public marketplace DTOs avoid exposing complete user documents.
5. Checkout and portal URLs are validated before being returned.
6. Sensitive billing synchronization primarily uses internal Convex functions.
7. Node-dependent action files are separated and marked with `"use node"`.
8. Webhook signatures and Polar product IDs are checked.
9. Subscription event ordering is considered through `polarLastEventAt`.
10. Billing, quota, replay, and authorization tests are substantially better than average.

---

## Recommended implementation roadmap

### Phase 0 — Safety freeze

Before adding more billing features:

- Stop merging users by email.
- Stop claiming Polar customers by email.
- Add tests that prove conflicting identities fail closed.

### Phase 1 — Identity hardening

1. Introduce `userIdentities` or equivalent canonical identity records.
2. Migrate existing users from token identifiers and Clerk IDs.
3. Detect duplicates before enforcing the new invariant.
4. Build an explicit account-migration operation for legitimate conflicts.
5. Verify billing customer ownership through the Clerk external ID.

### Phase 2 — Webhook reliability

1. Add the webhook-event ledger.
2. Persist every verified relevant event before acknowledging it.
3. Add event-ID idempotency.
4. Preserve timestamp ordering as a secondary guard.
5. Add unresolved/dead-letter states and alerting.
6. Fix partial subscription patches.

### Phase 3 — Scalability

1. Paginate prompt lists.
2. Add prompt aggregate counters and daily analytics buckets.
3. Batch user cascade deletion.
4. Batch pending-event reconciliation.
5. Add retention and retry policies.

### Phase 4 — Configuration and validation

1. Centralize typed environment configuration.
2. Replace `v.any()` with a Clerk payload validator.
3. Select Clerk's primary email correctly.
4. Normalize index names.
5. Standardize client-safe error envelopes.

### Phase 5 — Verification

Run the following after changes:

```bash
pnpm run convex:gen
pnpm run lint
pnpm run typecheck
pnpm run test:convex
pnpm run test:run
pnpm run build
```

Also perform integration tests with:

- a real Clerk test instance;
- a Polar sandbox customer;
- real signed Polar webhook deliveries;
- replayed and out-of-order events;
- Clerk webhook arriving before and after Polar events;
- account email changes and historical email reuse;
- users with thousands of prompts.

---

## Required regression tests

### Identity

- Same email plus different token identifier does not merge users.
- Same email plus different Clerk ID does not overwrite identity.
- Duplicate token identifiers fail closed and generate an operational error.
- Explicit migration is auditable and preserves intended data only.

### Polar customer ownership

- Same email plus different Polar external ID is rejected.
- Missing external ID requires a migration path.
- Portal generation re-verifies customer ownership.
- Duplicate Polar email matches fail closed.

### Webhooks

- Replaying the same event ID is a no-op.
- Different event IDs with the same timestamp are handled correctly.
- Out-of-order events do not downgrade newer state.
- An uncorrelatable event is persisted before returning 2xx.
- Partial events preserve known subscription fields.
- Dead-letter events can be retried.

### Scale

- Prompt list pagination returns stable cursors.
- A user with thousands of prompts can be deleted in batches.
- Analytics does not scan the entire prompt table.
- Pending-event reconciliation remains within transaction limits.

### Configuration

- Missing required production configuration fails clearly.
- Billing-disabled development deployments behave intentionally.
- Real provider webhook fixtures verify successfully.

---

## Definition of done

The remediation should not be considered complete until all of the following are true:

- [ ] Email is not used as automatic proof of account ownership.
- [ ] A Polar customer is never attached without verified external-ID ownership.
- [ ] Every relevant verified billing event is durably recorded.
- [ ] Webhook idempotency is keyed by provider event ID.
- [ ] Partial billing events cannot erase known state.
- [ ] Production queries return bounded or paginated results.
- [ ] Large cleanup operations run in batches.
- [ ] Analytics uses maintained aggregates rather than complete scans.
- [ ] Clerk payloads have narrow validators and primary-email handling.
- [ ] Environment configuration is centralized and typed.
- [ ] Errors returned to clients use a safe, stable schema.
- [ ] Real Clerk and Polar sandbox integration tests pass.
- [ ] `convex:gen`, lint, typecheck, tests, and production build pass.

---

## Final verdict

Promptcraft's Convex backend demonstrates good engineering intent, especially around wrappers, server-side authorization, URL validation, billing lifecycle tests, and out-of-order event handling. The main problem is not code organization; it is an unsafe identity assumption.

**Email must be treated as mutable profile data, not as an identity or billing ownership key.** Once that is corrected, the remaining issues are conventional reliability, scalability, and maintainability work.
