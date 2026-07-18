'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';
import { type PromptFormValues } from '@/lib/schemas/prompt.schema';
import { useQuery, useMutation } from 'convex/react';
import { useWatch } from 'react-hook-form';
import { api } from '@/convex/_generated/api';
import { catchTag } from '@/lib/errors';
import { Id } from '@/convex/_generated/dataModel';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PromptForm } from '../../_components/PromptForm';
import { PromptNotFound } from '@/components/prompts/PromptNotFound';
import { usePromptForm } from '@/hooks/use-prompt-form';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditPromptPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = React.use(params);

  const prompt = useQuery(api.authed.prompts.get, { id: id as Id<'prompts'> });
  const updatePrompt = useMutation(api.authed.prompts.update);

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } =
    usePromptForm();

  const isResettingRef = React.useRef(true);
  const prevIsPublicRef = React.useRef(false);
  const watchedIsPublic = useWatch({ control, name: 'isPublic', defaultValue: false });

  // Populate form when prompt loads
  React.useEffect(() => {
    if (prompt) {
      isResettingRef.current = true;
      reset({
        title: prompt.title,
        content: prompt.content,
        templateMode: prompt.templateMode,
        isPublic: prompt.isPublic,
        category: prompt.category ?? (prompt.isPublic ? 'other' : undefined),
        tags: prompt.tags ?? [],
        templateFields: prompt.templateFields ?? [],
      });
      prevIsPublicRef.current = prompt.isPublic;
    }
  }, [prompt, reset]);

  // Sync category when isPublic changes (skip the reset-triggered change)
  React.useEffect(() => {
    if (isResettingRef.current) {
      isResettingRef.current = false;
      return;
    }
    if (prevIsPublicRef.current !== watchedIsPublic) {
      setValue('category', watchedIsPublic ? 'other' : undefined);
      prevIsPublicRef.current = watchedIsPublic;
    }
  }, [watchedIsPublic, setValue]);

  async function onSubmit(data: PromptFormValues) {
    try {
      await updatePrompt({
        id: id as Id<'prompts'>,
        title: data.title,
        content: data.content,
        templateMode: data.templateMode,
        isPublic: data.isPublic,
        category: data.category || undefined,
        tags: data.tags,
        templateFields: data.templateFields,
      });
      toast.success('Prompt updated!', { description: 'Your changes have been saved.' });
      router.push('/dashboard/prompts');
    } catch (error) {
      toast.error('Failed to update prompt', {
        description: catchTag(error, 'PlanLimitError', (d: { message: string }) => d.message) ?? (error instanceof Error ? error.message : 'An unknown error occurred.'),
      });
    }
  }

  if (prompt === undefined) {
    return (
      <div className="max-w-2xl mx-auto animate-pulse">
        <div className="flex items-center gap-3 mb-6">
          <div className="size-9 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
        </div>
        <Card className="p-6">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-4"></div>
          <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/50 rounded mb-8"></div>
          <div className="space-y-4">
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
            <div className="h-24 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
            <div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (prompt === null) {
    return <PromptNotFound message="The prompt you are trying to edit does not exist." />;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button asChild variant="outline" size="icon" className="rounded-xl size-9">
          <Link href="/dashboard/prompts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Edit Prompt</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground">Modify Prompt Details</CardTitle>
          <CardDescription>Update the details and fields of your saved prompt.</CardDescription>
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
            submitLabel="Save Changes"
            resetLabel="Reset"
            autoSetCategory={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
