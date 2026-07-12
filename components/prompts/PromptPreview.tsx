'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { tokenizeTemplate } from '@/lib/variables';
import type { TemplateField, TemplateFieldType } from '@/lib/schemas/prompt.schema';

interface PromptPreviewProps {
  content: string;
  fields: TemplateField[];
}

const TYPE_COLORS: Record<TemplateFieldType, string> = {
  text: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  longText: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  number: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  singleSelect: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
  multiSelect: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
};

export const PromptPreview = ({ content, fields }: PromptPreviewProps) => {
  const tokens = tokenizeTemplate(content, fields);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.kind === 'variable') {
          const type = token.field?.type ?? 'text';
          const colorClass = TYPE_COLORS[type];

          return (
            <span
              key={i}
              className={cn(
                'rounded px-1.5 py-0.5 mx-0.5 font-mono text-[0.9em] font-medium transition-all select-all inline-block align-middle',
                colorClass
              )}
            >
              {`{{${token.name}}}`}
            </span>
          );
        }
        return <span key={i} className="whitespace-pre-wrap">{token.content}</span>;
      })}
    </>
  );
};
