'use client';

import * as React from 'react';
import { Info } from '@phosphor-icons/react';
import type { TemplateField } from '@/lib/schemas/prompt.schema';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface DynamicFieldsProps {
  templateFields: TemplateField[];
  formValues: Record<string, string | string[] | number | undefined>;
  setValue: (name: string, value: string | string[] | number | undefined) => void;
  className?: string;
  variant?: 'workspace' | 'use';
}

// ── Shared style helpers ──────────────────────────────────────────────────────

function inputCn(isWorkspace: boolean) {
  return cn(
    'rounded-xl text-sm',
    isWorkspace
      ? 'border-border/60 bg-background/60'
      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40'
  );
}

// ── Per-type sub-components ───────────────────────────────────────────────────

interface FieldControlProps {
  field: TemplateField;
  valueStr: string;
  currentValue: string | string[] | number | undefined;
  isWorkspace: boolean;
  setValue: DynamicFieldsProps['setValue'];
}

function FieldText({ field, valueStr, isWorkspace, setValue }: FieldControlProps) {
  return (
    <Input
      id={field.id}
      type="text"
      placeholder={
        isWorkspace
          ? `Enter ${field.name.replace(/_/g, ' ')}…`
          : `Enter value for ${field.name}...`
      }
      value={valueStr}
      onChange={(e) => setValue(field.name, e.target.value)}
      className={inputCn(isWorkspace)}
    />
  );
}

function FieldLongText({ field, valueStr, isWorkspace, setValue }: FieldControlProps) {
  return (
    <Textarea
      id={field.id}
      placeholder={
        isWorkspace
          ? `Enter ${field.name.replace(/_/g, ' ')}…`
          : `Enter long text for ${field.name}...`
      }
      value={valueStr}
      onChange={(e) => setValue(field.name, e.target.value)}
      className={cn(
        'rounded-xl text-sm resize-y',
        isWorkspace
          ? 'border-border/60 bg-background/60 min-h-[96px]'
          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 min-h-24'
      )}
    />
  );
}

function FieldNumber({ field, valueStr, isWorkspace, setValue }: FieldControlProps) {
  return (
    <Input
      id={field.id}
      type="number"
      placeholder={isWorkspace ? '0' : 'Enter number...'}
      value={valueStr}
      onChange={(e) => setValue(field.name, e.target.value)}
      className={inputCn(isWorkspace)}
    />
  );
}

function FieldSingleSelect({ field, valueStr, isWorkspace, setValue }: FieldControlProps) {
  return (
    <Select value={valueStr} onValueChange={(val) => setValue(field.name, val)}>
      <SelectTrigger
        className={cn('rounded-xl text-sm text-left', inputCn(isWorkspace))}
      >
        <SelectValue
          placeholder={isWorkspace ? 'Select an option…' : 'Select an option...'}
        />
      </SelectTrigger>
      <SelectContent
        className={cn('rounded-xl', !isWorkspace && 'border-slate-200 dark:border-slate-800')}
      >
        {field.options?.map((opt) => (
          <SelectItem key={opt} value={opt} className="rounded-lg">
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldMultiSelect({ field, currentValue, isWorkspace, setValue }: FieldControlProps) {
  const list = Array.isArray(currentValue) ? currentValue : [];
  const listSet = new Set(list);
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3',
        isWorkspace
          ? 'border-border/60 bg-background/40'
          : 'border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-950/10'
      )}
    >
      {field.options && field.options.length > 0 ? (
        field.options.map((opt) => {
          const isChecked = listSet.has(opt);
          return (
            <div key={opt} className="flex items-center gap-2">
              <Checkbox
                id={`${field.id}-${opt}`}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  const newList = checked
                    ? [...list, opt]
                    : list.filter((v) => v !== opt);
                  setValue(field.name, newList);
                }}
              />
              <Label
                htmlFor={`${field.id}-${opt}`}
                className={cn(
                  'text-sm font-normal cursor-pointer select-none',
                  !isWorkspace && 'text-slate-600 dark:text-slate-400'
                )}
              >
                {opt}
              </Label>
            </div>
          );
        })
      ) : (
        <span className="text-xs text-muted-foreground italic">No options defined.</span>
      )}
    </div>
  );
}

// ── Single field row ──────────────────────────────────────────────────────────

function FieldItem({
  field,
  formValues,
  isWorkspace,
  setValue,
}: {
  field: TemplateField;
  formValues: DynamicFieldsProps['formValues'];
  isWorkspace: boolean;
  setValue: DynamicFieldsProps['setValue'];
}) {
  const currentValue = formValues[field.name];
  const valueStr =
    typeof currentValue === 'string' || typeof currentValue === 'number'
      ? String(currentValue)
      : '';

  const controlProps: FieldControlProps = {
    field,
    valueStr,
    currentValue,
    isWorkspace,
    setValue,
  };

  return (
    <div className="flex flex-col gap-2">
      <Label
        htmlFor={field.id}
        className={cn(
          'text-xs font-semibold uppercase tracking-wider',
          isWorkspace ? 'text-muted-foreground' : 'text-slate-700 dark:text-slate-355'
        )}
      >
        {field.name.replace(/_/g, ' ')}
      </Label>

      {field.type === 'text' && <FieldText {...controlProps} />}
      {field.type === 'longText' && <FieldLongText {...controlProps} />}
      {field.type === 'number' && <FieldNumber {...controlProps} />}
      {field.type === 'singleSelect' && <FieldSingleSelect {...controlProps} />}
      {field.type === 'multiSelect' && <FieldMultiSelect {...controlProps} />}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DynamicFields({
  templateFields,
  formValues,
  setValue,
  className,
  variant = 'workspace',
}: DynamicFieldsProps) {
  if (templateFields.length === 0) {
    if (variant === 'use') {
      return (
        <div className="flex items-center gap-2 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 text-sm">
          <Info className="size-4 shrink-0" />
          <span>This template does not contain any editable variables.</span>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0" />
        <span>This template has no variables defined.</span>
      </div>
    );
  }

  const isWorkspace = variant === 'workspace';

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {templateFields.map((field) => (
        <FieldItem
          key={field.id}
          field={field}
          formValues={formValues}
          isWorkspace={isWorkspace}
          setValue={setValue}
        />
      ))}
    </div>
  );
}
