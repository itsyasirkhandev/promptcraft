'use client';

import * as React from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import type { FunctionReturnType } from 'convex/server';
import { api } from '@/convex/_generated/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ArrowSquareOut,
  ChartBar,
  Check,
  Clock,
  Code,
  Copy,
  Globe,
  GraduationCap,
  Lightning,
  Megaphone,
  Notebook,
  Palette,
  PencilSimple,
  Tag,
  User,
} from '@phosphor-icons/react';

/**
 * The bounded, author-joined, field-stripped projection returned by
 * `api.public.prompts.listPublicPrompts`. Derived from the query's inferred
 * return type so it can never drift from the backend shape. The card renders
 * only these fields — no `userId`, no author email, no `templateFields`.
 */
export type PublicPromptDTO = NonNullable<
  FunctionReturnType<typeof api.public.prompts.listPublicPrompts>
>[number];

const CATEGORY_ICON_MAP: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  coding: Code,
  writing: PencilSimple,
  marketing: Megaphone,
  analysis: ChartBar,
  design: Palette,
  education: GraduationCap,
  other: Globe,
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface MarketplacePromptCardProps {
  prompt: PublicPromptDTO;
}

export function MarketplacePromptCard({ prompt }: MarketplacePromptCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      toast.success('Prompt copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy prompt');
    }
  };

  const handleUse = () => {
    if (prompt.publicSlug) {
      window.open(`/p/${prompt.publicSlug}`, '_blank');
    }
  };

  const CategoryIcon = prompt.category
    ? (CATEGORY_ICON_MAP[prompt.category] ?? Globe)
    : Globe;

  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="gap-0 p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex-shrink-0 rounded-lg bg-slate-50 p-1.5 text-slate-500 ring-1 ring-slate-100/80 dark:bg-white/5 dark:text-slate-400 dark:ring-white/5">
              <CategoryIcon className="size-3.5 animate-in fade-in duration-200" />
            </span>
            <CardTitle className="line-clamp-2 text-base font-semibold leading-tight text-slate-900 transition-colors group-hover:text-primary dark:text-slate-100">
              {prompt.title}
            </CardTitle>
          </div>
          <div className="flex shrink-0 select-none">
            {prompt.templateMode ? (
              <span className="inline-flex items-center gap-1 rounded-lg border border-purple-100/50 bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600 dark:border-purple-900/30 dark:bg-purple-950/20 dark:text-purple-400">
                <Lightning className="size-3" />
                <span>Template</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-lg border border-blue-100/50 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:border-blue-900/30 dark:bg-blue-950/20 dark:text-blue-400">
                <Notebook className="size-3" />
                <span>Static</span>
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-0">
        {/* Author + date */}
        <div className="flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            {prompt.author.avatarUrl ? (
              <Image
                src={prompt.author.avatarUrl}
                alt={prompt.author.name}
                width={20}
                height={20}
                className="size-5 rounded-full border border-slate-200 object-cover dark:border-slate-800"
              />
            ) : (
              <span className="flex size-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <User className="size-3 text-slate-500 dark:text-slate-400" />
              </span>
            )}
            <span className="max-w-[120px] truncate font-medium text-slate-700 dark:text-slate-300">
              {prompt.author.name || 'Anonymous'}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Clock className="size-3 opacity-75" />
              <span>{formatDate(prompt._creationTime)}</span>
            </span>
          </div>
        </div>

        {/* Content preview */}
        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {prompt.content}
        </p>

        {/* Tags */}
        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {prompt.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-md border border-slate-150/40 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-white/5 dark:bg-white/5 dark:text-slate-400"
              >
                <Tag className="size-2.5 opacity-60" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2 border-t border-border/40 pt-3 dark:border-white/5 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={cn(
              'h-9 flex-1 gap-1.5 rounded-xl text-xs shadow-sm transition-transform active:scale-[0.98]',
              copied && 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
            )}
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" />
            ) : (
              <Copy className="size-3.5" />
            )}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>
          {prompt.templateMode && prompt.publicSlug && (
            <Button
              type="button"
              size="sm"
              onClick={handleUse}
              className="h-9 flex-1 gap-1.5 rounded-xl bg-purple-600 text-xs text-white shadow-sm transition-transform hover:bg-purple-700 active:scale-[0.98] dark:bg-purple-600 dark:hover:bg-purple-500"
            >
              <ArrowSquareOut className="size-3.5" />
              <span>Use</span>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}