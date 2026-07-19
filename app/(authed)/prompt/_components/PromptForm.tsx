'use client';

import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type {
  Control,
  UseFormRegister,
  FieldErrors,
  UseFormReturn,
} from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FieldGroup,
  Field,
  FieldLabel,
  FieldTitle,
  FieldDescription,
  FieldError,
  FieldContent,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { TagInput } from '@/components/ui/tag-input';
import { CategorySelector } from '@/components/prompts/CategorySelector';
import { TemplateFieldsPanel } from '../create/_components/TemplateFieldsPanel';
import { CreateTemplateFieldDialog } from '../create/_components/CreateTemplateFieldDialog';
import { ShareUrlField } from './ShareUrlField';
import { useAutoSetCategory } from './useAutoSetCategory';
import type { PromptFormValues, TemplateFieldType } from '@/lib/schemas/prompt.schema';

function charCountClass(current: number, max: number): string {
  if (current >= max) return 'text-xs text-destructive text-right';
  if (current >= max * 0.9) return 'text-xs text-amber-500 dark:text-amber-400 text-right';
  return 'text-xs text-muted-foreground text-right';
}

interface Selection {
  start: number;
  end: number;
  text: string;
}

interface PromptFormProps {
  form: UseFormReturn<PromptFormValues>;
  onSubmit: (data: PromptFormValues) => Promise<void>;
  submitLabel: string;
  resetLabel: string;
  /** When true, auto-sets category to 'other' on isPublic toggle (create mode).
   *  When false, uses the guard-ref approach for edit mode. */
  autoSetCategory?: boolean;
  /** Existing public slug — when set and isPublic is on, shows a read-only share URL. */
  publicSlug?: string;
}

function TitleField({
  register,
  errors,
  watchedTitle,
}: {
  register: UseFormRegister<PromptFormValues>;
  errors: FieldErrors<PromptFormValues>;
  watchedTitle: string;
}) {
  return (
    <Field orientation="vertical">
      <FieldLabel htmlFor="title" className="text-foreground">Title</FieldLabel>
      <Input id="title" {...register('title')} placeholder="Enter a title..." aria-invalid={!!errors.title} />
      <p className={charCountClass(watchedTitle.length, 300)}>{watchedTitle.length}/300</p>
      <FieldError errors={[errors.title]} />
    </Field>
  );
}

function ContentField({
  register,
  errors,
  watchedContent,
  showConvertButton,
  selection,
  onSelectionChange,
  onConvertClick,
}: {
  register: UseFormRegister<PromptFormValues>;
  errors: FieldErrors<PromptFormValues>;
  watchedContent: string;
  showConvertButton: boolean;
  selection: Selection | null;
  onSelectionChange: (textarea: HTMLTextAreaElement) => void;
  onConvertClick: () => void;
}) {
  const trimmed = selection ? selection.text.trim() : '';
  return (
    <Field orientation="vertical">
      <FieldLabel htmlFor="content" className="text-foreground">Content</FieldLabel>
      <Textarea
        id="content"
        {...register('content')}
        placeholder="Write your prompt..."
        className="min-h-48"
        aria-invalid={!!errors.content}
        onPointerUp={(e) => onSelectionChange(e.currentTarget)}
        onKeyUp={(e) => onSelectionChange(e.currentTarget)}
      />
      <p className={charCountClass(watchedContent.length, 10000)}>{watchedContent.length}/10,000</p>
      {showConvertButton && (
        <Button type="button" variant="outline" size="sm" onClick={onConvertClick} className="self-start text-xs">
          {trimmed
            ? `Convert "${trimmed.slice(0, 15)}${trimmed.length > 15 ? '...' : ''}" to Dynamic`
            : 'Add Dynamic Field'}
        </Button>
      )}
      <FieldError errors={[errors.content]} />
    </Field>
  );
}

function ToggleField({
  control,
  name,
  title,
  description,
}: {
  control: Control<PromptFormValues>;
  name: 'templateMode' | 'isPublic';
  title: string;
  description: string;
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldTitle className="text-foreground">{title}</FieldTitle>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Controller control={control} name={name} render={({ field }) => (
        <Switch checked={field.value} onCheckedChange={field.onChange} />
      )} />
    </Field>
  );
}

function PromptForm({
  form,
  onSubmit,
  submitLabel,
  resetLabel,
  autoSetCategory = true,
  publicSlug,
}: PromptFormProps) {
  const { control, register, setValue, handleSubmit, reset, formState: { errors, isSubmitting } } = form;
  const watchedTitle = useWatch({ control, name: 'title', defaultValue: '' });
  const watchedContent = useWatch({ control, name: 'content', defaultValue: '' });
  const watchedTemplateMode = useWatch({ control, name: 'templateMode', defaultValue: false });
  const watchedTemplateFields = useWatch({ control, name: 'templateFields', defaultValue: [] });
  const watchedIsPublic = useWatch({ control, name: 'isPublic', defaultValue: false });

  const [selection, setSelection] = useState<Selection | null>(null);
  const [createFieldDialogOpen, setCreateFieldDialogOpen] = useState(false);

  useAutoSetCategory(watchedIsPublic, setValue, autoSetCategory);

  function updateSelection(textarea: HTMLTextAreaElement) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setSelection({ start, end, text: textarea.value.slice(start, end) });
  }

  function handleSaveNewField(fieldConfig: { name: string; type: TemplateFieldType; options?: string[] }) {
    const start = selection ? selection.start : watchedContent.length;
    const end = selection ? selection.end : watchedContent.length;
    const newContent = `${watchedContent.slice(0, start)}{{${fieldConfig.name}}}${watchedContent.slice(end)}`;
    setValue('content', newContent, { shouldValidate: true });
    setValue(
      'templateFields',
      [...watchedTemplateFields, { id: crypto.randomUUID(), name: fieldConfig.name, type: fieldConfig.type, options: fieldConfig.options }],
      { shouldValidate: true }
    );
    setSelection(null);
    setCreateFieldDialogOpen(false);
  }

  const showConvertButton = watchedTemplateMode;
  const showTemplatePanel = watchedTemplateMode && watchedTemplateFields.length > 0;

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FieldGroup>
          <TitleField register={register} errors={errors} watchedTitle={watchedTitle} />
          <ContentField
            register={register}
            errors={errors}
            watchedContent={watchedContent}
            showConvertButton={showConvertButton}
            selection={selection}
            onSelectionChange={updateSelection}
            onConvertClick={() => setCreateFieldDialogOpen(true)}
          />

          {showTemplatePanel && (
            <TemplateFieldsPanel control={control} setValue={setValue} contentValue={watchedContent} />
          )}

          <ToggleField
            control={control}
            name="templateMode"
            title="Template Mode"
            description="This prompt can be reused as a template"
          />

          <ToggleField
            control={control}
            name="isPublic"
            title="Public Prompt"
            description="Make this prompt visible to others"
          />

          {watchedIsPublic && (
            <Field orientation="vertical">
              <FieldLabel className="text-foreground">Category</FieldLabel>
              <Controller control={control} name="category" render={({ field }) => (
                <CategorySelector value={field.value} onChange={field.onChange} error={errors.category?.message} />
              )} />
            </Field>
          )}

          {watchedIsPublic && publicSlug && <ShareUrlField slug={publicSlug} />}

          <Field orientation="vertical">
            <FieldLabel className="text-foreground">Tags</FieldLabel>
            <Controller control={control} name="tags" render={({ field }) => (
              <TagInput value={field.value ?? []} onChange={field.onChange} error={errors.tags?.message} />
            )} />
            <FieldError errors={[errors.tags as { message?: string } | undefined]} />
          </Field>
        </FieldGroup>

        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="ghost" onClick={() => reset()}>{resetLabel}</Button>
          <Button type="submit" disabled={isSubmitting}>{submitLabel}</Button>
        </div>
      </form>

      {createFieldDialogOpen && (
        <CreateTemplateFieldDialog
          open={createFieldDialogOpen}
          onOpenChange={setCreateFieldDialogOpen}
          initialName={selection ? selection.text : ''}
          existingFields={watchedTemplateFields}
          onSave={handleSaveNewField}
        />
      )}
    </>
  );
}

interface PromptFormCardProps {
  form: UseFormReturn<PromptFormValues>;
  title: string;
  description: string;
  onSubmit: (data: PromptFormValues) => Promise<void>;
  submitLabel: string;
  resetLabel: string;
  autoSetCategory?: boolean;
  publicSlug?: string;
}

export function PromptFormCard({
  form,
  title,
  description,
  onSubmit,
  submitLabel,
  resetLabel,
  autoSetCategory,
  publicSlug,
}: PromptFormCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-card-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <PromptForm
          form={form}
          onSubmit={onSubmit}
          submitLabel={submitLabel}
          resetLabel={resetLabel}
          autoSetCategory={autoSetCategory}
          publicSlug={publicSlug}
        />
      </CardContent>
    </Card>
  );
}