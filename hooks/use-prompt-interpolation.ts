import * as React from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { interpolateVariables, flattenFormValues } from '@/lib/variables';

interface PromptLike {
	content: string;
}

export function usePromptInterpolation(prompt: PromptLike | null | undefined) {
	const { control, setValue, reset } = useForm<
		Record<string, string | string[] | number | undefined>
	>({ defaultValues: {} });
	const formValues = useWatch({ control });

	const flatValues = React.useMemo(() => flattenFormValues(formValues), [formValues]);

	const interpolated = React.useMemo(() => {
		if (!prompt) return '';
		return interpolateVariables(prompt.content, flatValues);
	}, [prompt, flatValues]);

	return { control, setValue, reset, formValues, flatValues, interpolated };
}