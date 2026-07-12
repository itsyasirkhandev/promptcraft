import type { TemplateField } from '@/lib/schemas/prompt.schema';

export const VARIABLE_REGEX = /{{([^{}]{1,64})}}/g;

export type TemplateToken =
  | { kind: 'text'; content: string }
  | { kind: 'variable'; name: string; field?: TemplateField };

/**
 * Splits a template string into an array of text and variable tokens.
 */
export function tokenizeTemplate(
  content: string,
  fields: TemplateField[]
): TemplateToken[] {
  if (!content) return [];

  // Split on {{name}} patterns, keeping the delimiters in the result
  const parts = content.split(/({{[^{}]{1,64}}})/g);

  return parts
    .filter((part) => part !== '')
    .map((part): TemplateToken => {
      const match = /^{{([^{}]{1,64})}}$/.exec(part);
      if (match) {
        const name = match[1];
        const field = fields.find((f) => f.name === name);
        return { kind: 'variable', name, field };
      }
      return { kind: 'text', content: part };
    });
}

/**
 * Interpolates variables in a template string with provided values.
 */
export function interpolateVariables(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(VARIABLE_REGEX, (match, name) => {
    const value = values[name];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
    return match;
  });
}
