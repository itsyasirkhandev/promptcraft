# ADR 0004: Authed guard + function-visibility convention

**Status**: Accepted (updated 2026-06-09; revised to drop the API-key `private` guard per Convex guidelines)
**Date**: 2025-01-01

## Context

Convex functions need different security models depending on who calls them.

## Decision

### Authed guard (`convex/authed/helpers.ts`)
- For **client-facing** functions
- Validates the Clerk JWT via `ctx.auth.getUserIdentity()`
- Injects `ctx.identity` into the handler as `AuthedContext` Effect Service
- Use: `effectAuthedQuery`, `effectAuthedMutation`, `effectAuthedAction`

### Function visibility (replaces the former API-key "private" guard)

The previous `convex/private/helpers.ts` API-key guard (public `query`/`mutation`/`action`
wrappers validating a key from function arguments) was removed as dead code. It also conflicted
with the Convex guidelines: "Do NOT use `query`, `mutation`, or `action` to register sensitive
internal functions that should be kept private." Use instead:

- **Convex-to-Convex calls** — `internalQuery`/`internalMutation`/`internalAction` (e.g.
  `convex/private/users.ts`). These are not internet-exposed and need no secret plumbing.
- **External callers (Next.js server, third parties)** — `httpAction` routes in `convex/http.ts`,
  or the `authed` guards when the caller carries a Clerk JWT.
- Never expose API-key-guarded functions as public API.

## Rationale

- **Single auth check**: `customCtxAndArgs` defines the identity check once, all three wrappers (query/mutation/action) share it
- **Type safety**: `ctx.identity` is typed and guaranteed non-null inside authed handlers
- **Separation of concerns**: Client-facing vs internal APIs have different security requirements
- **Deep Modules**: The effect wrappers allow us to write unified feature logic directly in the `authed/` handlers, avoiding a shallow passthrough to a separate `services/` layer.

## When to use which

| Scenario | Guard / Registration |
|----------|---------------------|
| React hook calls (useQuery, useMutation) | `authed` |
| Server component preloading | `authed` |
| Convex-to-Convex calls (scheduler, webhooks, actions) | `internal*` |
| External backend/third-party callers | `httpAction` routes |
| Cron jobs | `internal` (Convex built-in) |
| Webhooks | `httpAction` |

## Demo files

- `convex/authed/demo.ts` — Minimal working example of the authed pattern (note: the demo files referenced here were removed from the repo; this entry is kept as history).
- ~~`convex/private/demo.ts`~~ — removed with the API-key guard
