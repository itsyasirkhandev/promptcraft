'use client';

import { CopyButton } from '@/components/prompts/CopyButton';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface ShareUrlFieldProps {
	slug: string;
}

export function ShareUrlField({ slug }: ShareUrlFieldProps) {
	const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${slug}`;

	return (
		<Field orientation="vertical">
			<FieldLabel className="text-foreground">Public Link</FieldLabel>
			<div className="flex items-center gap-2">
				<Input
					readOnly
					value={url}
					className="font-mono text-sm"
					onClick={(e) => e.currentTarget.select()}
				/>
				<CopyButton
					value={url}
					successMessage="Link copied to clipboard"
					errorMessage="Failed to copy link."
					className="shrink-0"
				/>
			</div>
		</Field>
	);
}