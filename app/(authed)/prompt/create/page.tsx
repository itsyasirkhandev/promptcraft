'use client';

import { type PromptFormValues } from '@/lib/schemas/prompt.schema';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { usePromptSubmit, toPromptMutationArgs } from '@/hooks/use-prompt-submit';
import { PromptFormCard } from '../_components/PromptForm';
import { usePromptForm } from '@/hooks/use-prompt-form';

export default function CreatePromptPage() {
  const form = usePromptForm();

  const createPrompt = useMutation(api.authed.prompts.create);
  const submit = usePromptSubmit({
    success: { message: 'Prompt created!', description: 'Your prompt has been saved.' },
    error: 'Failed to create prompt',
  });

  async function onSubmit(data: PromptFormValues) {
    await submit(() => createPrompt(toPromptMutationArgs(data)));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PromptFormCard
        form={form}
        title="Create Prompt"
        description="Build and save a new prompt to your library."
        onSubmit={onSubmit}
        submitLabel="Create Prompt"
        resetLabel="Clear"
        autoSetCategory
      />
    </div>
  );
}
