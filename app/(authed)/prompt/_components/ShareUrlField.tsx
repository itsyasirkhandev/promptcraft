'use client';

import { Check, Copy } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useClipboardCopy } from '@/lib/hooks/use-clipboard-copy';

interface ShareUrlFieldProps {
  slug: string;
}

export function ShareUrlField({ slug }: ShareUrlFieldProps) {
  const { copied, copy } = useClipboardCopy();
  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${slug}`;

  return (
    <Field orientation="vertical">
      <FieldLabel className="text-foreground">Public Link</FieldLabel>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={url}
          className="font-mono text-sm"
          onClick={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            copy(url, {
              successMessage: 'Link copied to clipboard',
              errorMessage: 'Failed to copy link.',
            })
          }
          className="gap-2 shrink-0"
        >
          {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </Button>
      </div>
    </Field>
  );
}
