'use client';

import { useState } from 'react';
import { XCircle } from '@phosphor-icons/react';
import type { TemplateField, TemplateFieldType } from '@/lib/schemas/prompt.schema';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Field,
  FieldLabel,
} from '@/components/ui/field';

interface CreateTemplateFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  existingFields: TemplateField[];
  onSave: (field: { name: string; type: TemplateFieldType; options?: string[] }) => void;
}

function sanitizeName(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

function DialogBody({
  initialName,
  existingFields,
  onSave,
  onClose,
}: {
  initialName: string;
  existingFields: TemplateField[];
  onSave: (field: { name: string; type: TemplateFieldType; options?: string[] }) => void;
  onClose: () => void;
}) {
  const [nameInput, setNameInput] = useState(() => sanitizeName(initialName));
  const [type, setType] = useState<TemplateFieldType>('text');
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  
  const [nameError, setNameError] = useState<string | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  function addOption() {
    const trimmed = optionInput.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) {
      setOptionsError('Option already exists.');
      return;
    }
    setOptions((prev) => [...prev, trimmed]);
    setOptionInput('');
    setOptionsError(null);
  }

  function removeOption(option: string) {
    setOptions((prev) => prev.filter((o) => o !== option));
  }

  function handleSave() {
    const sanitized = sanitizeName(nameInput);
    
    if (!sanitized) {
      setNameError('Field name cannot be empty.');
      return;
    }

    const duplicate = existingFields.some((f) => f.name === sanitized);
    if (duplicate) {
      setNameError(`"${sanitized}" is already used by another field.`);
      return;
    }

    const isSelectType = type === 'singleSelect' || type === 'multiSelect';
    if (isSelectType && options.length === 0) {
      setOptionsError('At least one option is required.');
      return;
    }

    onSave({
      name: sanitized,
      type,
      options: isSelectType ? options : undefined,
    });
  }

  const isSelectType = type === 'singleSelect' || type === 'multiSelect';

  return (
    <div className="flex flex-col gap-4">
      <Field orientation="vertical">
        <FieldLabel htmlFor="fieldName" className="text-foreground">
          Field Name
        </FieldLabel>
        <Input
          id="fieldName"
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value);
            setNameError(null);
          }}
          className="font-mono"
          placeholder="field_name"
        />
        {nameError && <p className="text-xs text-destructive mt-1">{nameError}</p>}
      </Field>

      <Field orientation="vertical">
        <FieldLabel htmlFor="fieldType" className="text-foreground">
          Field Type
        </FieldLabel>
        <Select value={type} onValueChange={(v) => {
          setType(v as TemplateFieldType);
          setOptionsError(null);
        }}>
          <SelectTrigger id="fieldType" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="longText">Long Text</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="singleSelect">Single Select</SelectItem>
            <SelectItem value="multiSelect">Multi Select</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {isSelectType && (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <Field orientation="vertical">
            <FieldLabel className="text-foreground">Options</FieldLabel>
            <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
              {options.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">No options yet. Add one below.</p>
              ) : (
                options.map((option) => (
                  <div
                    key={option}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-1"
                  >
                    <span className="text-sm text-foreground font-mono">{option}</span>
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
            
            <div className="flex gap-2 mt-2">
              <Input
                value={optionInput}
                onChange={(e) => {
                  setOptionInput(e.target.value);
                  setOptionsError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOption();
                  }
                }}
                placeholder="New option..."
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={addOption}>
                Add
              </Button>
            </div>
            {optionsError && <p className="text-xs text-destructive mt-1">{optionsError}</p>}
          </Field>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave}>
          Save Field
        </Button>
      </div>
    </div>
  );
}

export function CreateTemplateFieldDialog({
  open,
  onOpenChange,
  initialName,
  existingFields,
  onSave,
}: CreateTemplateFieldDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Dynamic Field</DialogTitle>
        </DialogHeader>
        {open && (
          <DialogBody
            key={String(open)}
            initialName={initialName}
            existingFields={existingFields}
            onSave={onSave}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
