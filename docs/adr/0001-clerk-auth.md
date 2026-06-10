# ADR 0001: Clerk Auth over alternatives

**Status**: Accepted  
**Date**: 2025-01-01 (Updated 2026-06-10)

## Context

This starter template needs an authentication provider that integrates with Convex.
Options considered: Clerk, Auth.js, Firebase Auth, custom JWT.

## Decision

We chose **Clerk** for authentication.

## Rationale

- **Convex integration**: Clerk issues JWTs that Convex can verify seamlessly via its built-in integration.
- **Developer experience**: Clerk provides drop-in UI components (SignIn, SignUp, UserButton) that drastically reduce boilerplate.
- **Webhooks**: Clerk webhooks make it easy to sync user data (like creation, updates, deletions) directly to our Convex database.
- **Ecosystem**: Modern Next.js patterns, including Server Actions and middleware, are well-supported by Clerk.

## Trade-offs

- **Cost**: Clerk has a free tier, but scaling beyond it might incur higher costs compared to raw Firebase or self-hosted alternatives.
- **Vendor lock-in**: We are tied to Clerk's components and webhook formats.

## Consequences

- We use Clerk's React SDK (`@clerk/nextjs`) to handle auth state on the client.
- `ClerkProvider` wraps the app, and `ConvexProviderWithClerk` handles injecting the token into Convex.
- We rely on Clerk webhooks (handled via `httpAction` in Convex) to create and sync user records in the database.
