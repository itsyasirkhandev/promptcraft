# Prompt Library

A prompt management app for creating, editing, and using AI prompts. Built on Next.js, Convex, Clerk Auth, Effect-TS, and Zustand.

## Features

- **Create & edit prompts** with title, content, tags, and visibility controls.
- **Template mode** with typed fillable fields (`text`, `longText`, `number`, `singleSelect`, `multiSelect`) substituted at use-time.
- **Public prompts** organized by category (coding, writing, marketing, analysis, design, education, other).
- **User plans** with `hobby` and `pro` tiers.
- **Auth-gated dashboard** with real-time prompt sync powered by Convex.
- **Prompt analytics** for tracking usage.
- **Open in AI** shortcut to run a filled prompt directly in an AI tool.

## Tech Stack

| Category | Technology Name | NPM Package | Version | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Framework** | Next.js | `next` | `16.2.10` | App Router full-stack web framework |
| **UI Library** | React | `react` / `react-dom` | `19.2.7` | UI rendering engine |
| **Backend & Database** | Convex | `convex` | `1.42.1` | Real-time database & backend platform |
| **Backend Helpers** | Convex Helpers | `convex-helpers` | `0.1.120` | Server & client utility functions |
| **Functional Backend** | Effect-TS | `effect` | `4.0.0-beta.78` | Typed functional programming for backend logic |
| **Authentication** | Clerk | `@clerk/nextjs` | `7.5.14` | User authentication & session management |
| **CSS Engine** | Tailwind CSS | `tailwindcss` | `4.3.2` | Utility-first styling framework |
| **UI Primitives** | Radix UI | `radix-ui` | `1.6.2` | Headless accessible components |
| **Component System** | shadcn/ui | `shadcn` | `4.13.0` | UI component builder & CLI |
| **Theme Management** | Next Themes | `next-themes` | `0.4.6` | Dark mode and theme toggling |
| **Global State** | Zustand | `zustand` | `5.0.14` | Client-side state store |
| **Form Handling** | React Hook Form | `react-hook-form` | `7.81.0` | Performant form state management |
| **Schema Validation** | Zod | `zod` | `3.25.76` | Type-safe runtime schema checking |
| **URL State** | Nuqs | `nuqs` | `2.9.0` | URL query parameter state manager |
| **Immutability** | Immer | `immer` | `11.1.11` | Immutable state mutations |
| **Payments & Billing** | Polar | `@polar-sh/sdk` | `0.48.1` | Billing & subscription management |
| **Webhooks** | Svix | `svix` | `1.96.1` | Webhook verification service |
| **Data Visualization** | Recharts | `recharts` | `3.8.0` | React charting library |
| **Notifications** | Sonner | `sonner` | `2.0.7` | Toast notification engine |
| **Icons** | Phosphor Icons | `@phosphor-icons/react` | `2.1.10` | React icon components |
| **Icons** | Iconify | `@iconify/react` | `6.0.2` | Flexible multi-pack icon loader |
| **Unit Testing** | Vitest | `vitest` | `4.1.10` | Fast unit test runner |
| **Backend Testing** | Convex Test | `convex-test` | `0.0.54` | Convex backend integration testing |
| **Code Health** | Fallow | `fallow` | `3.2.0` | Static analysis & unused code audit |
| **React Auditing** | React Doctor | `react-doctor` | `0.8.1` | React performance & lint diagnostics |
| **Package Manager** | pnpm | — | Workspace | Monorepo/Workspace package manager |

## Getting Started

Follow these steps to set up the project:

1. Run the command:
   ```bash
   pnpm dev
   ```
2. Set up Convex when prompted. Authenticate and connect an existing project or create a new project from scratch.
3. Visit the [Clerk Dashboard](https://dashboard.clerk.com/), set up a new project.
4. Copy the Clerk environment variables into the `.env.local` file (this file is created automatically in the project root during Step 2). Refer to `.env.example` for the correct variable names.
5. You are all set up with Convex, Next.js, and Clerk Auth!
