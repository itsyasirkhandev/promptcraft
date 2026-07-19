'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DynamicFields } from '@/components/prompts/use/DynamicFields';
import type { TemplateField } from '@/lib/schemas/prompt.schema';

interface TemplateFieldsCardProps {
  templateFields: TemplateField[];
  formValues: Record<string, string | string[] | number | undefined>;
  setValue: (name: string, value: string | string[] | number | undefined) => void;
  description?: string;
}

export function TemplateFieldsCard({
  templateFields,
  formValues,
  setValue,
  description,
}: TemplateFieldsCardProps) {
  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Template Fields</CardTitle>
        <CardDescription>
          {description ?? 'Fill in the variables defined in your prompt.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <DynamicFields
          templateFields={templateFields}
          formValues={formValues}
          setValue={setValue}
          variant="use"
        />
      </CardContent>
    </Card>
  );
}
