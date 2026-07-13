'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { promptSchema, type PromptFormValues } from '@/lib/schemas/prompt.schema';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { PromptForm } from '../_components/PromptForm';

export default function CreatePromptPage() {
  const router = useRouter();
  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } =
    useForm<PromptFormValues>({
      resolver: zodResolver(promptSchema),
      defaultValues: { title: '', content: '', templateMode: false, isPublic: false, category: undefined, tags: [], templateFields: [] },
    });

  const createPrompt = useMutation(api.authed.prompts.create);

  async function onSubmit(data: PromptFormValues) {
    try {
      await createPrompt({
        title: data.title,
        content: data.content,
        templateMode: data.templateMode,
        isPublic: data.isPublic,
        category: data.category || undefined,
        tags: data.tags,
        templateFields: data.templateFields,
      });
      toast.success('Prompt created!', { description: 'Your prompt has been saved.' });
      router.push('/dashboard/prompts');
    } catch (error) {
      toast.error('Failed to create prompt', {
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground">Create Prompt</CardTitle>
          <CardDescription>Build and save a new prompt to your library.</CardDescription>
        </CardHeader>
        <CardContent>
          <PromptForm
            control={control}
            register={register}
            errors={errors}
            setValue={setValue}
            handleSubmit={handleSubmit}
            reset={reset}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
            submitLabel="Create Prompt"
            resetLabel="Clear"
            autoSetCategory
          />
        </CardContent>
      </Card>
    </div>
  );
}
