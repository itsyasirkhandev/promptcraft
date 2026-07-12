'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Info } from '@phosphor-icons/react';
import { useAppStore } from '@/store';
import { interpolateVariables } from '@/lib/variables';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PromptPreview } from '@/components/prompts/PromptPreview';
import { OpenInAIButton } from '@/components/prompts/OpenInAIButton';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UsePromptPage({ params }: PageProps) {
  const { id } = React.use(params);

  const prompt = useAppStore((state) => state.prompts.find((p) => p.id === id));
  const templateFields = prompt?.templateFields ?? [];

  const [copied, setCopied] = React.useState(false);

  const { control, setValue } = useForm<Record<string, string | string[] | number | undefined>>({
    defaultValues: {},
  });
  const formValues = useWatch({ control });

  const interpolated = React.useMemo(() => {
    if (!prompt) return '';
    // Format variables: join arrays (from multiSelect checkboxes) as comma-separated strings
    const flatValues: Record<string, string> = {};
    Object.keys(formValues).forEach((key) => {
      const val = formValues[key];
      if (Array.isArray(val)) {
        flatValues[key] = val.filter(Boolean).join(', ');
      } else if (val !== undefined && val !== null) {
        flatValues[key] = String(val);
      }
    });
    return interpolateVariables(prompt.content, flatValues);
  }, [prompt, formValues]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(interpolated);
      setCopied(true);
      toast.success('Copied final prompt to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy text.');
    }
  };

  if (!prompt) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6">
        <h2 className="text-xl font-semibold mb-2">Prompt Not Found</h2>
        <p className="text-muted-foreground mb-4">The prompt you are trying to access does not exist.</p>
        <Button asChild>
          <Link href="/dashboard/prompts">
            <ArrowLeft className="mr-2 size-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto p-1 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="rounded-xl size-9">
            <Link href="/dashboard/prompts">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Use Prompt: {prompt.title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              Fill in the fields below to populate your dynamic template in real-time.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Controls */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Template Fields</CardTitle>
              <CardDescription>Fill in the variables defined in your prompt.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {templateFields.length === 0 ? (
                <div className="flex items-center gap-2 p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 text-slate-500 dark:text-slate-400 text-sm">
                  <Info className="size-4 shrink-0" />
                  <span>This template does not contain any editable variables.</span>
                </div>
              ) : (
                templateFields.map((field) => {
                  const currentValue = formValues[field.name];
                  const valueStr = (typeof currentValue === 'string' || typeof currentValue === 'number') ? String(currentValue) : '';

                  return (
                    <div key={field.id} className="flex flex-col gap-2">
                      <Label htmlFor={field.id} className="text-xs font-semibold text-slate-700 dark:text-slate-350">
                        {field.name.toUpperCase().replace(/_/g, ' ')}
                      </Label>

                      {field.type === 'text' && (
                        <Input
                          id={field.id}
                          type="text"
                          placeholder={`Enter value for ${field.name}...`}
                          value={valueStr}
                          onChange={(e) => setValue(field.name, e.target.value)}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-sm"
                        />
                      )}

                      {field.type === 'longText' && (
                        <Textarea
                          id={field.id}
                          placeholder={`Enter long text for ${field.name}...`}
                          value={valueStr}
                          onChange={(e) => setValue(field.name, e.target.value)}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-sm min-h-24 resize-y"
                        />
                      )}

                      {field.type === 'number' && (
                        <Input
                          id={field.id}
                          type="number"
                          placeholder="Enter number..."
                          value={valueStr}
                          onChange={(e) => setValue(field.name, e.target.value)}
                          className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-sm"
                        />
                      )}

                      {field.type === 'singleSelect' && (
                        <Select
                          value={valueStr}
                          onValueChange={(val) => setValue(field.name, val)}
                        >
                          <SelectTrigger className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-sm text-left">
                            <SelectValue placeholder="Select an option..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                            {field.options?.map((opt) => (
                              <SelectItem key={opt} value={opt} className="rounded-lg">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {field.type === 'multiSelect' && (
                        <div className="flex flex-col gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/30 dark:bg-slate-950/10">
                          {field.options && field.options.length > 0 ? (
                            field.options.map((opt) => {
                              const list = Array.isArray(currentValue) ? currentValue : [];
                              const isChecked = list.includes(opt);

                              return (
                                <div key={opt} className="flex items-center gap-2">
                                  <Checkbox
                                    id={`${field.id}-${opt}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      let newList;
                                      if (checked) {
                                        newList = [...list, opt];
                                      } else {
                                        newList = list.filter((v: string) => v !== opt);
                                      }
                                      setValue(field.name, newList);
                                    }}
                                  />
                                  <Label
                                    htmlFor={`${field.id}-${opt}`}
                                    className="text-sm font-normal text-slate-600 dark:text-slate-400 cursor-pointer select-none"
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
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Preview & Result */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-slate-100 dark:border-slate-850">
              <div>
                <CardTitle className="text-lg">Live Preview</CardTitle>
                <CardDescription>Visual rendering with filled fields highlighted.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <OpenInAIButton content={interpolated} />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                  className="gap-2 rounded-xl h-8 border-slate-200 dark:border-slate-800 shadow-sm"
                >
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[450px]">
                <div className="p-6 font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-350">
                  <PromptPreview content={interpolated} fields={templateFields} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
