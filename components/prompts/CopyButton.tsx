'use client';

import { Check, Copy } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useClipboardCopy } from '@/lib/hooks/use-clipboard-copy';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
	value: string;
	successMessage: string;
	errorMessage: string;
	className?: string;
	iconClassName?: string;
	label?: string;
	copiedLabel?: string;
}

export function CopyButton({
	value,
	successMessage,
	errorMessage,
	className,
	iconClassName = 'size-4',
	label = 'Copy',
	copiedLabel = 'Copied',
}: CopyButtonProps) {
	const { copied, copy } = useClipboardCopy();
	return (
		<Button
			type="button"
			size="sm"
			variant="outline"
			onClick={() => copy(value, { successMessage, errorMessage })}
			className={cn('gap-2', className)}
		>
			{copied ? (
				<Check aria-hidden="true" className={cn('text-emerald-500', iconClassName)} />
			) : (
				<Copy aria-hidden="true" className={iconClassName} />
			)}
			<span aria-live="polite">{copied ? copiedLabel : label}</span>
		</Button>
	);
}