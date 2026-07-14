import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { promptSchema, type PromptFormValues } from '@/lib/schemas/prompt.schema';

const DEFAULT_PROMPT_FORM_VALUES: PromptFormValues = {
  title: '',
  content: '',
  templateMode: false,
  isPublic: false,
  category: undefined,
  tags: [],
  templateFields: [],
};

export function usePromptForm(defaultValues = DEFAULT_PROMPT_FORM_VALUES) {
  return useForm<PromptFormValues>({
    resolver: zodResolver(promptSchema),
    defaultValues,
  });
}
