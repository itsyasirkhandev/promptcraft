# ADR 0003: Effect-TS in Convex function handlers

**Status**: Updated (supersedes original v3 constraint)  
**Date**: 2025-01-01 (revised 2026-06-09)

## Context

Convex function handlers are plain async functions. We need structured logging and typed error handling.

## Decision

We use **Effect-TS v4** inside Convex handlers for structured logging and typed error pipelines.

The canonical pattern is `Effect.gen + Effect.tryPromise` for all async work — including `ctx.db` calls.

## Pattern

```typescript
export const myMutation = effectAuthedMutation({
  args: { value: v.number() },
  handler: (args) => Effect.gen(function* () {
    const { identity } = yield* AuthedContext;
    yield* Effect.logInfo(`Operation for: ${identity.name}`);

    // Convex db calls are wrapped in Effect.tryPromise
    const { db } = yield* ConvexDB;
    yield* Effect.tryPromise(() =>
      (db as GenericDatabaseWriter<DataModel>).insert('table', { value: args.value })
    );
  })
});
```

## Why Effect.gen + tryPromise is safe with Convex (v4)

In Effect v4, `yield* Effect.tryPromise(fn)` is the standard way to lift an async function
into the Effect world. The generator suspends at each `yield*`, awaiting the underlying
promise through Effect's runtime — not through a raw `await`. Convex's reactive system
sees a single top-level `Effect.runPromise(...)` call and a returned `Promise`, which is
all it needs. There is no conflict with Convex's transaction semantics.

> **Previous constraint (now retired)**: The original ADR said "Do NOT wrap Convex db calls
> inside Effect.gen". This was based on Effect v2/v3 generator semantics where
> `Effect.gen(function*() {...})` was not async-capable in the same way.
> In Effect v4 this is no longer a concern.

## Rationale

- **Structured logging**: `Effect.logInfo(...)` provides structured, traceable log output
- **Typed errors**: `Schema.TaggedErrorClass` enables typed error channels
- **Uniform style**: all async work (logging AND db calls) goes through `yield*` — one mental model
- **Convention teaching**: one consistent pattern for AI agents and developers to learn from

## Consequences

- `effect` is a production dependency
- Every Convex function handler uses `effectAuthed` or `effectPrivate` wrappers returning an `Effect`
- Demo files (`authed/demo.ts`, `private/demo.ts`) show the same pattern as real feature files

