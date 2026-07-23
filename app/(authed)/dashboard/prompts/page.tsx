'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Doc, Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
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
  Check,
  Code,
  Megaphone,
  ChartBar,
  Palette,
  GraduationCap,
  ShareNetwork,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const CATEGORY_MAP: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  coding: { label: 'Coding & Tech', icon: Code },
  writing: { label: 'Writing & Content', icon: PencilSimple },
  marketing: { label: 'Marketing & Growth', icon: Megaphone },
  analysis: { label: 'Data & Analysis', icon: ChartBar },
  design: { label: 'Design & Art', icon: Palette },
  education: { label: 'Education & Learning', icon: GraduationCap },
  other: { label: 'General / Other', icon: Globe },
};

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── PromptCard sub-components ────────────────────────────────────────────────

interface CardHeaderBadgesProps {
  prompt: Doc<'prompts'>;
}

function CardHeaderBadges({ prompt }: CardHeaderBadgesProps) {
  const categoryInfo = prompt.category ? CATEGORY_MAP[prompt.category] : null;
  const CategoryIcon = categoryInfo ? categoryInfo.icon : Globe;

  return (
    <CardHeader className="p-5 pb-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {categoryInfo && (
            <span className="flex-shrink-0 p-1.5 rounded-lg bg-slate-50 border border-slate-100/80 dark:bg-white/5 dark:border-white/5 text-slate-450 dark:text-slate-400">
              <CategoryIcon className="size-3.5 animate-in fade-in duration-200" />
            </span>
          )}
          <CardTitle className="text-base font-semibold text-slate-850 dark:text-slate-100 line-clamp-1 group-hover:text-primary transition-colors">
            {prompt.title}
          </CardTitle>
        </div>
        <div className="flex gap-1.5 shrink-0 select-none">
          {prompt.templateMode ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/30">
              <Lightning className="size-3" /><span>Dynamic</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30">
              <Notebook className="size-3" /><span>Static</span>
            </span>
          )}
          {prompt.isPublic ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-550 dark:text-slate-400 border border-slate-150/40 dark:border-white/5">
              <Globe className="size-3" /><span>Public</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-lg bg-slate-50 dark:bg-white/5 text-slate-550 dark:text-slate-400 border border-slate-150/40 dark:border-white/5">
              <Lock className="size-3" /><span>Private</span>
            </span>
          )}
        </div>
      </div>
    </CardHeader>
  );
}

interface CardContentPreviewProps {
  prompt: Doc<'prompts'>;
  copied: boolean;
  onCopy: () => void;
}

function highlightVariables(text: string, fields: { name: string }[]) {
  if (!fields || fields.length === 0) return text;
  const fieldNames = fields.flatMap((f) => {
    const trimmed = f.name.trim();
    return trimmed ? [trimmed.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')] : [];
  });
  if (fieldNames.length === 0) return text;
  const pattern = new RegExp(`(\\{\\{(?:${fieldNames.join('|')})\\}\\})`, 'g');
  return text.split(pattern).map((part, index) => {
    const cleanPart = part.replace(/^\{\{?|\}\}?$/g, '').trim();
    const match = fields.find((f) => f.name === cleanPart);
    if (match) {
      return (
        // react-doctor-disable-next-line react-doctor/no-array-index-as-key: tokens from string.split() have no stable id; position is the identity, react-doctor/no-array-index-as-key
        <span
          key={`part-${index}`}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded bg-purple-500/10 dark:bg-purple-450/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 dark:border-purple-400/20 font-semibold font-sans text-[10px] select-all cursor-help"
          title={`Variable: ${match.name}`}
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

function CardContentPreview({ prompt, copied, onCopy }: CardContentPreviewProps) {
  return (
    <div className="relative group/code rounded-xl overflow-hidden border border-slate-150 dark:border-white/5 bg-slate-50/40 dark:bg-black/35">
      <pre className="text-xs text-slate-700 dark:text-slate-305 p-4 pr-12 font-mono min-h-[96px] max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed">
        {highlightVariables(prompt.content, prompt.templateFields ?? [])}
      </pre>
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-slate-50/50 dark:from-black/10 to-transparent pointer-events-none" />
      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover/code:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={onCopy}
          className={cn(
            'flex items-center justify-center size-7 rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all transform active:scale-95',
            copied && 'border-emerald-250 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450'
          )}
          title="Copy prompt content"
        >
          {copied ? <Check className="size-4 text-emerald-500 stroke-[3]" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  );
}

interface CardFooterActionsProps {
  prompt: Doc<'prompts'>;
  copied: boolean;
  onCopy: () => void;
  copiedSlug: boolean;
  onCopySlug: () => void;
  onDelete: (id: Id<'prompts'>, title: string) => void;
  formatDate: (ts: number) => string;
}

function CardFooterActions({ prompt, copied, onCopy, copiedSlug, onCopySlug, onDelete, formatDate }: CardFooterActionsProps) {
  const hasUpdatedAt = typeof prompt.updatedAt === 'number';
  const displayUpdateDate = hasUpdatedAt ? prompt.updatedAt : prompt.createdAt;

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border/40 dark:border-white/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {prompt.templateMode ? (
            <Button asChild size="sm" className="text-xs h-8 gap-1.5 px-3.5 rounded-xl shadow-sm bg-purple-600 hover:bg-purple-700 dark:bg-purple-600 dark:hover:bg-purple-500 text-white border-0 transition-transform active:scale-[0.98]">
              <Link href={`/prompt/${prompt._id}/use`}>
                <Lightning className="size-3.5" /><span>Use Prompt</span>
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onCopy} className="text-xs h-8 gap-1.5 px-3.5 rounded-xl border-border/60 hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm transition-transform active:scale-[0.98]">
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          {prompt.isPublic && prompt.publicSlug && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCopySlug}
              title="Copy share link"
              className="size-8 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5"
            >
              {copiedSlug ? <Check className="size-4 text-emerald-500" /> : <ShareNetwork className="size-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild className="size-8 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5">
            <Link href={`/prompt/${prompt._id}/edit`}><PencilSimple className="size-4" /></Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(prompt._id, prompt.title)} className="size-8 rounded-xl text-slate-400 hover:text-destructive dark:text-slate-500 dark:hover:text-destructive hover:bg-destructive/10">
            <Trash className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 border-t border-slate-100/50 dark:border-white/5 pt-2 flex-wrap gap-1">
        <div className="flex items-center gap-1.25">
          <Clock className="size-3 opacity-75 mr-1" />
          <span>Created {formatDate(prompt.createdAt)}</span>
        </div>
        {hasUpdatedAt && prompt.updatedAt !== prompt.createdAt && (
          <span>Updated {formatDate(displayUpdateDate!)}</span>
        )}
      </div>
    </div>
  );
}

// ── PromptCard ───────────────────────────────────────────────────────────────

interface PromptCardProps {
  prompt: Doc<'prompts'>;
  onDelete: (id: Id<'prompts'>, title: string) => void;
  formatDate: (timestamp: number) => string;
}

function PromptCard({ prompt, onDelete, formatDate }: PromptCardProps) {
  const [copied, setCopied] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt.content);
      setCopied(true);
      toast.success('Copied prompt content to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCopySlug = async () => {
    if (!prompt.publicSlug) return;
    try {
      const shareUrl = `${window.location.origin}/p/${prompt.publicSlug}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedSlug(true);
      toast.success('Share link copied to clipboard');
      setTimeout(() => setCopiedSlug(false), 2000);
    } catch {
      toast.error('Failed to copy share link');
    }
  };

  return (
    <Card className={cn(
      'flex flex-col overflow-hidden bg-card text-card-foreground border border-border/60 rounded-2xl shadow-sm transition-all duration-300 group relative hover:-translate-y-0.5 hover:shadow-md',
      prompt.templateMode
        ? 'hover:border-purple-500/30 hover:shadow-[0_8px_30px_rgba(168,85,247,0.04)]'
        : 'hover:border-blue-500/30 hover:shadow-[0_8px_30px_rgba(59,130,246,0.04)]'
    )}>
      <CardHeaderBadges prompt={prompt} />
      <CardContent className="px-5 pb-5 pt-0 flex-1 flex flex-col justify-between gap-4">
        <div className="flex-1 flex flex-col gap-3">
          <CardContentPreview prompt={prompt} copied={copied} onCopy={handleCopy} />
          {/* Variables and Tags */}
          {((prompt.tags && prompt.tags.length > 0) || (prompt.templateMode && prompt.templateFields && prompt.templateFields.length > 0)) && (
            <div className="flex flex-col gap-2">
              {prompt.templateMode && prompt.templateFields && prompt.templateFields.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider select-none">Variables:</span>
                  {prompt.templateFields.map((field) => (
                    <span key={field.id} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/30 font-medium">
                      {field.name}
                    </span>
                  ))}
                </div>
              )}
              {prompt.tags && prompt.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {prompt.tags.map((tag) => (
                    <span key={tag} className="bg-slate-50 dark:bg-white/5 text-slate-550 dark:text-slate-400 font-medium px-2 py-0.5 rounded-md text-[10px] border border-slate-150/40 dark:border-white/5 flex items-center gap-1 select-none">
                      <Tag className="size-2.5 opacity-60" />{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <CardFooterActions prompt={prompt} copied={copied} onCopy={handleCopy} copiedSlug={copiedSlug} onCopySlug={handleCopySlug} onDelete={onDelete} formatDate={formatDate} />
      </CardContent>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function PromptsDashboardPage() {
  const prompts = useQuery(api.authed.prompts.list);
  const deletePrompt = useMutation(api.authed.prompts.remove);
  const [promptToDelete, setPromptToDelete] = useState<{ id: Id<'prompts'>; title: string } | null>(null);

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'static' | 'dynamic'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'updated_desc' | 'updated_asc'>('newest');

  const filteredAndSortedPrompts = useMemo(() => {
    if (!prompts) return [];
    const result = [...prompts].filter((prompt) => {
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        prompt.title.toLowerCase().includes(query) ||
        prompt.content.toLowerCase().includes(query) ||
        (prompt.tags && prompt.tags.some((tag: string) => tag.toLowerCase().includes(query)));
      let matchesType = true;
      if (filterType === 'static') matchesType = !prompt.templateMode;
      else if (filterType === 'dynamic') matchesType = prompt.templateMode;
      return matchesSearch && matchesType;
    });

    result.sort((a, b) => {
      const aUpdated = a.updatedAt ?? a.createdAt;
      const bUpdated = b.updatedAt ?? b.createdAt;
      if (sortBy === 'newest') return b.createdAt - a.createdAt;
      if (sortBy === 'oldest') return a.createdAt - b.createdAt;
      if (sortBy === 'updated_desc') return bUpdated - aUpdated;
      if (sortBy === 'updated_asc') return aUpdated - bUpdated;
      return 0;
    });
    return result;
  }, [prompts, search, filterType, sortBy]);



  if (prompts === undefined) {
    return (
      <div className="flex flex-col gap-6 max-w-5xl mx-auto p-1 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-9 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
            <div className="h-4 w-72 bg-slate-100 dark:bg-slate-800/50 rounded mt-2"></div>
          </div>
          <div className="h-9 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
        </div>
        <div className="h-px bg-slate-200 dark:bg-slate-800" />
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:max-w-sm h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          <div className="flex gap-3 w-full md:w-auto items-center">
            <div className="w-full sm:w-44 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
            <div className="w-full sm:w-44 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="flex flex-col overflow-hidden bg-card text-card-foreground border border-border/60 rounded-2xl shadow-sm h-64 p-5 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-7 bg-slate-200 dark:bg-slate-850 rounded-lg"></div>
                  <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
                <div className="h-5 w-20 bg-slate-100 dark:bg-slate-800/50 rounded"></div>
              </div>
              <div className="flex-1 bg-slate-50/50 dark:bg-black/35 rounded-xl p-4 flex flex-col gap-2">
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-800 rounded"></div>
                <div className="h-3 w-4/6 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                <div className="flex gap-2">
                  <div className="size-8 bg-slate-200 dark:bg-slate-850 rounded-xl"></div>
                  <div className="size-8 bg-slate-200 dark:bg-slate-850 rounded-xl"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-1 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight font-heading">Prompts Library</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Manage, filter, and reuse your static and dynamic templates.</p>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto shrink-0 shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]">
          <Link href="/prompt/create" className="flex items-center gap-2">
            <Plus className="size-4" /><span>New Prompt</span>
          </Link>
        </Button>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800" />

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:max-w-sm">
          <InputGroup className="w-full bg-white dark:bg-slate-900 shadow-sm rounded-xl">
            <InputGroupAddon align="inline-start"><MagnifyingGlass className="size-4 text-slate-400" /></InputGroupAddon>
            <InputGroupInput
              placeholder="Search title, content, or tags..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border-0 focus-visible:ring-0"
            />
          </InputGroup>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-center">
          <Tabs value={filterType} onValueChange={(val) => setFilterType(val as 'all' | 'static' | 'dynamic')} className="w-full sm:w-auto">
            <TabsList className="bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl w-full sm:w-auto justify-start border border-slate-200/55 dark:border-slate-700/50">
              <TabsTrigger value="all" className="rounded-lg px-3 py-1 text-xs">All</TabsTrigger>
              <TabsTrigger value="static" className="rounded-lg px-3 py-1 text-xs">Static</TabsTrigger>
              <TabsTrigger value="dynamic" className="rounded-lg px-3 py-1 text-xs">Dynamic</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={sortBy} onValueChange={(val) => setSortBy(val as 'newest' | 'oldest' | 'updated_desc' | 'updated_asc')}>
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

      {filteredAndSortedPrompts.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-transparent flex flex-col items-center justify-center p-12 text-center rounded-2xl shadow-none">
          <div className="bg-slate-100 dark:bg-slate-850 p-4 rounded-full mb-4">
            <Notebook className="size-8 text-slate-400 dark:text-slate-500" />
          </div>
          <CardTitle className="text-xl font-semibold text-slate-800 dark:text-slate-200">No prompts found</CardTitle>
          <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-sm text-sm">
            {prompts.length === 0
              ? 'Your library is empty. Get started by creating your first prompt.'
              : 'No prompts match your current search terms or active filters.'}
          </p>
          <Button asChild className="mt-6 shadow-sm rounded-xl">
            <Link href="/prompt/create"><Plus className="size-4 mr-2" />Create Prompt</Link>
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredAndSortedPrompts.map((prompt) => (
            <PromptCard key={prompt._id} prompt={prompt} onDelete={(id, title) => setPromptToDelete({ id, title })} formatDate={formatDate} />
          ))}
        </div>
      )}

      <Dialog open={!!promptToDelete} onOpenChange={(open) => !open && setPromptToDelete(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Prompt</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-100">&ldquo;{promptToDelete?.title}&rdquo;</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPromptToDelete(null)} className="rounded-xl">Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (promptToDelete) {
                  try {
                    await deletePrompt({ id: promptToDelete.id });
                    toast.success('Prompt deleted!');
                  } catch {
                    toast.error('Failed to delete prompt');
                  }
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