import { useCallback, useState } from 'react';
import { toast } from 'sonner';

interface CopyOptions {
  successMessage?: string;
  errorMessage?: string;
}

/**
 * Clipboard copy + "Copied" state + toast, in one place.
 *
 * `copied` resets to false after 2s. Each component using the hook gets its
 * own independent state — safe to use multiple times in one page.
 */
export function useClipboardCopy() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string, options?: CopyOptions) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success(options?.successMessage ?? 'Copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error(options?.errorMessage ?? 'Failed to copy.');
      }
    },
    [],
  );

  return { copied, copy };
}
