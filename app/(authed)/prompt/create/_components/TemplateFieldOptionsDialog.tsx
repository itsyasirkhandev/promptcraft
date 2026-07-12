'use client';

import { useState } from 'react';
import { XCircle } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TemplateFieldOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialOptions: string[];
  onSave: (options: string[]) => void;
}

// Inner component re-mounts (via key) each time the dialog opens, so
// state is always freshly initialised from props — no useEffect needed.
function DialogBody({
  initialOptions,
  onSave,
  onClose,
}: {
  initialOptions: string[];
  onSave: (options: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(initialOptions);
  const [inputValue, setInputValue] = useState('');

  function addOption() {
    const trimmed = inputValue.trim();
    if (!trimmed || draft.includes(trimmed)) return;
    setDraft((prev) => [...prev, trimmed]);
    setInputValue('');
  }

  function removeOption(option: string) {
    setDraft((prev) => prev.filter((o) => o !== option));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  }

  return (
    <>
      {/* Current options list */}
      <div className="flex flex-col gap-1 min-h-[3rem]">
        {draft.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No options yet. Add one below.</p>
        ) : (
          draft.map((option) => (
            <div
              key={option}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1.5"
            >
              <span className="text-sm text-foreground">{option}</span>
              <button
                type="button"
                onClick={() => removeOption(option)}
                className="text-muted-foreground hover:text-destructive transition-colors"
                aria-label={`Remove option ${option}`}
              >
                <XCircle size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add option */}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New option..."
          className="flex-1"
        />
        <Button type="button" variant="outline" size="sm" onClick={addOption}>
          Add
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

export function TemplateFieldOptionsDialog({
  open,
  onOpenChange,
  initialOptions,
  onSave,
}: TemplateFieldOptionsDialogProps) {

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Options</DialogTitle>
        </DialogHeader>
        {/* key={String(open)} causes DialogBody to remount when open flips true,
            initialising its state fresh from initialOptions — no useEffect needed */}
        {open && (
          <DialogBody
            key={String(open)}
            initialOptions={initialOptions}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
