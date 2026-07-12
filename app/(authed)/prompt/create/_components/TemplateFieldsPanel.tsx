'use client';

import { useState } from 'react';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { Trash } from '@phosphor-icons/react';
import type { PromptFormValues, TemplateField, TemplateFieldType } from '@/lib/schemas/prompt.schema';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TemplateFieldOptionsDialog } from './TemplateFieldOptionsDialog';

// ── Type colour map ──────────────────────────────────────────────────────────

const TYPE_COLORS: Record<TemplateFieldType, string> = {
  text: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  longText: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  number: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  singleSelect: 'bg-green-500/10 text-green-500 border-green-500/20',
  multiSelect: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
};

const TYPE_LABELS: Record<TemplateFieldType, string> = {
  text: 'Text',
  longText: 'Long Text',
  number: 'Number',
  singleSelect: 'Single Select',
  multiSelect: 'Multi Select',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeName(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, '_');
}

// ── Props ────────────────────────────────────────────────────────────────────

interface TemplateFieldsPanelProps {
  control: Control<PromptFormValues>;
  setValue: UseFormSetValue<PromptFormValues>;
  contentValue: string;
}

// ── Per-field card ───────────────────────────────────────────────────────────

interface FieldCardProps {
  field: TemplateField;
  allFields: TemplateField[];
  contentValue: string;
  setValue: UseFormSetValue<PromptFormValues>;
}

function FieldCard({ field, allFields, contentValue, setValue }: FieldCardProps) {
  const [nameInput, setNameInput] = useState(field.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [optionsDialogOpen, setOptionsDialogOpen] = useState(false);

  // ── Name rename logic ──────────────────────────────────────────────────────

  function commitRename() {
    const sanitized = sanitizeName(nameInput);

    if (sanitized === field.name) {
      setNameError(null);
      return;
    }

    if (!sanitized) {
      setNameError('Name cannot be empty.');
      setNameInput(field.name);
      return;
    }

    const duplicate = allFields.some((f) => f.id !== field.id && f.name === sanitized);
    if (duplicate) {
      setNameError(`"${sanitized}" is already used by another field.`);
      setNameInput(field.name);
      return;
    }

    setNameError(null);

    // Replace {{oldName}} → {{newName}} in content
    const newContent = contentValue.replaceAll(`{{${field.name}}}`, `{{${sanitized}}}`);
    setValue('content', newContent, { shouldValidate: true });

    const updated = allFields.map((f) =>
      f.id === field.id ? { ...f, name: sanitized } : f
    );
    setValue('templateFields', updated, { shouldValidate: true });
  }

  // ── Type change logic ──────────────────────────────────────────────────────

  function handleTypeChange(newType: TemplateFieldType) {
    const isSelect = newType === 'singleSelect' || newType === 'multiSelect';
    const updated = allFields.map((f) =>
      f.id === field.id
        ? { ...f, type: newType, options: isSelect ? (f.options ?? []) : undefined }
        : f
    );
    setValue('templateFields', updated, { shouldValidate: true });
  }

  // ── Options save ───────────────────────────────────────────────────────────

  function handleOptionsSave(options: string[]) {
    const updated = allFields.map((f) =>
      f.id === field.id ? { ...f, options } : f
    );
    setValue('templateFields', updated, { shouldValidate: true });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  function handleDelete() {
    // Replace {{fieldName}} with raw fieldName (no braces) in content
    const newContent = contentValue.replaceAll(`{{${field.name}}}`, field.name);
    setValue('content', newContent, { shouldValidate: true });

    const updated = allFields.filter((f) => f.id !== field.id);
    setValue('templateFields', updated, { shouldValidate: true });
  }

  const isSelectType = field.type === 'singleSelect' || field.type === 'multiSelect';

  return (
    <>
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Colored type badge */}
          <Badge
            variant="outline"
            className={`text-xs font-medium border ${TYPE_COLORS[field.type]}`}
          >
            {TYPE_LABELS[field.type]}
          </Badge>

          {/* Editable name */}
          <Input
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setNameError(null);
            }}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitRename();
              }
            }}
            className="h-7 text-sm flex-1 min-w-[8rem] font-mono"
            placeholder="field_name"
          />

          {/* Type selector */}
          <Select value={field.type} onValueChange={(v) => handleTypeChange(v as TemplateFieldType)}>
            <SelectTrigger size="sm" className="w-auto min-w-[8rem]">
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

          {/* Edit Options — only for select types */}
          {isSelectType && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOptionsDialogOpen(true)}
            >
              Edit Options {field.options?.length ? `(${field.options.length})` : ''}
            </Button>
          )}

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDelete}
            className="ml-auto text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
            aria-label={`Delete field ${field.name}`}
          >
            <Trash size={16} />
          </button>
        </div>

        {/* Inline name error */}
        {nameError && (
          <p className="text-xs text-destructive">{nameError}</p>
        )}
      </div>

      {/* Options dialog (only mounted when needed) */}
      {isSelectType && (
        <TemplateFieldOptionsDialog
          open={optionsDialogOpen}
          onOpenChange={setOptionsDialogOpen}
          initialOptions={field.options ?? []}
          onSave={handleOptionsSave}
        />
      )}
    </>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function TemplateFieldsPanel({ control, setValue, contentValue }: TemplateFieldsPanelProps) {
  const templateFields = useWatch({ control, name: 'templateFields' }) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">Template Fields</p>
      <div className="flex flex-col gap-2">
        {templateFields.map((field) => (
          <FieldCard
            key={field.id}
            field={field}
            allFields={templateFields}
            contentValue={contentValue}
            setValue={setValue}
          />
        ))}
      </div>
    </div>
  );
}
