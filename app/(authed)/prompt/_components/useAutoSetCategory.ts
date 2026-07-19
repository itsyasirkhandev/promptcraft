import { useEffect } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import type { PromptFormValues } from '@/lib/schemas/prompt.schema';

/**
 * When `enabled` (create mode), auto-set `category` to 'other' on public,
 * clear it on private. In edit mode the guard-ref approach is used instead,
 * so this hook is a no-op there.
 */
export function useAutoSetCategory(
  watchedIsPublic: boolean,
  setValue: UseFormSetValue<PromptFormValues>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    setValue('category', watchedIsPublic ? 'other' : undefined);
  }, [watchedIsPublic, setValue, enabled]);
}
