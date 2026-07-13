'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { X } from '@phosphor-icons/react';
import { promptSchema, type PromptFormValues, type TemplateFieldType } from '@/lib/schemas/prompt.schema';
import { useAppStore } from '@/store';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TemplateFieldsPanel } from './_components/TemplateFieldsPanel';
import { CreateTemplateFieldDialog } from './_components/CreateTemplateFieldDialog';

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

export default function CreatePromptPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PromptFormValues>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      title: '',
      content: '',
      templateMode: false,
      isPublic: false,
      tags: [],
      templateFields: [],
    },
  });

  const addPrompt = useAppStore((s) => s.addPrompt);

  // useWatch is React Compiler-safe (unlike the watch() function returned by useForm)
  const watchedTitle = useWatch({ control, name: 'title', defaultValue: '' });
  const watchedContent = useWatch({ control, name: 'content', defaultValue: '' });
  const watchedTags = useWatch({ control, name: 'tags', defaultValue: [] });
  const watchedTemplateMode = useWatch({ control, name: 'templateMode', defaultValue: false });
  const watchedTemplateFields = useWatch({ control, name: 'templateFields', defaultValue: [] });

  const tagInputRef = useRef<HTMLInputElement>(null);

  // Selection state for "Convert to Dynamic" button
  const [selection, setSelection] = useState<Selection | null>(null);
  const [createFieldDialogOpen, setCreateFieldDialogOpen] = useState(false);

  async function onSubmit(data: PromptFormValues) {
    try {
      addPrompt(data);
      toast.success('Prompt created!', { description: 'Your prompt has been saved.' });
      router.push('/dashboard/prompts');
    } catch (error) {
      toast.error('Failed to create prompt', {
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const raw = tagInputRef.current?.value.trim() ?? '';
      if (!raw) return;
      if (raw.length > 30) return;
      if (watchedTags.includes(raw)) return;
      if (watchedTags.length >= 20) return;
      setValue('tags', [...watchedTags, raw], { shouldValidate: true });
      if (tagInputRef.current) tagInputRef.current.value = '';
    }
  }

  function removeTag(tag: string) {
    setValue('tags', watchedTags.filter((t) => t !== tag), { shouldValidate: true });
  }

  // ── Selection detection ────────────────────────────────────────────────────

  function updateSelection(textarea: HTMLTextAreaElement) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setSelection({
      start,
      end,
      text: textarea.value.slice(start, end),
    });
  }

  function handleContentPointerUp(e: React.PointerEvent<HTMLTextAreaElement>) {
    updateSelection(e.currentTarget);
  }

  function handleContentKeyUp(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    updateSelection(e.currentTarget);
  }

  // ── Convert to Dynamic ─────────────────────────────────────────────────────

  function handleSaveNewField(fieldConfig: {
    name: string;
    type: TemplateFieldType;
    options?: string[];
  }) {
    const start = selection ? selection.start : watchedContent.length;
    const end = selection ? selection.end : watchedContent.length;

    const before = watchedContent.slice(0, start);
    const after = watchedContent.slice(end);
    const newContent = `${before}{{${fieldConfig.name}}}${after}`;

    setValue('content', newContent, { shouldValidate: true });

    const newField = {
      id: crypto.randomUUID(),
      name: fieldConfig.name,
      type: fieldConfig.type,
      options: fieldConfig.options,
    };
    setValue('templateFields', [...watchedTemplateFields, newField], { shouldValidate: true });

    setSelection(null);
    setCreateFieldDialogOpen(false);
  }

  const showConvertButton = watchedTemplateMode;

  const showTemplatePanel =
    watchedTemplateMode && watchedTemplateFields.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground">Create Prompt</CardTitle>
          <CardDescription>Build and save a new prompt to your library.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <FieldGroup>
              {/* Title */}
              <Field orientation="vertical">
                <FieldLabel htmlFor="title" className="text-foreground">
                  Title
                </FieldLabel>
                <Input
                  id="title"
                  {...register('title')}
                  placeholder="Enter a title..."
                  aria-invalid={!!errors.title}
                />
                <p className={charCountClass(watchedTitle.length, 300)}>
                  {watchedTitle.length}/300
                </p>
                <FieldError errors={[errors.title]} />
              </Field>

              {/* Content */}
              <Field orientation="vertical">
                <FieldLabel htmlFor="content" className="text-foreground">
                  Content
                </FieldLabel>
                <Textarea
                  id="content"
                  {...register('content')}
                  placeholder="Write your prompt..."
                  className="min-h-48"
                  aria-invalid={!!errors.content}
                  onPointerUp={handleContentPointerUp}
                  onKeyUp={handleContentKeyUp}
                />
                <p className={charCountClass(watchedContent.length, 10000)}>
                  {watchedContent.length}/10,000
                </p>
                {showConvertButton && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateFieldDialogOpen(true)}
                    className="self-start text-xs"
                  >
                    {selection && selection.text.trim()
                      ? `Convert "${selection.text.trim().slice(0, 15)}${selection.text.trim().length > 15 ? '...' : ''}" to Dynamic`
                      : 'Add Dynamic Field'}
                  </Button>
                )}
                <FieldError errors={[errors.content]} />
              </Field>

              {/* Template Fields Panel — shown when templateMode=true and fields exist */}
              {showTemplatePanel && (
                <TemplateFieldsPanel
                  control={control}
                  setValue={setValue}
                  contentValue={watchedContent}
                />
              )}

              {/* Template Mode */}
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle className="text-foreground">Template Mode</FieldTitle>
                  <FieldDescription>This prompt can be reused as a template</FieldDescription>
                </FieldContent>
                <Controller
                  control={control}
                  name="templateMode"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </Field>

              {/* Public Prompt */}
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle className="text-foreground">Public Prompt</FieldTitle>
                  <FieldDescription>Make this prompt visible to others</FieldDescription>
                </FieldContent>
                <Controller
                  control={control}
                  name="isPublic"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </Field>

              {/* Tags */}
              <Field orientation="vertical">
                <FieldLabel className="text-foreground">Tags</FieldLabel>
                <Input
                  ref={tagInputRef}
                  placeholder="Type a tag and press Enter or comma..."
                  onKeyDown={handleTagKeyDown}
                />
                {watchedTags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1 p-2 rounded-md bg-muted/40 dark:bg-muted/20 border border-border">
                    {watchedTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        <span className="text-secondary-foreground">{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="ml-0.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X size={10} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <FieldError errors={[errors.tags as { message?: string } | undefined]} />
              </Field>
            </FieldGroup>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="ghost" onClick={() => reset()}>
                Clear
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Create Prompt
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {createFieldDialogOpen && (
        <CreateTemplateFieldDialog
          open={createFieldDialogOpen}
          onOpenChange={setCreateFieldDialogOpen}
          initialName={selection ? selection.text : ''}
          existingFields={watchedTemplateFields}
          onSave={handleSaveNewField}
        />
      )}
    </div>
  );
}
