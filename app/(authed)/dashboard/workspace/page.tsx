'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { useRouter, useSearchParams, redirect } from 'next/navigation';
import { usePromptInterpolation } from '@/hooks/use-prompt-interpolation';
import { useClipboardCopy } from '@/lib/hooks/use-clipboard-copy';
import Link from 'next/link';
import {
  PlusCircle,
  Copy,
  Check,
  ArrowsLeftRight,
  Lightning,
  Article,
  Info,
  Tag,
  CalendarBlank,
  Globe,
  Lock,
} from '@phosphor-icons/react';
import { api } from '@/convex/_generated/api';
import { Doc } from '@/convex/_generated/dataModel';
import type { TemplateField } from '@/lib/schemas/prompt.schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PromptPreview } from '@/components/prompts/PromptPreview';
import { OpenInAIButton } from '@/components/prompts/OpenInAIButton';
import { PromptSwitcher } from '@/components/prompts/use/PromptSwitcher';
import { DynamicFields } from '@/components/prompts/use/DynamicFields';
import { cn } from '@/lib/utils';

// Hoisted at module scope: explicit locale + timezone so SSR and CSR
// render the same text, and we don't rebuild the formatter on each call.
const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

// ─── Loading skeleton ────────────────────────────────────────────────────────

function WorkspaceSkeleton() {
  return (
    <div className="flex h-full flex-col gap-0 animate-pulse">
      <div className="flex h-14 shrink-0 items-center justify-center gap-3 border-b px-4">
        <Skeleton className="h-9 w-[300px] rounded-xl" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="hidden lg:flex flex-col border-r w-[360px] shrink-0">
          <div className="space-y-4 p-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <div className="flex-1 p-6">
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyWorkspace() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-5 flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner ring-1 ring-primary/10">
        <ArrowsLeftRight className="size-9 text-primary" weight="duotone" />
      </div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight">No prompts yet</h1>
      <p className="mb-7 max-w-sm text-sm text-muted-foreground leading-relaxed">
        The Workspace is your home for using prompts. Create your first prompt to start
        generating, filling, and copying in one place.
      </p>
      <Button asChild size="lg" className="gap-2 rounded-xl shadow-sm">
        <Link href="/prompt/create">
          <PlusCircle className="size-4" weight="fill" />
          Create your first prompt
        </Link>
      </Button>
    </div>
  );
}

// ─── Static prompt info panel ─────────────────────────────────────────────────

function StaticPromptInfo({
  prompt,
}: {
  prompt: {
    title: string;
    tags: string[];
    isPublic: boolean;
    category?: string;
    createdAt: number;
  };
}) {
  // Use the module-scope formatter (explicit locale + timezone) to avoid
  // rebuilding the formatter each call and to keep SSR/CSR output stable.
  const formattedDate = dateFormatter.format(new Date(prompt.createdAt));

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex items-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-sm text-blue-700 dark:text-blue-300">
        <Info className="size-4 shrink-0" weight="fill" />
        <span>This is a <strong>static prompt</strong> — no variables to fill in. Copy or open it directly in an AI.</span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Tag className="size-3.5" />
          Tags
        </div>
        {prompt.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {prompt.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No tags</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-xl border p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {prompt.isPublic ? (
              <Globe className="size-3" />
            ) : (
              <Lock className="size-3" />
            )}
            Visibility
          </div>
          <span className="text-sm font-medium">
            {prompt.isPublic ? 'Public' : 'Private'}
          </span>
        </div>

        <div className="flex flex-col gap-1 rounded-xl border p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarBlank className="size-3" />
            Created
          </div>
          <span className="text-sm font-medium">{formattedDate}</span>
        </div>
      </div>
    </div>
  );
}



// ─── Preview Panel ────────────────────────────────────────────────────────────

interface PreviewPanelProps {
  prompt: { content: string; templateFields: TemplateField[]; templateMode: boolean };
  interpolated: string;
  flatValues: Record<string, string>;
  compact?: boolean;
}

function PreviewPanel({ prompt, interpolated, flatValues, compact }: PreviewPanelProps) {
  const { copied, copy } = useClipboardCopy();

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b px-4 py-3 bg-background/50 backdrop-blur-sm',
          compact && 'sticky top-0 z-10'
        )}
      >
        <div>
          <h2 className="text-sm font-semibold">Live Preview</h2>
          <p className="text-xs text-muted-foreground">
            {prompt.templateMode ? 'Highlighted filled variables' : 'Static prompt content'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <OpenInAIButton content={interpolated} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => copy(interpolated, { successMessage: 'Copied to clipboard!', errorMessage: 'Failed to copy.' })}
            className="gap-1.5 rounded-xl h-8 border-border/60 shadow-sm"
          >
            {copied ? (
              <Check className="size-3.5 text-emerald-500" weight="bold" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="rounded-xl border border-border/50 bg-muted/20 p-5 font-mono text-sm leading-relaxed text-foreground/80 shadow-inner min-h-[200px] whitespace-pre-wrap break-words">
            <PromptPreview
              content={prompt.content}
              fields={prompt.templateMode ? prompt.templateFields : []}
              values={flatValues}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ─── Shared prompt prop type ──────────────────────────────────────────────────

interface ActivePromptShape {
  _id: string;
  title: string;
  content: string;
  templateMode: boolean;
  templateFields: TemplateField[];
  tags: string[];
  isPublic: boolean;
  category?: string;
  createdAt: number;
}

interface SharedLayoutProps {
  activePrompt: ActivePromptShape;
  templateFields: TemplateField[];
  formValues: Record<string, string | string[] | number | undefined>;
  setValue: (name: string, value: string | string[] | number | undefined) => void;
  flatValues: Record<string, string>;
  interpolated: string;
}

// ─── Prompt type strip ────────────────────────────────────────────────────────

function PromptTypeStrip({ activePrompt }: { activePrompt: ActivePromptShape }) {
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b bg-muted/20 px-4 py-2">
      <Badge
        variant="outline"
        className={cn(
          'gap-1 rounded-full text-xs font-semibold',
          activePrompt.templateMode
            ? 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/8'
            : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/8'
        )}
      >
        {activePrompt.templateMode ? (
          <Lightning className="size-3" weight="fill" />
        ) : (
          <Article className="size-3" weight="fill" />
        )}
        {activePrompt.templateMode ? 'Dynamic prompt' : 'Static prompt'}
      </Badge>
      <h1 className="text-sm font-semibold truncate text-foreground/80">
        {activePrompt.title}
      </h1>
    </div>
  );
}

// ─── Left panel content (variables or static info) ────────────────────────────

function LeftPanelContent({
  activePrompt,
  templateFields,
  formValues,
  setValue,
}: Pick<SharedLayoutProps, 'activePrompt' | 'templateFields' | 'formValues' | 'setValue'>) {
  if (activePrompt.templateMode) {
    return (
      <div className="p-5">
        <DynamicFields
          templateFields={templateFields}
          formValues={formValues}
          setValue={setValue}
        />
      </div>
    );
  }
  return (
    <StaticPromptInfo
      prompt={{
        title: activePrompt.title,
        tags: activePrompt.tags,
        isPublic: activePrompt.isPublic,
        category: activePrompt.category,
        createdAt: activePrompt.createdAt,
      }}
    />
  );
}

// ─── Desktop two-column layout ────────────────────────────────────────────────

function DesktopLayout({
  activePrompt,
  templateFields,
  formValues,
  setValue,
  flatValues,
  interpolated,
}: SharedLayoutProps) {
  return (
    <div className="hidden flex-1 overflow-hidden lg:flex">
      <div className="flex w-[360px] shrink-0 flex-col border-r overflow-hidden">
        <div className="flex items-center gap-2 border-b px-4 py-3 bg-muted/10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {activePrompt.templateMode ? 'Variables' : 'Info'}
          </h2>
        </div>
        <ScrollArea className="flex-1">
          <LeftPanelContent
            activePrompt={activePrompt}
            templateFields={templateFields}
            formValues={formValues}
            setValue={setValue}
          />
        </ScrollArea>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <PreviewPanel
          prompt={{
            content: activePrompt.content,
            templateFields,
            templateMode: activePrompt.templateMode,
          }}
          interpolated={interpolated}
          flatValues={flatValues}
        />
      </div>
    </div>
  );
}

// ─── Mobile tabbed layout ─────────────────────────────────────────────────────

function MobileLayout({
  activePrompt,
  templateFields,
  formValues,
  setValue,
  flatValues,
  interpolated,
}: SharedLayoutProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:hidden">
      <Tabs defaultValue="fill" className="flex h-full flex-col">
        <div className="shrink-0 border-b bg-muted/20 px-3 py-2">
          <TabsList className="grid h-9 w-full grid-cols-2 rounded-xl bg-muted/50 p-0.5">
            <TabsTrigger
              value="fill"
              className={cn(
                'flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all',
                'data-[state=active]:bg-background data-[state=active]:shadow-sm'
              )}
            >
              {activePrompt.templateMode ? (
                <Lightning className="size-3" weight="fill" />
              ) : (
                <Info className="size-3" />
              )}
              {activePrompt.templateMode ? 'Variables' : 'Info'}
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className={cn(
                'flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all',
                'data-[state=active]:bg-background data-[state=active]:shadow-sm'
              )}
            >
              <Copy className="size-3" />
              Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="fill"
          className="m-0 flex-1 overflow-y-auto p-5 data-[state=active]:flex data-[state=active]:flex-col"
        >
          <LeftPanelContent
            activePrompt={activePrompt}
            templateFields={templateFields}
            formValues={formValues}
            setValue={setValue}
          />
        </TabsContent>

        <TabsContent
          value="preview"
          className="m-0 flex-1 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
        >
          <PreviewPanel
            prompt={{
              content: activePrompt.content,
              templateFields,
              templateMode: activePrompt.templateMode,
            }}
            interpolated={interpolated}
            flatValues={flatValues}
            compact
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}


// ─── Main Workspace Page ──────────────────────────────────────────────────────

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeId = searchParams.get('id');

  const prompts = useQuery(api.authed.prompts.list);

  const activePrompt = React.useMemo(
    () => (prompts ?? []).find((p: Doc<'prompts'>) => p._id === activeId) ?? null,
    [prompts, activeId]
  );

  const { setValue, reset, formValues, flatValues, interpolated } =
    usePromptInterpolation(activePrompt);

  // Reset form when switching prompts
  React.useEffect(() => {
    reset({});
  }, [activeId, reset]);

  const templateFields = (activePrompt?.templateFields ?? []) as TemplateField[];

  if (prompts === undefined) return <WorkspaceSkeleton />;
  if (prompts.length === 0) return <EmptyWorkspace />;

  // Auto-select first prompt if no id in URL. Doing this during render
  // (instead of inside useEffect) avoids the flash-then-redirect pattern
  // that the client-side-redirect rule warns about. redirect() throws a
  // special value Next.js catches, so this works as a render-time guard.
  if (!activeId && prompts.length > 0) {
    redirect(`/dashboard/workspace?id=${prompts[0]._id}`);
  }

  const layoutProps: SharedLayoutProps | null = activePrompt
    ? { activePrompt, templateFields, formValues, setValue, flatValues, interpolated }
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-center border-b bg-background/80 px-4 backdrop-blur-sm">
        <PromptSwitcher
          prompts={prompts}
          activeId={activeId ?? undefined}
          onSelect={(id) => router.push(`/dashboard/workspace?id=${id}`)}
        />
      </header>

      {!layoutProps ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
          Select a prompt from the switcher above.
        </div>
      ) : (
        <>
          <PromptTypeStrip activePrompt={layoutProps.activePrompt} />
          <DesktopLayout {...layoutProps} />
          <MobileLayout {...layoutProps} />
        </>
      )}
    </div>
  );
}

// useSearchParams must be inside a Suspense boundary so the rest of the page
// can stay statically rendered. We wrap the whole workspace in Suspense
// using the same skeleton shown while prompts load.
export default function WorkspacePage() {
  return (
    <React.Suspense fallback={<WorkspaceSkeleton />}>
      <WorkspaceContent />
    </React.Suspense>
  );
}