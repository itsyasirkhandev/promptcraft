'use client';

import * as React from 'react';
import { Icon } from '@iconify/react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CaretDown, Check } from '@phosphor-icons/react';
import { toast } from 'sonner';

interface AIProvider {
  id: string;
  name: string;
  icon: string;
  getUrl: (content: string) => string;
}

const PROVIDERS: AIProvider[] = [
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    icon: 'simple-icons:openai',
    getUrl: (content) => `https://chatgpt.com/?q=${encodeURIComponent(content)}&hints=search`,
  },
  {
    id: 'claude',
    name: 'Claude',
    icon: 'simple-icons:anthropic',
    getUrl: (content) => `https://claude.ai/new?q=${encodeURIComponent(content)}`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    icon: 'simple-icons:cursor',
    getUrl: (content) => `https://cursor.com/link/prompt?text=${encodeURIComponent(content)}`,
  },
  {
    id: 'zed',
    name: 'Zed',
    icon: 'simple-icons:zed',
    getUrl: (content) => `zed://agent?prompt=${encodeURIComponent(content)}`,
  },
  {
    id: 't3chat',
    name: 'T3 Chat',
    icon: 'lucide:message-square',
    getUrl: (content) => `https://t3.chat/new?q=${encodeURIComponent(content)}`,
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: 'simple-icons:grok',
    getUrl: (content) => `https://x.com/i/grok?text=${encodeURIComponent(content)}`,
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    icon: 'simple-icons:perplexity',
    getUrl: (content) => `https://www.perplexity.ai/?q=${encodeURIComponent(content)}`,
  },
  {
    id: 'v0',
    name: 'v0',
    icon: 'simple-icons:vercel',
    getUrl: (content) => `https://v0.app/chat?q=${encodeURIComponent(content)}`,
  },
];

interface OpenInAIButtonProps {
  content: string;
}

export function OpenInAIButton({ content }: OpenInAIButtonProps) {
  const [activeProvider, setActiveProvider] = React.useState<AIProvider>(PROVIDERS[0]);
  const [copied, setCopied] = React.useState(false);

  const handleAction = async (provider: AIProvider) => {
    if (!content || content.trim() === '') {
      toast.error('No prompt content to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('Prompt copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      toast.warning('Failed to copy prompt to clipboard.');
    }

    // Generate redirect URL
    const url = provider.getUrl(content);

    // Open target URL
    if (url.startsWith('zed://')) {
      // Prevent opening blank tab for protocol schemes
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Set the clicked provider as active
    setActiveProvider(provider);
  };

  return (
    <div className="inline-flex items-center -space-x-px">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => handleAction(activeProvider)}
        className="h-8 gap-2 rounded-l-xl rounded-r-none border-slate-200 dark:border-slate-800 shadow-sm border-r-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        {copied ? (
          <Check className="size-4 text-emerald-500" />
        ) : (
          <Icon icon={activeProvider.icon} className="size-4 text-slate-600 dark:text-slate-400" />
        )}
        <span>Open in {activeProvider.name}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2 rounded-r-xl rounded-l-none border-slate-200 dark:border-slate-800 shadow-sm border-l-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            aria-label="Select AI provider"
          >
            <CaretDown className="size-3.5 text-slate-500" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-lg">
          {PROVIDERS.map((provider) => (
            <DropdownMenuItem
              key={provider.id}
              onClick={() => handleAction(provider)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg cursor-pointer transition-colors"
            >
              <Icon icon={provider.icon} className="size-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <span>{provider.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
