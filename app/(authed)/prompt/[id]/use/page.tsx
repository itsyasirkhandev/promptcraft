'use client';

import * as React from 'react';
import { usePromptInterpolation } from '@/hooks/use-prompt-interpolation';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import type { TemplateField } from '@/lib/schemas/prompt.schema';
import { Button } from '@/components/ui/button';
import { PromptNotFound } from '@/components/prompts/PromptNotFound';
import { PromptUseSkeleton } from '@/components/prompts/use/PromptUseSkeleton';
import { LivePreviewCard } from '@/components/prompts/use/LivePreviewCard';
import { TemplateFieldsCard } from '@/components/prompts/use/TemplateFieldsCard';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UsePromptPage({ params }: PageProps) {
  const { id } = React.use(params);

  const prompt = useQuery(api.authed.prompts.get, { id: id as Id<'prompts'> });
  const templateFields = (prompt?.templateFields ?? []) as TemplateField[];

  const { setValue, formValues, flatValues, interpolated } = usePromptInterpolation(prompt);

  if (prompt === undefined) {
    return (
      <PromptUseSkeleton />
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
