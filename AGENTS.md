## Project guidelines

- use pnpm for the package manager
- when installing new packages, use 'pnpm add' instead of manually editing the package.json file
- use effect v4 for all backend code and use the effect ts skill for the update v4 syntax
- use modern React and Nextjs patterns and primitives
- when defining convex actions, queries, and mutations that are exposed to the client use the
  authed' setup in 'convex/authed'
- when defining convex actions, queries, and mutations that are called from the backend use the
  'private' setup in 'convex/private
- use the convex service for calling convex queries, actions, and mutations from the backend
- avoid 'as any' at all costs, try to infer types from functions as much as possible
- use tailwindcss for styling whenever possible, only resort to custom css if needed
- after making changes to convex, run 'pnpm run convex:gen' to generate the new api 
- run 'pnpm run lint' to check for linting errors, run 'pnpm run typecheck' 




<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->


