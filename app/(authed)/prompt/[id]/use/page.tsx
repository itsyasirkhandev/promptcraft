'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { interpolateVariables, flattenFormValues } from '@/lib/variables';
import type { TemplateField } from '@/lib/schemas/prompt.schema';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PromptNotFound } from '@/components/prompts/PromptNotFound';
import { LivePreviewCard } from '@/components/prompts/use/LivePreviewCard';
import { TemplateFieldsCard } from '@/components/prompts/use/TemplateFieldsCard';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UsePromptPage({ params }: PageProps) {
  const { id } = React.use(params);

  const prompt = useQuery(api.authed.prompts.get, { id: id as Id<'prompts'> });
  const templateFields = (prompt?.templateFields ?? []) as TemplateField[];

  const { control, setValue } = useForm<Record<string, string | string[] | number | undefined>>({
    defaultValues: {},
  });
  const formValues = useWatch({ control });

  const flatValues = React.useMemo(() => flattenFormValues(formValues), [formValues]);

  const interpolated = React.useMemo(() => {
    if (!prompt) return '';
    return interpolateVariables(prompt.content, flatValues);
  }, [prompt, flatValues]);

  if (prompt === undefined) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto p-1 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div>
            <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-1"></div>
            <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/50 rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <Card className="h-96 p-6">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
              <div className="space-y-4">
                <div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
                <div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
              </div>
            </Card>
          </div>
          <div className="lg:col-span-7">
            <Card className="h-96 p-6">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
              <div className="h-48 w-full bg-slate-150 dark:bg-slate-850 rounded"></div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (prompt === null) {
    return <PromptNotFound message="The prompt you are trying to access does not exist." />;
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-1 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="rounded-xl size-9">
            <Link href="/dashboard/prompts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Use Prompt: {prompt.title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Fill in the fields below to populate your dynamic template in real-time.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <TemplateFieldsCard
            templateFields={templateFields}
            formValues={formValues}
            setValue={setValue}
          />
        </div>

        {/* Right Column: Live Preview & Result */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <LivePreviewCard
            content={prompt.content}
            templateFields={templateFields}
            flatValues={flatValues}
            interpolated={interpolated}
          />
        </div>
      </div>
    </div>
  );
}
