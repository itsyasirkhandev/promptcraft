'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MagnifyingGlass,
  Plus,
  Clock,
  Tag,
  Lock,
  Globe,
  Notebook,
  Lightning,
  PencilSimple,
  Trash,
  Copy,
} from '@phosphor-icons/react';

export default function PromptsDashboardPage() {
  const prompts = useAppStore((state) => state.prompts);
  const deletePrompt = useAppStore((state) => state.deletePrompt);
  const [promptToDelete, setPromptToDelete] = useState<{ id: string; title: string } | null>(null);

  const handleDeletePrompt = (id: string, title: string) => {
    setPromptToDelete({ id, title });
  };

  const handleCopyContent = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copied prompt content to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'static' | 'dynamic'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated_desc' | 'updated_asc'>('newest');

  const filteredAndSortedPrompts = useMemo(() => {
    // 1. Filtering
    const result = prompts.filter((prompt) => {
      // Search query filter
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        prompt.title.toLowerCase().includes(query) ||
        prompt.content.toLowerCase().includes(query) ||
        prompt.tags.some((tag) => tag.toLowerCase().includes(query));

      // Type filter
      let matchesType = true;
      if (filterType === 'static') {
        matchesType = !prompt.templateMode;
      } else if (filterType === 'dynamic') {
        matchesType = prompt.templateMode;
      }

      return matchesSearch && matchesType;
    });

    // 2. Sorting
    result.sort((a, b) => {
      const aUpdated = a.updatedAt ?? a.createdAt;
      const bUpdated = b.updatedAt ?? b.createdAt;

      if (sortBy === 'newest') {
        return b.createdAt - a.createdAt;
      }
      if (sortBy === 'oldest') {
        return a.createdAt - b.createdAt;
      }
      if (sortBy === 'updated_desc') {
        return bUpdated - aUpdated;
      }
      if (sortBy === 'updated_asc') {
        return aUpdated - bUpdated;
      }
      return 0;
    });

    return result;
  }, [prompts, search, filterType, sortBy]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-1 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-heading">
            Prompts Library
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Manage, filter, and reuse your static and dynamic templates.
          </p>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto shrink-0 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <Link href="/prompt/create" className="flex items-center gap-2">
            <Plus className="size-4" />
            <span>New Prompt</span>
          </Link>
        </Button>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Input */}
        <div className="w-full md:max-w-sm">
          <InputGroup className="w-full bg-white dark:bg-slate-900 shadow-sm rounded-xl">
            <InputGroupAddon align="inline-start">
              <MagnifyingGlass className="size-4 text-slate-400" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search title, content, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border-0 focus-visible:ring-0"
            />
          </InputGroup>
        </div>

        {/* Filters Group */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <Tabs
            value={filterType}
            onValueChange={(val) => setFilterType(val as 'all' | 'static' | 'dynamic')}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full sm:w-auto justify-start border border-slate-200/55 dark:border-slate-700/50">
              <TabsTrigger value="all" className="rounded-lg px-3 py-1 text-xs">All</TabsTrigger>
              <TabsTrigger value="static" className="rounded-lg px-3 py-1 text-xs">Static</TabsTrigger>
              <TabsTrigger value="dynamic" className="rounded-lg px-3 py-1 text-xs">Dynamic</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select
            value={sortBy}
            onValueChange={(val) => setSortBy(val as 'newest' | 'oldest' | 'updated_desc' | 'updated_asc')}
          >
            <SelectTrigger size="sm" className="w-full sm:w-44 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent position="popper" className="rounded-xl border border-slate-200 dark:border-slate-800">
              <SelectItem value="newest" className="rounded-lg">Newest</SelectItem>
              <SelectItem value="oldest" className="rounded-lg">Oldest</SelectItem>
              <SelectItem value="updated_desc" className="rounded-lg">Recently Updated</SelectItem>
              <SelectItem value="updated_asc" className="rounded-lg">Least Recently Updated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Prompts Display */}
      {filteredAndSortedPrompts.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent flex flex-col items-center justify-center p-12 text-center rounded-2xl shadow-none">
          <div className="bg-slate-100 dark:bg-slate-850 p-4 rounded-full mb-4">
            <Notebook className="size-8 text-slate-400 dark:text-slate-500" />
          </div>
          <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-200">
            No prompts found
          </CardTitle>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-sm">
            {prompts.length === 0
              ? "Your library is empty. Get started by creating your first prompt."
              : "No prompts match your current search terms or active filters."}
          </p>
          <Button asChild className="mt-6 shadow-sm rounded-xl">
            <Link href="/prompt/create">
              <Plus className="size-4 mr-2" />
              Create Prompt
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAndSortedPrompts.map((prompt) => {
            const hasUpdatedAt = typeof prompt.updatedAt === 'number';
            const displayUpdateDate = hasUpdatedAt ? prompt.updatedAt : prompt.createdAt;

            return (
              <Card
                key={prompt.id}
                className="flex flex-col overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 group relative hover:border-slate-300 dark:hover:border-slate-700"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 line-clamp-1 group-hover:text-primary transition-colors">
                      {prompt.title}
                    </CardTitle>
                    <div className="flex gap-1.5 shrink-0">
                      {prompt.templateMode ? (
                        <Badge
                          variant="secondary"
                          className="bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 hover:bg-purple-100/50 dark:hover:bg-purple-950/40 font-medium px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 select-none"
                        >
                          <Lightning className="size-3" />
                          Dynamic
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100/50 dark:hover:bg-blue-950/40 font-medium px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1 select-none"
                        >
                          <Notebook className="size-3" />
                          Static
                        </Badge>
                      )}

                      {prompt.isPublic ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 rounded-lg border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-normal flex items-center gap-1 select-none"
                        >
                          <Globe className="size-3" />
                          Public
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 rounded-lg border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-normal flex items-center gap-1 select-none"
                        >
                          <Lock className="size-3" />
                          Private
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-0 flex-1 flex flex-col justify-between gap-4">
                  {/* Content snippet */}
                  <div className="flex-1">
                    <pre className="text-xs bg-slate-50 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-800/60 text-slate-700 dark:text-slate-350 p-3.5 rounded-xl font-mono min-h-20 max-h-36 overflow-hidden line-clamp-4 whitespace-pre-wrap select-all">
                      {prompt.content}
                    </pre>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 border-y border-slate-100 dark:border-slate-800/65 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyContent(prompt.content)}
                        className="text-xs h-8 gap-1.5 px-3 rounded-xl border-slate-200 dark:border-slate-800 shadow-sm"
                      >
                        <Copy className="size-3.5" />
                        <span>Copy</span>
                      </Button>
                      {prompt.templateMode && (
                        <Button
                          asChild
                          size="sm"
                          className="text-xs h-8 gap-1.5 px-3 rounded-xl shadow-sm"
                        >
                          <Link href={`/prompt/${prompt.id}/use`}>
                            <Lightning className="size-3.5" />
                            <span>Use Prompt</span>
                          </Link>
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        className="size-8 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                      >
                        <Link href={`/prompt/${prompt.id}/edit`}>
                          <PencilSimple className="size-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePrompt(prompt.id, prompt.title)}
                        className="size-8 rounded-xl text-slate-400 hover:text-destructive dark:text-slate-500 dark:hover:text-destructive"
                      >
                        <Trash className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Footer details */}
                  <div className="flex flex-col gap-2.5">
                    {/* Tags */}
                    {prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {prompt.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-normal px-2 py-0.5 rounded-lg text-[10px] border border-slate-200/20 dark:border-slate-700/25 flex items-center gap-1 select-none"
                          >
                            <Tag className="size-2.5 opacity-60" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-850 pt-2.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 opacity-70" />
                        <span>Created {formatDate(prompt.createdAt)}</span>
                      </div>
                      {hasUpdatedAt && prompt.updatedAt !== prompt.createdAt && (
                        <span>Updated {formatDate(displayUpdateDate!)}</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!promptToDelete} onOpenChange={(open) => !open && setPromptToDelete(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Prompt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the prompt <span className="font-semibold text-slate-900 dark:text-slate-100">&ldquo;{promptToDelete?.title}&rdquo;</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPromptToDelete(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (promptToDelete) {
                  deletePrompt(promptToDelete.id);
                  toast.success('Prompt deleted!');
                  setPromptToDelete(null);
                }
              }}
              className="rounded-xl"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
