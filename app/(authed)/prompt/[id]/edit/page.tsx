'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { X, ArrowLeft } from '@phosphor-icons/react';
import Link from 'next/link';
import { promptSchema, type PromptFormValues } from '@/lib/schemas/prompt.schema';
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
import { TemplateFieldsPanel } from '../../create/_components/TemplateFieldsPanel';

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
      tags: [],
      templateFields: [],
    },
  });

  React.useEffect(() => {
    if (prompt) {
      reset({
        title: prompt.title,
        content: prompt.content,
        templateMode: prompt.templateMode,
        isPublic: prompt.isPublic,
        tags: prompt.tags ?? [],
        templateFields: prompt.templateFields ?? [],
      });
    }
  }, [prompt, reset]);

  const watchedTitle = useWatch({ control, name: 'title', defaultValue: '' });
  const watchedContent = useWatch({ control, name: 'content', defaultValue: '' });
  const watchedTags = useWatch({ control, name: 'tags', defaultValue: [] });
  const watchedTemplateMode = useWatch({ control, name: 'templateMode', defaultValue: false });
  const watchedTemplateFields = useWatch({ control, name: 'templateFields', defaultValue: [] });

  const tagInputRef = React.useRef<HTMLInputElement>(null);
  const [selection, setSelection] = React.useState<Selection | null>(null);

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

  function handleContentPointerUp(e: React.PointerEvent<HTMLTextAreaElement>) {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) {
      setSelection({ start, end, text: textarea.value.slice(start, end) });
    } else {
      setSelection(null);
    }
  }

  function handleConvertToDynamic() {
    if (!selection || !selection.text.trim()) return;

    const fieldName = selection.text.trim().toLowerCase().replace(/\s+/g, '_');
    const before = watchedContent.slice(0, selection.start);
    const after = watchedContent.slice(selection.end);
    const newContent = `${before}{{${fieldName}}}${after}`;

    setValue('content', newContent, { shouldValidate: true });

    const alreadyExists = watchedTemplateFields.some((f) => f.name === fieldName);
    if (!alreadyExists) {
      const newField = {
        id: crypto.randomUUID(),
        name: fieldName,
        type: 'text' as const,
        options: undefined,
      };
      setValue('templateFields', [...watchedTemplateFields, newField], { shouldValidate: true });
    }

    setSelection(null);
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

  const showConvertButton =
    watchedTemplateMode && selection !== null && selection.text.trim() !== '';

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
                />
                <p className={charCountClass(watchedContent.length, 10000)}>
                  {watchedContent.length}/10,000
                </p>
                {showConvertButton && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConvertToDynamic}
                    className="self-start text-xs"
                  >
                    Convert &ldquo;{selection!.text}&rdquo; to Dynamic
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
                Reset
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
