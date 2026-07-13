'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';
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
import { TagInput } from '@/components/ui/tag-input';
import { CategorySelector } from '@/components/prompts/CategorySelector';
import { TemplateFieldsPanel } from '../../create/_components/TemplateFieldsPanel';
import { CreateTemplateFieldDialog } from '../../create/_components/CreateTemplateFieldDialog';

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

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditPromptPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = React.use(params);

  const prompt = useAppStore((state) => state.prompts.find((p) => p.id === id));
  const editPrompt = useAppStore((state) => state.editPrompt);

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
      category: undefined,
      tags: [],
      templateFields: [],
    },
  });

  const watchedTitle = useWatch({ control, name: 'title', defaultValue: '' });
  const watchedContent = useWatch({ control, name: 'content', defaultValue: '' });
  const watchedTemplateMode = useWatch({ control, name: 'templateMode', defaultValue: false });
  const watchedTemplateFields = useWatch({ control, name: 'templateFields', defaultValue: [] });
  const watchedIsPublic = useWatch({ control, name: 'isPublic', defaultValue: false });

  const isResettingRef = React.useRef(true);
  const prevIsPublicRef = React.useRef<boolean>(watchedIsPublic);

  React.useEffect(() => {
    if (prompt) {
      reset({
        title: prompt.title,
        content: prompt.content,
        templateMode: prompt.templateMode,
        isPublic: prompt.isPublic,
        category: prompt.category ?? (prompt.isPublic ? 'other' : undefined),
        tags: prompt.tags ?? [],
        templateFields: prompt.templateFields ?? [],
      });
      isResettingRef.current = true;
    }
  }, [prompt, reset]);

  React.useEffect(() => {
    if (isResettingRef.current) {
      prevIsPublicRef.current = watchedIsPublic;
      isResettingRef.current = false;
      return;
    }

    const prevIsPublic = prevIsPublicRef.current;
    if (prevIsPublic !== watchedIsPublic) {
      if (watchedIsPublic) {
        setValue('category', 'other');
      } else {
        setValue('category', undefined);
      }
      prevIsPublicRef.current = watchedIsPublic;
    }
  }, [watchedIsPublic, setValue]);

  const [selection, setSelection] = React.useState<Selection | null>(null);
  const [createFieldDialogOpen, setCreateFieldDialogOpen] = React.useState(false);

  async function onSubmit(data: PromptFormValues) {
    try {
      editPrompt(id, data);
      toast.success('Prompt updated!', { description: 'Your changes have been saved.' });
      router.push('/dashboard/prompts');
    } catch (error) {
      toast.error('Failed to update prompt', {
        description: error instanceof Error ? error.message : 'An unknown error occurred.',
      });
    }
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

  if (!prompt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <h2 className="text-xl font-semibold mb-2">Prompt Not Found</h2>
        <p className="text-muted-foreground mb-4">The prompt you are trying to edit does not exist.</p>
        <Button asChild>
          <Link href="/dashboard/prompts">
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  const showConvertButton = watchedTemplateMode;

  const showTemplatePanel =
    watchedTemplateMode && watchedTemplateFields.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button asChild variant="outline" size="icon" className="rounded-xl size-9">
          <Link href="/dashboard/prompts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Edit Prompt
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-card-foreground">Modify Prompt Details</CardTitle>
          <CardDescription>Update the details and fields of your saved prompt.</CardDescription>
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

              {/* Template Fields Panel */}
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

              {/* Category selection */}
              {watchedIsPublic && (
                <Field orientation="vertical">
                  <FieldLabel className="text-foreground">Category</FieldLabel>
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <CategorySelector
                        value={field.value}
                        onChange={field.onChange}
                        error={errors.category?.message}
                      />
                    )}
                  />
                </Field>
              )}

              {/* Tags */}
              <Field orientation="vertical">
                <FieldLabel className="text-foreground">Tags</FieldLabel>
                <Controller
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <TagInput
                      value={field.value ?? []}
                      onChange={field.onChange}
                      error={errors.tags?.message}
                    />
                  )}
                />
                <FieldError errors={[errors.tags as { message?: string } | undefined]} />
              </Field>
            </FieldGroup>

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="ghost" onClick={() => reset()}>
                Reset
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Save Changes
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
