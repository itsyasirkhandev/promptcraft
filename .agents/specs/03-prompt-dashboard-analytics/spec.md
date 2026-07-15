# Prompt Dashboard Analytics Specification

## 1. Problem Statement

The authenticated `/dashboard` route currently contains starter content that displays basic user information and instructions for editing the page. It does not help users understand the prompt library they are building.

Users need a fast overview of their current prompt inventory so they can answer:

* How many prompts have I created?
* How many prompts are public?
* How many prompts use template mode?
* Have I created prompts recently?
* How is my library distributed across visibility, prompt type, and category?

The dashboard must also remain useful for a new user who has not created any prompts. A zero-prompt account should not render misleading empty charts or look like a failed data request.

**Solution:** Replace the starter sections on `/dashboard` with prompt inventory analytics backed by one compact, authenticated Convex query. The query will derive live aggregates from the authenticated Viewer's prompt documents. The frontend will present those aggregates through summary cards, shadcn charts, a dashboard-specific loading skeleton, and a clear first-prompt empty state.

This feature is limited to inventory analytics. It does not track prompt views, copies, edits, uses, AI-provider opens, or other behavioral events.

---

## 2. Functional Requirements

The system should:

### Backend and Data Model

* Add a compound `by_userId_createdAt` index to the existing `prompts` table using `['userId', 'createdAt']`.
* Keep the existing prompt document fields unchanged.
* Avoid adding an analytics table, counter table, event table, scheduled job, or denormalized analytics fields.
* Add one dedicated client-facing authed Convex query in `convex/authed/promptAnalytics.ts`.
* Name the query `getInventoryAnalytics`, exposed as `api.authed.promptAnalytics.getInventoryAnalytics` after Convex code generation.
* Define the query with the project's `effectAuthedQuery` wrapper and an empty argument validator.
* Require a registered authenticated Viewer before accessing prompt records.
* Read only prompt documents owned by the current Viewer.
* Return only fields required by the dashboard. Prompt titles, content, template fields, and tags must not be returned to the browser.
* Calculate all analytics in the query so category normalization and date bucketing have one canonical implementation.
* Return a complete payload in one reactive query rather than issuing a separate query for every card or chart.

### Summary Statistics

* Display four summary cards:
  * **Total Prompts**: all prompts currently owned by the Viewer.
  * **Public Prompts**: owned prompts where `isPublic` is `true`.
  * **Template Prompts**: owned prompts where `templateMode` is `true`.
  * **Created in Last 30 Days**: owned prompts whose `createdAt` falls within the returned 30-day UTC window.
* Display numeric zeroes in all four cards when the Viewer owns no prompts.
* Keep the cards visible in the empty state so a new user can understand which metrics will appear after creating prompts.

### Creation Trend Chart

* Display a shadcn/Recharts area chart titled **Prompts Created**.
* Show exactly 30 UTC daily buckets, ordered oldest to newest.
* Include the current UTC day as the final bucket.
* Include zero-count days so the x-axis does not omit gaps.
* Count a prompt in one bucket according to its numeric `createdAt` timestamp.
* Use a short, readable date label on the x-axis while preserving the canonical `YYYY-MM-DD` UTC date in the query payload.
* Provide a tooltip showing the date and exact prompt count.

### Distribution Charts

* Display a donut chart titled **Visibility** with Public and Private prompts.
* Display a donut chart titled **Prompt Type** with Template and Static prompts.
* Display a horizontal bar chart titled **Prompts by Category**.
* Use the shadcn chart primitives in `components/ui/chart.tsx` for chart containers, tooltips, and legends where applicable.
* Use the existing Recharts dependency. Do not add another charting dependency.
* Provide text labels or legends so chart meaning does not rely on color alone.

### Category Aggregation

* Treat an absent, empty, or whitespace-only category as **Uncategorized**.
* Trim surrounding whitespace before grouping a non-empty category.
* Group category names case-insensitively so `Writing`, `writing`, and ` Writing ` belong to one category.
* Choose the display casing using the most frequently stored trimmed variant.
* If casing variants have equal frequency, use the trimmed casing encountered first in the Viewer's prompt records.
* Preserve **Uncategorized** as its own category.
* Rank category groups by prompt count descending.
* Use the normalized display label ascending as the deterministic tie-breaker for equal counts.
* Render no more than six named category bars in addition to an optional **Other** bar.
* Reserve a named slot for **Uncategorized** when it exists, then fill the remaining named slots with the highest-ranked categorized groups until six named groups are selected.
* Combine every remaining categorized group into **Other**.
* Omit **Other** when no category groups remain after selecting the named groups.

### Dashboard Page

* Keep the existing dashboard heading and personalized welcome message.
* Replace the existing **User Information** and **Making changes** sections entirely.
* Widen the content from the current narrow starter layout so cards and charts can use the available dashboard area.
* Render the four summary cards first.
* Render the creation trend as the primary full-width chart.
* Render the donut charts in a responsive two-column section on larger screens and one column on small screens.
* Render the category chart at a width that keeps category labels readable.
* Use existing `Card`, `Button`, and chart primitives rather than creating replacement UI primitives.
* Keep the page reactive. Creating, editing, or deleting a prompt should update applicable analytics through Convex without a manual refresh.
* Preserve light and dark theme readability.

### Empty, Loading, and Error States

* Treat `undefined` from `useQuery` as loading, never as an empty prompt library.
* Replace `components/skeletons/DashboardSkeleton.tsx` with a dashboard-shaped skeleton containing a heading, four stat cards, and four chart placeholders.
* Keep skeleton dimensions close to loaded dimensions to reduce layout shift.
* When `totalPrompts` is `0`, display all four zero-valued cards and replace the charts region with one empty-state card.
* Do not render empty chart axes, donut rings, legends, or tooltips in the empty state.
* Explain that analytics will appear after the first prompt is created.
* Include a **Create your first prompt** CTA linking to `/prompt/create`.
* Continue using `app/(authed)/dashboard/error.tsx` as the route-level retryable error boundary.
* Do not display a successful zero-value payload when the query has failed.

---

## 3. Inputs and Outputs: Dashboard Analytics Flow

**USER ACTION (INPUT)**

* An authenticated Viewer navigates to `/dashboard`.
* The Viewer may subsequently create, update, or delete a prompt while the dashboard subscription is active.

**EXPECTED SYSTEM BEHAVIOR**

1. The dashboard invokes `api.authed.promptAnalytics.getInventoryAnalytics` with no arguments.
2. While the query result is `undefined`, the dashboard displays `DashboardSkeleton`.
3. The Convex auth guard resolves the authenticated Viewer.
4. The query reads only prompt documents whose `userId` equals the Viewer's Convex user ID.
5. The query calculates all-time summary and distribution values.
6. The query calculates a fixed 30-day UTC window ending on the current UTC day.
7. The query returns a compact analytics payload.
8. When `summary.totalPrompts` is greater than zero, the dashboard renders the cards and charts.
9. When `summary.totalPrompts` is zero, the dashboard renders the cards and first-prompt empty state instead of charts.
10. Convex reactively updates the payload when a relevant prompt document changes.

### Query Contract

The query should return the following logical shape. Exact TypeScript types should be inferred from the Convex function and generated API rather than duplicated in a handwritten response type.

```ts
{
  summary: {
    totalPrompts: number
    publicPrompts: number
    templatePrompts: number
    createdLast30Days: number
  }
  creationTrend: Array<{
    date: string
    count: number
  }>
  visibility: Array<{
    key: "public" | "private"
    label: "Public" | "Private"
    count: number
  }>
  promptTypes: Array<{
    key: "template" | "static"
    label: "Template" | "Static"
    count: number
  }>
  categories: Array<{
    key: string
    label: string
    count: number
  }>
  period: {
    timezone: "UTC"
    startDate: string
    endDate: string
    days: 30
  }
}
```

### UTC Window Definition

* Compute the current UTC day boundary from the query execution time.
* Set `endDate` to the current UTC calendar date.
* Set `startDate` to 29 UTC calendar days before `endDate`.
* Treat the window as starting at `00:00:00.000 UTC` on `startDate`.
* Include prompts through the query execution time on `endDate`.
* Return 30 date strings in `YYYY-MM-DD` format.
* Do not use browser-local timezone boundaries to decide which bucket owns a prompt.

### Schema and Index Plan

The existing `prompts` document remains the source of truth:

```ts
prompts: defineTable({
  userId: v.id('users'),
  title: v.string(),
  content: v.string(),
  templateMode: v.boolean(),
  isPublic: v.boolean(),
  tags: v.array(v.string()),
  templateFields: v.array(/* existing validator */),
  category: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.optional(v.number())
})
  .index('by_userId', ['userId'])
  .index('by_userId_createdAt', ['userId', 'createdAt'])
  .index('by_isPublic', ['isPublic'])
```

No migration is required because adding an index does not alter existing prompt documents. No analytics backfill is required because every metric is derived from current prompt records.

### Query Read Strategy

* Use `by_userId` to obtain the Viewer's current prompt inventory for all-time counts and distributions.
* Use `by_userId_createdAt` with a lower-bound index range for the recent 30-day creation set when implementing separate all-time and recent reads.
* Do not scan prompts belonging to other users.
* Do not call the existing `prompts.list` query from the analytics query.
* Do not send prompt records to the client for frontend aggregation.
* Keep aggregation logic local to the dedicated Convex query.

The live aggregation design is intentionally simpler than materialized counters and guarantees that prompt creation, visibility changes, template-mode changes, category edits, and deletions are reflected without counter repair logic.

---

## 4. Constraints

* The route must remain `/dashboard`.
* Analytics must describe only prompts owned by the authenticated Viewer.
* Client-facing backend access must use the project's authed Convex setup under `convex/authed/`.
* Backend code must follow the existing Effect v4 wrapper conventions.
* Every Convex function must define argument validators. This query uses `args: {}`.
* The implementation must follow `convex/_generated/ai/guidelines.md`.
* The implementation must use the current App Router patterns documented in the installed Next.js version.
* The page may remain a Client Component because Convex `useQuery` supplies reactive data.
* Server state must not be copied into Zustand or another client store.
* Existing shadcn chart and Recharts dependencies must be reused. No package installation is required.
* Charts must be responsive and readable on mobile and desktop dashboard widths.
* Charts must not depend on color alone to communicate a series.
* The browser payload must contain aggregates only, not prompt bodies or other unnecessary prompt data.
* The initial implementation should favor correctness and immediate consistency over materialized counters.
* Automated tests are explicitly outside the current scope. The user will verify behavior manually.
* Do not add date-range controls, category filters, export controls, comparison percentages, tag analytics, or usage analytics.
* Do not run `pnpm run dev` or `pnpm run build` as part of implementation verification.

---

## 5. Edge Cases and Error Handling

* **The Viewer owns no prompts**
  * Return a successful payload with all summary counts equal to zero.
  * Return 30 zero-count creation buckets and zero-count distribution values from the backend contract.
  * Show the zero-valued cards and one create-first-prompt empty state on the frontend.
  * Do not render charts for this state.

* **The query is still loading**
  * Render the analytics-shaped dashboard skeleton.
  * Do not temporarily render zero values or the empty-state CTA.

* **The query fails or authentication cannot resolve a Viewer**
  * Allow the error to reach the dashboard route error boundary.
  * Present the existing retry action rather than interpreting the failure as an empty library.

* **A prompt is exactly on the UTC start boundary**
  * Include it in `createdLast30Days` and in the first creation-trend bucket.

* **A prompt predates the 30-day UTC window**
  * Include it in all-time cards and distribution charts.
  * Exclude it from `createdLast30Days` and creation-trend buckets.

* **A day has no prompt creation**
  * Return that date with `count: 0` so all 30 days remain visible.

* **A prompt has no category, an empty category, or a whitespace-only category**
  * Group it under **Uncategorized**.

* **Categories differ only by case or surrounding whitespace**
  * Group them using the agreed normalization and display-casing rules.

* **More than six named category groups exist**
  * Preserve **Uncategorized** if present.
  * Show no more than six named category groups total.
  * Sum every unselected categorized group into **Other**.

* **Exactly six or fewer named category groups exist**
  * Render all groups and omit **Other**.

* **Category groups have equal counts**
  * Sort tied groups by normalized display label ascending for stable output.

* **All prompts are public, private, template, or static**
  * Keep both entries in the corresponding distribution payload, including the zero-valued counterpart.
  * Render labels and exact counts so a single-segment donut remains understandable.

* **A prompt is edited while the dashboard is open**
  * Update visibility, type, and category analytics reactively when relevant fields change.
  * Do not change creation counts when only `updatedAt` changes.

* **A prompt is deleted while the dashboard is open**
  * Remove it from every applicable aggregate through the reactive query.
  * Transition to the true empty state when the deleted prompt was the Viewer's final prompt.

* **Long category labels**
  * Keep the full value available through the chart tooltip.
  * Truncate or constrain visible axis labels without breaking the card layout.

* **Small screen width**
  * Stack summary cards and chart cards as needed.
  * Prevent chart content from overflowing the dashboard viewport.

---

## 6. Acceptance Criteria

This feature is considered complete if:

* `/dashboard` no longer displays the starter **User Information** or **Making changes** sections.
* The personalized dashboard heading remains visible.
* The dashboard loads from one dedicated authed Convex analytics query.
* The query cannot return analytics for another user's prompts.
* The browser receives compact aggregate data without prompt titles or content.
* The schema includes `by_userId_createdAt` on the existing `prompts` table.
* No analytics, event, or counter table is introduced.
* The four agreed summary cards display correct values.
* The creation trend contains exactly 30 ordered UTC date buckets, including zero-count days.
* The visibility donut correctly represents public and private prompts.
* The prompt-type donut correctly represents template and static prompts.
* The category chart follows the trimming, case-insensitive grouping, casing, ranking, `Uncategorized`, and `Other` rules.
* A Viewer with no prompts sees four zero-valued cards and a `/prompt/create` CTA instead of charts.
* Loading does not flash a false empty state or false zero values.
* The dashboard-specific skeleton approximates the final analytics layout.
* Query failures remain distinguishable from a successful empty result and expose a retry action.
* Analytics update reactively after relevant prompt creation, update, or deletion operations.
* The dashboard is readable in light mode, dark mode, mobile width, and desktop width.
* Charts include labels, legends, or accessible supporting text and do not rely exclusively on color.
* `pnpm run convex:gen` completes successfully after the Convex changes.
* `pnpm run lint` completes without errors caused by this feature.
* `pnpm run typecheck` completes without errors caused by this feature.
* No automated test files are required or added for this feature.

### Implementation Sequence

1. Add the `by_userId_createdAt` index to `convex/schema.ts`.
2. Add `convex/authed/promptAnalytics.ts` with the authenticated compact aggregation query.
3. Run `pnpm run convex:gen` so the generated API exposes the new query.
4. Replace the dashboard starter content with summary, chart, and empty-state presentation.
5. Update `components/skeletons/DashboardSkeleton.tsx` to mirror the analytics layout.
6. Manually inspect populated, loading, empty, light-theme, dark-theme, mobile, and desktop states.
7. Run `pnpm run lint` and `pnpm run typecheck`.

### Files Expected to Change During Implementation

* `convex/schema.ts`: add the compound prompt owner/creation-time index.
* `convex/authed/promptAnalytics.ts`: define the inventory analytics query and aggregation logic.
* `convex/_generated/api.d.ts`: regenerate the Convex API types.
* `app/(authed)/dashboard/page.tsx`: replace starter content with the analytics dashboard.
* `components/skeletons/DashboardSkeleton.tsx`: align loading UI with the analytics layout.

`app/(authed)/dashboard/error.tsx` should remain unchanged unless implementation reveals that its existing retry behavior no longer works with the analytics page.

---

## 8. Relevant MCPs, Skills, and Tools

### Project Guidance and Documentation

* **Convex AI guidelines**: `convex/_generated/ai/guidelines.md` defines current function registration, validators, indexes, authentication boundaries, and query practices.
* **Installed Next.js documentation**: `node_modules/next/dist/docs/` is the source of truth for this project's Next.js version, including Client Components, loading UI, and route error handling.
* **Existing project conventions**: `AGENTS.md`, `docs/CONTEXT.md`, and `.agents/specs/` define repository-specific backend, frontend, package-manager, and specification patterns.

### Core Skills and Implementation Tools

* **create-spec**: used to research and produce this feature specification at the required detail level.
* **domain-modeling**: used to define Prompt Inventory Analytics and UTC Daily Bucket in the project glossary.
* **grilling**: used to resolve scope, chart composition, empty-state behavior, aggregation strategy, timezone, category rules, loading behavior, and verification expectations before writing the spec.
* **shadcn chart primitives**: use `components/ui/chart.tsx` with the existing Recharts dependency for theme-aware visualizations.
* **Convex code generation**: run `pnpm run convex:gen` after schema and function changes.
* **ESLint and TypeScript**: run `pnpm run lint` and `pnpm run typecheck` as the required implementation checks.
