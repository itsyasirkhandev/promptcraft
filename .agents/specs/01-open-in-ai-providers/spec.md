# Open in AI Providers Specification

## 1. Problem Statement

When users generate or fill out a prompt template, they often want to run it immediately in their AI assistant of choice. Currently, they can only copy the prompt text to the clipboard and then must manually open the AI tool (like ChatGPT or Claude), open a new chat, and paste the text.

This introduces unnecessary friction. 

**Solution:** This feature introduces a split-action `OpenInAIButton` component that copies the prompt to the clipboard and opens the prompt in the user's selected AI provider directly in one click.

---

## 2. Functional Requirements

The system should:

* Provide a split button component (`OpenInAIButton`) comprising:
  * A primary button that copies the current prompt content to the clipboard and opens it in the default provider (ChatGPT).
  * A dropdown menu trigger (chevron button) that lists alternative AI providers.
* Support the following AI providers and URL mappings:
  * **ChatGPT:** `https://chatgpt.com/?q=${content}&hints=search`
  * **Claude:** `https://claude.ai/new?q=${content}`
  * **Cursor:** `https://cursor.com/link/prompt?text=${content}`
  * **Zed:** `zed://agent?prompt=${content}`
  * **T3 Chat:** `https://t3.chat/new?q=${content}`
  * **Grok:** `https://x.com/i/grok?text=${content}`
  * **Perplexity:** `https://www.perplexity.ai/?q=${content}`
  * **v0:** `https://v0.app/chat?q=${content}`
* Copy the prompt text to the clipboard using `navigator.clipboard.writeText` before opening the AI provider's link.
* Display a success toast notification when the prompt is successfully copied.
* Render high-fidelity, native brand logos for each AI provider using `@iconify/react`.
* Integrate the `OpenInAIButton` component on the "Use Prompt" page ([app/(authed)/prompt/[id]/use/page.tsx](file:///i:/YT%20projects/app/%28authed%29/prompt/%5Bid%5D/use/page.tsx)), next to the existing "Copy" button in the Live Preview header.

---

## 3. Inputs and Outputs: AI Provider Redirection Flow

**USER ACTION (INPUT)**
* User clicks the primary "Open" button (default ChatGPT) OR
* User opens the dropdown menu and clicks on a specific provider (e.g., Claude).

**EXPECTED SYSTEM BEHAVIOR**
1. Copy the generated prompt text to the user's clipboard.
2. Show a success toast notification: `"Prompt copied to clipboard!"`.
3. URL-encode the prompt text.
4. Construct the target URL using the provider's specific query parameter mapping.
5. Open the target URL in a new tab/window via `window.open(url, '_blank', 'noopener,noreferrer')`.

---

## 4. Constraints

* **Icon Library:** Must install and use `@iconify/react` to fetch specific AI brand icons (e.g., Anthropic, OpenAI, Cursor, Zed, Grok, Perplexity, v0) that are not available in the default `@phosphor-icons/react` package.
* **Styling & Theme:** The design must be fully responsive, support both light and dark modes, and match the current visual style of the application (using Tailwind CSS).
* **Package Management:** Must use `pnpm` to install new dependencies (`pnpm add @iconify/react`).
* **Existing Functionality:** Do not modify the existing copy-to-clipboard button or other controls; the new component should sit cleanly alongside the existing Copy button.

---

## 5. Edge Cases and Error Handling

* **Empty Prompt Content:**
  * If the prompt content is empty or undefined, show an error toast: `"No prompt content to copy."` and do not open any links.
* **Clipboard API Blocked/Fails:**
  * If the clipboard write fails (e.g., due to browser permission constraints), log the error to the console, show a warning toast: `"Failed to copy prompt to clipboard."`, but proceed to open the AI provider link anyway.
* **Special Characters in Prompt:**
  * Ensure the prompt text is properly URL-encoded using `encodeURIComponent` to prevent broken URLs or query strings.
* **Protocol Handlers (Zed):**
  * Zed uses a custom URI scheme (`zed://`). This will prompt the operating system to open the local Zed app. Ensure it opens correctly without creating a blank browser tab that hangs.

---

## 6. Acceptance Criteria

The feature is considered complete if:

* The `@iconify/react` package is successfully added to `package.json`.
* The `OpenInAIButton` component is created at `components/prompts/OpenInAIButton.tsx`.
* The component renders a split button layout (Primary Button + Dropdown Trigger) matching the app's existing UI aesthetics.
* Clicking the primary button:
  * Copies the prompt text.
  * Shows a toast notification.
  * Opens ChatGPT in a new tab with the prompt pre-filled in the query parameter.
* Clicking any dropdown provider option:
  * Copies the prompt text.
  * Shows a toast notification.
  * Opens the corresponding provider link in a new tab with the prompt pre-filled.
* The button is integrated on the "Use Prompt" page next to the Copy button.
* The project builds and checks successfully (`pnpm run lint` and `pnpm run typecheck`).

---

## 8. Relevant MCPs, Skills, and Tools

* **design-taste-frontend:** Applied to construct the split-button layout, custom borders, transitions, and dropdown styling that aligns with the visual language of the project.
* **vercel-react-best-practices:** Leveraged to ensure the open handlers, states, and dropdown items render efficiently without introducing layout shifts or unnecessary rendering overhead.
