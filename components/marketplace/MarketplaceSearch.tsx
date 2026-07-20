'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { useQueryState, parseAsString, parseAsStringLiteral, throttle } from 'nuqs';
import {
  ChartBar,
  CircleNotch,
  Code,
  Globe,
  GraduationCap,
  MagnifyingGlass,
  Megaphone,
  Palette,
  PencilSimple,
  SquaresFour,
  X,
} from '@phosphor-icons/react';
import { api } from '@/convex/_generated/api';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MarketplacePromptCard } from './MarketplacePromptCard';

/**
 * This project's 7 public-prompt categories plus an `all` sentinel. The ids
 * match `allowedCategories` in convex/authed/validation.ts (the source of
 * truth) and the labels/icons match the dashboard's `CATEGORY_MAP` /
 * `CategorySelector.tsx`, so the marketplace reads consistently with the rest
 * of the app.
 */
const CATEGORIES = [
  { id: 'all', label: 'All', icon: SquaresFour },
  { id: 'coding', label: 'Coding & Tech', icon: Code },
  { id: 'writing', label: 'Writing & Content', icon: PencilSimple },
  { id: 'marketing', label: 'Marketing & Growth', icon: Megaphone },
  { id: 'analysis', label: 'Data & Analysis', icon: ChartBar },
  { id: 'design', label: 'Design & Art', icon: Palette },
  { id: 'education', label: 'Education & Learning', icon: GraduationCap },
  { id: 'other', label: 'General / Other', icon: Globe },
] as const;

const sortValues = ['recent', 'a-z'] as const;

export function MarketplaceSearch() {
  // `q` — free-text search. URL-updated on every keystroke (throttled at 50ms,
  // `history: 'replace'` so the back button isn't polluted) and shown in the
  // input immediately; a 300ms debounce (below) gates the value handed to the
  // Convex query so one query fires per typing pause, not per keystroke.
  const [q, setQ] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({
      history: 'replace',
      limitUrlUpdates: throttle(50),
    }),
  );

  // `category` — active category id. `history: 'push'` so category clicks are
  // navigable (back button returns to the previous category).
  const [activeCategory, setActiveCategory] = useQueryState(
    'category',
    parseAsString.withDefault('all').withOptions({
      history: 'push',
    }),
  );

  // `sort` — `recent` (newest first) or `a-z`. `history: 'push'`.
  const [sortBy, setSortBy] = useQueryState(
    'sort',
    parseAsStringLiteral(sortValues).withDefault('recent').withOptions({
      history: 'push',
    }),
  );

  const debouncedQuery = useDebounce(q, 300);

  const prompts = useQuery(api.public.prompts.listPublicPrompts, {
    searchQuery: debouncedQuery || undefined,
    category: activeCategory,
    sortBy: sortBy,
  });

  const handleResetFilters = () => {
    // Nulling each param lets nuqs resolve to its `withDefault` and strip the
    // URL param, producing a clean `/marketplace` URL.
    void setQ(null);
    void setActiveCategory(null);
    void setSortBy(null);
  };

  const isLoading = prompts === undefined;
  const isSearchPending = q !== debouncedQuery;
  const hasActiveFilters =
    q !== '' || activeCategory !== 'all' || sortBy !== 'recent';
  const activeCategoryMeta = CATEGORIES.find((c) => c.id === activeCategory);
  const EmptyStateIcon = activeCategoryMeta?.icon ?? MagnifyingGlass;

  return (
    <div className="flex w-full animate-in fade-in flex-col gap-6 duration-500">
      {/* Search input */}
      <div className="relative mx-auto w-full max-w-md md:max-w-2xl">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search prompts by title, content, or tags..."
          value={q}
          onChange={(e) => void setQ(e.target.value)}
          aria-label="Search public prompts"
          className="h-12 rounded-full border-2 bg-background pl-10 text-base shadow-sm focus-visible:border-primary"
        />
        {isSearchPending && (
          <CircleNotch className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Category tabs */}
      <div className="scrollbar-none w-full overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max gap-2.5 px-1 md:justify-center">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => void setActiveCategory(cat.id)}
                aria-pressed={isActive}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm transition-all duration-300 active:scale-95',
                  isActive
                    ? 'scale-[1.02] border-slate-900 bg-slate-900 font-bold text-white shadow-md dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:scale-[1.01] hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                )}
              >
                <Icon
                  className={cn(
                    'size-4 transition-transform duration-300',
                    isActive && 'scale-110 rotate-3',
                  )}
                />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter row: reset + sort */}
      <div className="flex w-full flex-col items-center justify-between gap-4 px-1 sm:flex-row md:justify-end">
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="mr-auto text-muted-foreground hover:text-foreground"
          >
            <X className="mr-2 size-4" />
            Reset Filters
          </Button>
        )}

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-sm font-medium text-muted-foreground">
            Sort By:
          </span>
          <Select
            value={sortBy}
            onValueChange={(val: (typeof sortValues)[number]) =>
              void setSortBy(val)
            }
          >
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Sort order" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Recently Published</SelectItem>
              <SelectItem value="a-z">A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid / loading / empty states */}
      <div className="min-h-[400px]">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <p className="flex items-center gap-2 text-muted-foreground">
              <CircleNotch className="size-4 animate-spin" /> Loading prompts...
            </p>
          </div>
        ) : prompts.length === 0 ? (
          <div className="mt-4 animate-in fade-in zoom-in-95 rounded-3xl border border-dashed border-slate-300 bg-muted/30 py-20 text-center duration-300 dark:border-slate-800">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <EmptyStateIcon className="size-8 text-muted-foreground opacity-60" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {activeCategory === 'all'
                ? 'No prompts found'
                : `No prompts in ${activeCategoryMeta?.label ?? activeCategory} yet`}
            </h3>
            <p className="mx-auto mt-1 max-w-sm px-4 text-sm text-muted-foreground">
              {activeCategory === 'all'
                ? 'Try adjusting your search terms or keywords.'
                : 'Be the first to share a prompt in this category and contribute to the community!'}
            </p>
          </div>
        ) : (
          <div className="@container w-full">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-6">
              {prompts.map((prompt) => (
                <MarketplacePromptCard key={prompt._id} prompt={prompt} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}