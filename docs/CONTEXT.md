# Project Context — Clerk, Convex, Nextjs Starter Template

A convention-heavy starter template for building real apps.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend framework | Next.js (App Router) |
| Backend / database | Convex |
| Auth provider | Clerk |
| State management | Zustand with Immer + Persist |
| Backend effects | Effect-TS (structured logging, typed errors) |
| Styling | Tailwind CSS |
| Icons | Phosphor Icons |
| Testing | Vitest + convex-test + @testing-library/react |

## Domain Glossary

| Term | Definition |
|------|------------|
| **Viewer** | The currently authenticated user, derived server-side from the JWT token |
| **User** | A Convex document in the `users` table, synced from Clerk via Webhooks |
| **Number** | A demo entity stored in Convex — represents any simple data record |
| **Auth Guard** | A `customCtxAndArgs` wrapper that validates the JWT and injects `ctx.identity` |
| **Authed function** | A Convex query/mutation/action protected by the auth guard (client-facing) |
| **Private function** | A Convex function protected by an API key guard (server-to-server) |
| **Prompt Inventory Analytics** | Aggregate facts derived from the prompts currently owned by a Viewer, excluding usage events such as views, copies, or provider opens |
| **UTC Daily Bucket** | A calendar day from 00:00:00 through 23:59:59 UTC used to group prompt creation timestamps consistently |
| **Public Slug** | The URL-safe, unique, stable identifier for a public prompt; set once on the first isPublic transition, retained across toggles and title/content edits, gated by isPublic on the public read |
| **Public Prompt DTO** | The unauthenticated-safe projection of a prompt + its author, stripped of userId/email/clerkId/polarCustomerId and returned only by api.public.prompts.getBySlug |

## Conventions

### Route Groups
- `(public)` — Routes accessible without authentication (landing page)
- `(authed)` — Routes requiring Clerk authentication (dashboard, features)

### Convex Function Organization
- `convex/authed/` — Client-facing functions protected by Clerk JWT
- `convex/private/` — Server-to-server functions protected by API key
- Each feature gets its own file (e.g., `numbers.ts`, `users.ts`)
- Demo files (`demo.ts`) are kept as AI-readable convention references

### Component Organization
- `components/auth/` — Authentication-related UI (AuthGuard, UserProfile)
- `components/providers/` — Context providers (ConvexClientProvider)
- `components/skeletons/` — Loading skeleton components
- `components/ui/` — Shared UI primitives

### State Management
- Zustand for client UI state (theme, sidebar)
- Convex for server state (all business data)
- Never duplicate server state in Zustand

### Effect-TS Usage
- Used in Convex handlers for structured logging
- Use `Effect.runPromise(Effect.logInfo(...))` pattern for logging inside async handlers
- Do NOT wrap Convex db calls inside Effect.gen generators (they need async/await)
