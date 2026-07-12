import { z } from 'zod';

export const templateFieldSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
  type: z.enum(['text', 'longText', 'number', 'singleSelect', 'multiSelect']),
  options: z.array(z.string().min(1).max(100)).optional(),
});

export type TemplateField = z.infer<typeof templateFieldSchema>;
export type TemplateFieldType = TemplateField['type'];

export const promptSchema = z.object({
  title: z.string().min(1, 'Title is required').max(300, 'Title must be 300 characters or less'),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(10_000, 'Content must be 10,000 characters or less'),
  templateMode: z.boolean(),
  isPublic: z.boolean(),
  tags: z
    .array(
      z.string().min(1, 'Tag cannot be empty').max(30, 'Tag must be 30 characters or less')
    )
    .max(20, 'Maximum 20 tags allowed')
    .refine((tags) => new Set(tags).size === tags.length, {
      message: 'Duplicate tags are not allowed',
    }),
  templateFields: z.array(templateFieldSchema),
});

export type PromptFormValues = z.infer<typeof promptSchema>;
