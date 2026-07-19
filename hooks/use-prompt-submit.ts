import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { PromptFormValues } from '@/lib/schemas/prompt.schema';
import { catchTag } from '@/lib/errors';

export function toPromptMutationArgs(data: PromptFormValues) {
	return {
		title: data.title,
		content: data.content,
		templateMode: data.templateMode,
		isPublic: data.isPublic,
		category: data.category || undefined,
		tags: data.tags,
		templateFields: data.templateFields,
	};
}

export function usePromptSubmit(opts: {
	success: { message: string; description: string };
	error: string;
}) {
	const router = useRouter();
	return async function submit(action: () => Promise<unknown>) {
		try {
			await action();
			toast.success(opts.success.message, { description: opts.success.description });
			router.push('/dashboard/prompts');
		} catch (err) {
			toast.error(opts.error, {
				description:
					catchTag(err, 'PlanLimitError', (d: { message: string }) => d.message) ??
					(err instanceof Error ? err.message : 'An unknown error occurred.'),
			});
		}
	};
}