import { Effect } from 'effect';
import { ValidationError } from './errors';

const allowedCategories = ['coding', 'writing', 'marketing', 'analysis', 'design', 'education', 'other'] as const;
const allowedFieldTypes = ['text', 'longText', 'number', 'singleSelect', 'multiSelect'] as const;
const MAX_TEMPLATE_FIELDS = 50;
const MAX_OPTIONS_PER_FIELD = 100;

type TemplateField = {
	id: string;
	name: string;
	type: string;
	options?: string[];
};

export interface PromptInput {
	title: string;
	content: string;
	templateMode: boolean;
	isPublic: boolean;
	tags: string[];
	templateFields: TemplateField[];
	category?: string;
}

function error(message: string, field: string) {
	return new ValidationError({ message, field });
}

function fail(message: string, field: string) {
	return Effect.fail(error(message, field));
}

function validateTitle(input: PromptInput): Effect.Effect<void, ValidationError> {
	if (!input.title.trim()) return fail('Title is required', 'title');
	if (input.title.length > 300) return fail('Title must be 300 characters or less', 'title');
	return Effect.void;
}

function validateContent(input: PromptInput): Effect.Effect<void, ValidationError> {
	if (!input.content.trim()) return fail('Content is required', 'content');
	if (input.content.length > 10000) return fail('Content must be 10,000 characters or less', 'content');
	return Effect.void;
}

function findDuplicate(values: string[]) {
	const seen = new Set<string>();
	for (const value of values) {
		const normalized = value.trim().toLocaleLowerCase();
		if (seen.has(normalized)) return true;
		seen.add(normalized);
	}
	return false;
}

function validateTags(input: PromptInput): Effect.Effect<void, ValidationError> {
	if (input.tags.length > 20) return fail('Maximum 20 tags allowed', 'tags');
	if (input.tags.some((tag) => !tag.trim())) return fail('Tag cannot be empty', 'tags');
	if (input.tags.some((tag) => tag.length > 30)) return fail('Tag must be 30 characters or less', 'tags');
	if (findDuplicate(input.tags)) return fail('Duplicate tags are not allowed', 'tags');
	return Effect.void;
}

function validateFieldIdentity(
	field: TemplateField,
	index: number,
	seenIds: Set<string>,
	seenNames: Set<string>
): ValidationError | null {
	const idPath = `templateFields[${index}].id`;
	const namePath = `templateFields[${index}].name`;
	const id = field.id.trim();
	const name = field.name.trim();
	const normalizedName = name.toLocaleLowerCase();
	if (!id) return error('Field ID cannot be empty', idPath);
	if (id.length > 100) return error('Field ID must be 100 characters or less', idPath);
	if (seenIds.has(id)) return error('Field IDs must be unique', idPath);
	if (!name) return error('Field name cannot be empty', namePath);
	if (field.name.length > 50) return error('Field name must be 50 characters or less', namePath);
	if (seenNames.has(normalizedName)) return error('Field names must be unique', namePath);
	seenIds.add(id);
	seenNames.add(normalizedName);
	return null;
}

function validateOptions(field: TemplateField, index: number): ValidationError | null {
	const path = `templateFields[${index}].options`;
	const isSelect = field.type === 'singleSelect' || field.type === 'multiSelect';
	if (!isSelect && field.options !== undefined) return error('Options are only allowed for select fields', path);
	if (!field.options) return null;
	if (field.options.length > MAX_OPTIONS_PER_FIELD) {
		return error(`Maximum ${MAX_OPTIONS_PER_FIELD} options allowed`, path);
	}
	const emptyIndex = field.options.findIndex((option) => !option.trim());
	if (emptyIndex >= 0) return error('Option cannot be empty', `${path}[${emptyIndex}]`);
	const longIndex = field.options.findIndex((option) => option.length > 100);
	if (longIndex >= 0) return error('Option must be 100 characters or less', `${path}[${longIndex}]`);
	if (findDuplicate(field.options)) return error('Options must be unique', path);
	return null;
}

function validateField(
	field: TemplateField,
	index: number,
	seenIds: Set<string>,
	seenNames: Set<string>
) {
	const identityError = validateFieldIdentity(field, index, seenIds, seenNames);
	if (identityError) return identityError;
	if (!(allowedFieldTypes as readonly string[]).includes(field.type)) {
		return error(`Field type must be one of: ${allowedFieldTypes.join(', ')}`, `templateFields[${index}].type`);
	}
	return validateOptions(field, index);
}

function validateTemplateFields(input: PromptInput): Effect.Effect<void, ValidationError> {
	if (input.templateFields.length > MAX_TEMPLATE_FIELDS) {
		return fail(`Maximum ${MAX_TEMPLATE_FIELDS} template fields allowed`, 'templateFields');
	}
	const seenIds = new Set<string>();
	const seenNames = new Set<string>();
	for (let index = 0; index < input.templateFields.length; index++) {
		const fieldError = validateField(input.templateFields[index], index, seenIds, seenNames);
		if (fieldError) return Effect.fail(fieldError);
	}
	return Effect.void;
}

function validateCategory(input: PromptInput): Effect.Effect<void, ValidationError> {
	if (!input.isPublic) return Effect.void;
	if (!input.category) return fail('Category is required for public prompts', 'category');
	if (!(allowedCategories as readonly string[]).includes(input.category)) {
		return fail(`Category must be one of: ${allowedCategories.join(', ')}`, 'category');
	}
	return Effect.void;
}

export function validatePrompt(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		yield* validateTitle(input);
		yield* validateContent(input);
		yield* validateTags(input);
		yield* validateTemplateFields(input);
		yield* validateCategory(input);
	});
}
