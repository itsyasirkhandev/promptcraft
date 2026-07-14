'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, CaretUpDown, Lightning, Article, Tag } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Doc } from '@/convex/_generated/dataModel';

interface PromptSwitcherProps {
  prompts: Doc<'prompts'>[];
  activeId?: string;
  onSelect: (id: string) => void;
}

export function PromptSwitcher({ prompts, activeId, onSelect }: PromptSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState<Set<string>>(new Set());
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Extract unique tags from all prompts
  const allTags = React.useMemo(() => {
    const tags = new Set<string>();
    prompts.forEach((p) => {
      p.tags?.forEach((t) => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [prompts]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const filteredPrompts = React.useMemo(() => {
    let result = prompts;

    if (selectedTags.size > 0) {
      result = result.filter((p) =>
        Array.from(selectedTags).some((t) => p.tags?.includes(t))
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) => p.title.toLowerCase().includes(q));
    }

    return result;
  }, [prompts, selectedTags, search]);

  const activePrompt = prompts.find((p) => p._id === activeId);

  // Focus search when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (id: string) => {
    onSelect(id);
    router.push(`/dashboard/workspace?id=${id}`);
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setSearch('');
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] max-w-full justify-between gap-2 truncate rounded-xl border-border/60 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-accent/50 transition-all duration-200"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            {activePrompt ? (
              <>
                {activePrompt.templateMode ? (
                  <Lightning className="size-3.5 shrink-0 text-blue-500" weight="fill" />
                ) : (
                  <Article className="size-3.5 shrink-0 text-emerald-500" weight="fill" />
                )}
                <span className="truncate">{activePrompt.title}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select a prompt…</span>
            )}
          </span>
          <CaretUpDown className="size-4 shrink-0 text-muted-foreground/60" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[340px] p-0 rounded-xl border-border/60 shadow-xl overflow-hidden"
        align="start"
        sideOffset={6}
      >
        {/* Search Input */}
        <div className="border-b border-border/50 px-3 py-2.5 bg-muted/20">
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts…"
            className="h-8 rounded-lg border-border/40 bg-background/60 text-sm shadow-none focus-visible:ring-1"
          />
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="border-b border-border/50 bg-muted/10">
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex items-center gap-1.5 px-3 py-2">
                <Tag className="size-3 shrink-0 text-muted-foreground/60" />
                {allTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.has(tag) ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer select-none transition-all duration-150 hover:opacity-80',
                      selectedTags.has(tag) && 'shadow-sm'
                    )}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="h-1.5" />
            </ScrollArea>
          </div>
        )}

        {/* Prompt List */}
        <ScrollArea className="max-h-72">
          <div className="p-1.5">
            {filteredPrompts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No prompts found.
              </div>
            ) : (
              filteredPrompts.map((prompt) => {
                const isActive = prompt._id === activeId;
                const isDynamic = prompt.templateMode;

                return (
                  <button
                    key={prompt._id}
                    onClick={() => handleSelect(prompt._id)}
                    className={cn(
                      'group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50 text-foreground'
                    )}
                  >
                    {/* Active check */}
                    <span className="flex size-4 shrink-0 items-center justify-center">
                      {isActive ? (
                        <Check className="size-3.5 text-primary" weight="bold" />
                      ) : null}
                    </span>

                    {/* Type icon */}
                    {isDynamic ? (
                      <Lightning className="size-3.5 shrink-0 text-blue-500" weight="fill" />
                    ) : (
                      <Article className="size-3.5 shrink-0 text-emerald-500" weight="fill" />
                    )}

                    {/* Title */}
                    <span className="flex-1 truncate font-medium">{prompt.title}</span>

                    {/* Type badge */}
                    <Badge
                      variant="outline"
                      className={cn(
                        'shrink-0 text-[10px] font-semibold tracking-wide px-1.5 h-4',
                        isDynamic
                          ? 'border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/8'
                          : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/8'
                      )}
                    >
                      {isDynamic ? 'Dynamic' : 'Static'}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Footer count */}
        <div className="border-t border-border/50 px-3 py-2 bg-muted/10">
          <p className="text-[11px] text-muted-foreground/60">
            {filteredPrompts.length} of {prompts.length} prompt
            {prompts.length !== 1 ? 's' : ''}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
