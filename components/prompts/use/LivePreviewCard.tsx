'use client';

import { Check, Copy } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OpenInAIButton } from '@/components/prompts/OpenInAIButton';
import { PromptPreview } from '@/components/prompts/PromptPreview';
import { useClipboardCopy } from '@/lib/hooks/use-clipboard-copy';
import type { TemplateField } from '@/lib/schemas/prompt.schema';

interface LivePreviewCardProps {
  content: string;
  templateFields: TemplateField[];
  flatValues: Record<string, string>;
  interpolated: string;
}

export function LivePreviewCard({
  content,
  templateFields,
  flatValues,
  interpolated,
}: LivePreviewCardProps) {
  const { copied, copy } = useClipboardCopy();

  return (
    <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-850">
        <div>
          <CardTitle className="text-lg">Live Preview</CardTitle>
          <CardDescription>Visual rendering with filled fields highlighted.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <OpenInAIButton content={interpolated} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              copy(interpolated, {
                successMessage: 'Copied final prompt to clipboard!',
                errorMessage: 'Failed to copy text.',
              })
            }
            className="gap-2 rounded-xl h-8 border-slate-200 dark:border-slate-800 shadow-sm"
          >
            {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[450px]">
          <div className="p-6 font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-350">
            <PromptPreview content={content} fields={templateFields} values={flatValues} />
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
