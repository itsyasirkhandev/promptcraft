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

| Technology | Purpose | Description |
| :--- | :--- | :--- |
| **Next.js** | Frontend Framework | React-based framework for page routing and server-side rendering. |
| **Convex** | Backend Database & Server | Real-time cloud database and serverless functions backend. |
| **Clerk Auth** | Client Authentication | Manages user sign-in flows and sessions. |
| **Effect-TS** | Functional Programming | Used for robust error handling, config parsing, and standard services. |
| **Zustand** | Client State Management | Minimalist, client-side React state management. |
| **TailwindCSS** | Component Styling | Utility-first CSS framework for modern responsive styles. |
| **shadcn/ui** | Component Primitives | Accessible, customizable UI components built on Radix and Base UI. |
| **react-hook-form** | Forms | Performant form handling with schema-driven validation. |
| **Zod** | Validation | Schema validation for forms and Convex function inputs. |
| **Recharts** | Analytics Charts | Composable charting library for the dashboard analytics views. |

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
