'use client';

import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { useQuery } from 'convex/react';
import { Copy, Check, Link as LinkIcon } from '@phosphor-icons/react';
import { api } from '@/convex/_generated/api';
import { interpolateVariables, flattenFormValues } from '@/lib/variables';
import type { TemplateField } from '@/lib/schemas/prompt.schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PromptPreview } from '@/components/prompts/PromptPreview';
import { OpenInAIButton } from '@/components/prompts/OpenInAIButton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DynamicFields } from '@/components/prompts/use/DynamicFields';
import { PromptNotFound } from '@/components/prompts/PromptNotFound';

interface PublicPromptClientProps {
	slug: string;
}

export function PublicPromptClient({ slug }: PublicPromptClientProps) {
	const prompt = useQuery(api.public.prompts.getBySlug, { slug });
	const templateFields = (prompt?.templateFields ?? []) as TemplateField[];

	const [copied, setCopied] = React.useState(false);
	const [copiedLink, setCopiedLink] = React.useState(false);

	const { control, setValue } = useForm<Record<string, string | string[] | number | undefined>>({
		defaultValues: {},
	});
	const formValues = useWatch({ control });

	const flatValues = React.useMemo(() => flattenFormValues(formValues), [formValues]);

	const interpolated = React.useMemo(() => {
		if (!prompt) return '';
		return interpolateVariables(prompt.content, flatValues);
	}, [prompt, flatValues]);

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

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(`${window.location.origin}/p/${prompt?.publicSlug}`);
			setCopiedLink(true);
			toast.success('Link copied to clipboard');
			setTimeout(() => setCopiedLink(false), 2000);
		} catch {
			toast.error('Failed to copy link.');
		}
	};

	if (prompt === undefined) {
		return (
			<div className="flex flex-col gap-6 max-w-6xl mx-auto p-1 animate-pulse">
				<div className="flex items-center gap-3">
					<div className="size-10 bg-slate-200 dark:bg-slate-800 rounded-full"></div>
					<div>
						<div className="h-6 w-64 bg-slate-200 dark:bg-slate-800 rounded mb-1"></div>
						<div className="h-4 w-40 bg-slate-100 dark:bg-slate-800/50 rounded"></div>
					</div>
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
					<div className="lg:col-span-5">
						<Card className="h-96 p-6">
							<div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
							<div className="space-y-4">
								<div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
								<div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
							</div>
						</Card>
					</div>
					<div className="lg:col-span-7">
						<Card className="h-96 p-6">
							<div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
							<div className="h-48 w-full bg-slate-150 dark:bg-slate-850 rounded"></div>
						</Card>
					</div>
				</div>
			</div>
		);
	}

	if (prompt === null) {
		return (
			<PromptNotFound message="This prompt doesn't exist or is no longer public." />
		);
	}

	return (
		<div className="flex flex-col gap-6 max-w-6xl mx-auto p-1 animate-in fade-in duration-300">
			{/* Header: title + author + copy link */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-center gap-3">
					{prompt.author.avatarUrl ? (
						/* eslint-disable-next-line @next/next/no-img-element */
						<img
							src={prompt.author.avatarUrl}
							alt={prompt.author.name}
							className="size-10 rounded-full border border-slate-200 dark:border-slate-800 object-cover"
						/>
					) : (
						<div className="flex size-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800">
							<span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
								{prompt.author.name.charAt(0).toUpperCase()}
							</span>
						</div>
					)}
					<div>
						<h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
							{prompt.title}
						</h1>
						<p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
							by {prompt.author.name}
							{prompt.category ? ` · ${prompt.category}` : ''}
						</p>
					</div>
				</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleCopyLink}
					className="gap-2 rounded-xl h-8 border-slate-200 dark:border-slate-800 shadow-sm shrink-0"
				>
					{copiedLink ? <Check className="size-4 text-emerald-500" /> : <LinkIcon className="size-4" />}
					<span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
				</Button>
			</div>

			{/* Tags */}
			{prompt.tags.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{prompt.tags.map((tag) => (
						<span
							key={tag}
							className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 rounded-full px-2.5 py-0.5 text-xs"
						>
							{tag}
						</span>
					))}
				</div>
			)}

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
				{/* Left Column: Form Controls */}
				{prompt.templateMode && (
					<div className="lg:col-span-5 flex flex-col gap-6">
						<Card className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
							<CardHeader className="pb-4">
								<CardTitle className="text-lg">Template Fields</CardTitle>
								<CardDescription>Fill in the variables defined in this prompt.</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-5">
								<DynamicFields
									templateFields={templateFields}
									formValues={formValues}
									setValue={setValue}
									variant="use"
								/>
							</CardContent>
						</Card>
					</div>
				)}

				{/* Right Column: Live Preview & Result */}
				<div className={prompt.templateMode ? 'lg:col-span-7 flex flex-col gap-6' : 'lg:col-span-12 flex flex-col gap-6'}>
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
									<PromptPreview content={prompt.content} fields={templateFields} values={flatValues} />
								</div>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
