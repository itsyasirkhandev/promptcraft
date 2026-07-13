# Convex Prompt Integration Specification

## 1. Problem Statement

Currently, the user's created prompts are saved only in the client's local storage via a Zustand persist store. This means that:
* Prompts are device-specific and do not sync across different sessions or devices.
* There is no server-side persistent database for users' templates.
* Public sharing of prompts cannot be implemented securely or collaboratively.
* Backend constraints and schemas are not enforced at the database level.

**Solution:** This feature migrates all prompt management and storage from the local Zustand store to the Convex backend database. We will use the Clerk user session, secure Convex custom authed functions using the Effect v4 framework, implement server-side validation mirroring the frontend Zod schemas, and apply multi-layered auth verification (Next.js Edge middleware, client-side AuthGuard, and Convex server-side owner validation).

---

## 2. Functional Requirements

The system should:
* **Persist Prompts in Convex Database:** Store and retrieve all user prompts in a Convex `prompts` table linked to their `users` document.
* **Support Create, Read, Update, Delete (CRUD) Operations:**
  * Create a prompt using the "Create Prompt" form.
  * Update an existing prompt using the "Edit Prompt" form (only allowed for the prompt owner).
  * Delete a prompt from the dashboard (only allowed for the prompt owner).
  * List all prompts belonging to the currently logged-in user.
  * Get a specific prompt by its ID (allowed if the prompt is public OR owned by the viewer).
* **Execute Server-Side Validation:** Validate prompt inputs on the backend (lengths, category constraints, tag uniqueness, structure of template fields) and reject invalid requests with structured validation errors.
* **Apply Multi-Layered Authentication:**
  * **Layer 1 (Edge Middleware):** Protect all route groupings matching `/dashboard(.*)` and `/prompt(.*)` in `proxy.ts` using Clerk's `clerkMiddleware` to redirect unauthorized users.
  * **Layer 2 (Client Component Guard):** Use client-side `AuthGuard` in layout wrappers to show a sign-in dialog for signed-out users.
  * **Layer 3 (Database Owner Check):** Wrap all client-exposed write/delete mutations and user-scoped queries with the `effectAuthed` guard. Assert document ownership on every edit or delete request.

---

## 3. Inputs and Outputs: Prompt Management Flow

### 1. Listing User Prompts
* **INPUT:** React page load or hook execution on `/dashboard/prompts`.
* **SYSTEM BEHAVIOR:**
  1. Call `useQuery(api.prompts.list)`.
  2. The Convex backend retrieves the authenticated `viewer` from the Clerk JWT.
  3. Query the database using the index `by_userId` to fetch prompts matching `viewer._id`.
  4. Return the list of prompts to the client.
  5. The client performs local filtering, searching, and sorting reactively for instantaneous UI response.

### 2. Creating a Prompt
* **INPUT:** User fills out form on `/prompt/create` and clicks "Create Prompt".
* **SYSTEM BEHAVIOR:**
  1. The client-side form validates values using Zod (`promptSchema`).
  2. Call `useMutation(api.prompts.create)` passing the values.
  3. The Convex backend extracts the `viewer` document.
  4. Run backend validation checks (`convex/authed/validation.ts`):
     * Title: non-empty, max 300 characters.
     * Content: non-empty, max 10,000 characters.
     * Tags: max 20, unique values, each tag max 30 characters.
     * If `isPublic` is true: `category` is required and must be an allowed category.
     * Template fields: correct format.
  5. If validation fails, yield a `ValidationError` which maps to a client-visible error.
  6. If validation passes, insert the document into the `prompts` table with `userId: viewer._id`.
  7. Show success toast and redirect to `/dashboard/prompts`.

### 3. Editing a Prompt
* **INPUT:** User fills out form on `/prompt/[id]/edit` and clicks "Save Changes".
* **SYSTEM BEHAVIOR:**
  1. Call `useMutation(api.prompts.update)` with prompt `id` and the updated values.
  2. Retrieve the authenticated `viewer` document.
  3. Fetch the existing prompt from the database. If not found, throw `ValidationError` or a custom `NotFoundError`.
  4. Verify ownership: Check if `existingPrompt.userId === viewer._id`. If not, throw `UnauthorizedError`.
  5. Run backend validation checks.
  6. Update the prompt document and set `updatedAt` to `Date.now()`.
  7. Return success to the client, show success toast, and redirect.

---

## 4. Constraints

* **Effect v4 Syntax:** All Convex handlers in `convex/authed/prompts.ts` must use the `effectAuthedQuery` and `effectAuthedMutation` helpers, wrapping all database calls in `Effect.tryPromise` inside `Effect.gen(function* () { ... })`.
* **Validation Structure:** Mirror Zod logic on the backend inside `convex/authed/validation.ts` using schema validations or manual constraint checks, throwing `ValidationError` to surface fields and messages.
* **State Separation:** Purge prompts state from Zustand. Delete `store/slices/promptsSlice.ts` and update `store/index.ts` to remove the prompts slice and its persistence properties, keeping Zustand only for UI preferences (theme, sidebar).
* **Package Management:** Run standard `pnpm` command to install packages if needed (no additional packages are anticipated as `effect` and `zod` are already installed).
* **Convex Routing:** Expose functions through client-facing `authed` directories: `convex/authed/prompts.ts`.

---

## 5. Edge Cases and Error Handling

* **Unauthenticated User Attempting Write:**
  * Next.js Edge middleware (`proxy.ts`) and client-side `AuthGuard` block access.
  * If a request reaches Convex, `authedMutation` throws a `ConvexError` tag `UnauthorizedError`, blocking execution.
* **Editing/Deleting Someone Else's Prompt:**
  * The handler verifies ownership (`prompt.userId === viewer._id`). If they do not match, the query or mutation aborts and throws `UnauthorizedError`.
* **Retrieving a Public Prompt by Non-Owner:**
  * `prompts.get` allows fetching if the prompt is public (`isPublic: true`) OR if the viewer is the owner. If both are false, throw `UnauthorizedError`.
* **Invalid Input Types:**
  * Checked by Convex arguments validation (`v` validators) at the function entry point.
  * Checked by custom validator logic (`validation.ts`) to enforce string limits and categories.
* **Duplicate Tags:**
  * Prevented by backend validation, which checks `new Set(tags).size === tags.length`.

---

## 6. Acceptance Criteria

The feature is considered complete if:
* The `prompts` table schema and indexes are added to `convex/schema.ts` and generated successfully (`pnpm run convex:gen`).
* The validation file `convex/authed/validation.ts` is implemented.
* The API file `convex/authed/prompts.ts` contains `create`, `update`, `remove`, `list`, and `get` functions utilizing the Effect v4 framework.
* `proxy.ts` is updated to protect route access matching `/dashboard` and `/prompt` using Clerk's `clerkMiddleware`.
* The Zustand local store (`store/slices/promptsSlice.ts` and `store/index.ts`) is cleaned up and only UI state persists.
* The Next.js pages:
  * `/dashboard/prompts` uses `useQuery(api.prompts.list)` and client-side search/sort.
  * `/prompt/create` uses `useMutation(api.prompts.create)`.
  * `/prompt/[id]/edit` uses `useQuery(api.prompts.get)` and `useMutation(api.prompts.update)`.
  * `/prompt/[id]/use` uses `useQuery(api.prompts.get)`.
* Visual loading states / skeletons are handled properly while data is being fetched from Convex.
* The app compiles and passes all checks (`pnpm run lint` and `pnpm run typecheck`).

---

## 8. Relevant MCPs, Skills, and Tools

* **convex-performance-audit:** Used during schema design to define index configurations (e.g. `by_userId` and `by_isPublic`) and prevent slow table scans or read amplification.
* **vercel-react-best-practices:** Leveraged to ensure the Next.js pages handle loading states reactively without layout shifts and that data subscriptions are optimized.
