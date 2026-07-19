'use client';

import * as React from 'react';
import Image from 'next/image';
import { usePromptInterpolation } from '@/hooks/use-prompt-interpolation';
import { useQuery } from 'convex/react';
import { Check, Link as LinkIcon } from '@phosphor-icons/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/ui/button';
import { PromptNotFound } from '@/components/prompts/PromptNotFound';
import { PromptUseSkeleton } from '@/components/prompts/use/PromptUseSkeleton';
import { LivePreviewCard } from '@/components/prompts/use/LivePreviewCard';
import { TemplateFieldsCard } from '@/components/prompts/use/TemplateFieldsCard';
import { useClipboardCopy } from '@/lib/hooks/use-clipboard-copy';

interface PublicPromptClientProps {
	slug: string;
}

export function PublicPromptClient({ slug }: PublicPromptClientProps) {
	const prompt = useQuery(api.public.prompts.getBySlug, { slug });

	const { setValue, formValues, flatValues, interpolated } = usePromptInterpolation(prompt);

	const { copied: copiedLink, copy: copyLink } = useClipboardCopy();

	if (prompt === undefined) {
		return (
			<PromptUseSkeleton headerIconClassName="size-10 bg-slate-200 dark:bg-slate-800 rounded-full" titleWidth="w-64" subtitleWidth="w-40" />
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
						<Image
							src={prompt.author.avatarUrl}
							alt={prompt.author.name}
							width={40}
							height={40}
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
					onClick={() =>
						copyLink(`${window.location.origin}/p/${prompt.publicSlug}`, {
							successMessage: 'Link copied to clipboard',
							errorMessage: 'Failed to copy link.',
						})
					}
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
						<TemplateFieldsCard
							templateFields={prompt.templateFields}
							formValues={formValues}
							setValue={setValue}
							description="Fill in the variables defined in this prompt."
						/>
					</div>
				)}

				{/* Right Column: Live Preview & Result */}
				<div className={prompt.templateMode ? 'lg:col-span-7 flex flex-col gap-6' : 'lg:col-span-12 flex flex-col gap-6'}>
					<LivePreviewCard
						content={prompt.content}
						templateFields={prompt.templateFields}
						flatValues={flatValues}
						interpolated={interpolated}
					/>
				</div>
			</div>
		</div>
	);
}
