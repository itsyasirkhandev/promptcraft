import { Effect } from 'effect';
import { ValidationError } from './errors';

const allowedCategories = ['coding', 'writing', 'marketing', 'analysis', 'design', 'education', 'other'] as const;
const allowedFieldTypes = ['text', 'longText', 'number', 'singleSelect', 'multiSelect'] as const;
const MAX_TEMPLATE_FIELDS = 50;
const MAX_OPTIONS_PER_FIELD = 100;

export interface PromptInput {
	title: string;
	content: string;
	templateMode: boolean;
	isPublic: boolean;
	tags: string[];
	templateFields: {
		id: string;
		name: string;
		type: string;
		options?: string[];
	}[];
	category?: string;
}

function validationError(message: string, field: string) {
	return Effect.fail(new ValidationError({ message, field }));
}

function validateTitle(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (input.title.trim().length < 1) return yield* validationError('Title is required', 'title');
		if (input.title.length > 300) return yield* validationError('Title must be 300 characters or less', 'title');
	});
}

function validateContent(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (input.content.trim().length < 1) return yield* validationError('Content is required', 'content');
		if (input.content.length > 10000) return yield* validationError('Content must be 10,000 characters or less', 'content');
	});
}

function validateTags(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (input.tags.length > 20) return yield* validationError('Maximum 20 tags allowed', 'tags');
		const seenTags = new Set<string>();
		for (const tag of input.tags) {
			const normalized = tag.trim().toLocaleLowerCase();
			if (!normalized) return yield* validationError('Tag cannot be empty', 'tags');
			if (tag.length > 30) return yield* validationError('Tag must be 30 characters or less', 'tags');
			if (seenTags.has(normalized)) return yield* validationError('Duplicate tags are not allowed', 'tags');
			seenTags.add(normalized);
		}
	});
}

function validateTemplateFields(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (input.templateFields.length > MAX_TEMPLATE_FIELDS) {
			return yield* validationError(`Maximum ${MAX_TEMPLATE_FIELDS} template fields allowed`, 'templateFields');
		}

		const seenIds = new Set<string>();
		const seenNames = new Set<string>();
		for (let i = 0; i < input.templateFields.length; i++) {
			const field = input.templateFields[i];
			const id = field.id.trim();
			const name = field.name.trim();
			const normalizedName = name.toLocaleLowerCase();
			if (!id) return yield* validationError('Field ID cannot be empty', `templateFields[${i}].id`);
			if (id.length > 100) return yield* validationError('Field ID must be 100 characters or less', `templateFields[${i}].id`);
			if (seenIds.has(id)) return yield* validationError('Field IDs must be unique', `templateFields[${i}].id`);
			seenIds.add(id);
			if (!name) return yield* validationError('Field name cannot be empty', `templateFields[${i}].name`);
			if (field.name.length > 50) return yield* validationError('Field name must be 50 characters or less', `templateFields[${i}].name`);
			if (seenNames.has(normalizedName)) return yield* validationError('Field names must be unique', `templateFields[${i}].name`);
			seenNames.add(normalizedName);
			if (!(allowedFieldTypes as readonly string[]).includes(field.type)) {
				return yield* validationError(`Field type must be one of: ${allowedFieldTypes.join(', ')}`, `templateFields[${i}].type`);
			}

			const isSelect = field.type === 'singleSelect' || field.type === 'multiSelect';
			if (!isSelect && field.options !== undefined) {
				return yield* validationError('Options are only allowed for select fields', `templateFields[${i}].options`);
			}
			if (field.options) {
				if (field.options.length > MAX_OPTIONS_PER_FIELD) {
					return yield* validationError(`Maximum ${MAX_OPTIONS_PER_FIELD} options allowed`, `templateFields[${i}].options`);
				}
				const seenOptions = new Set<string>();
				for (let j = 0; j < field.options.length; j++) {
					const option = field.options[j];
					const normalized = option.trim().toLocaleLowerCase();
					if (!normalized) return yield* validationError('Option cannot be empty', `templateFields[${i}].options[${j}]`);
					if (option.length > 100) return yield* validationError('Option must be 100 characters or less', `templateFields[${i}].options[${j}]`);
					if (seenOptions.has(normalized)) return yield* validationError('Options must be unique', `templateFields[${i}].options[${j}]`);
					seenOptions.add(normalized);
				}
			}
		}
	});
}

function validateCategory(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (!input.isPublic) return;
		if (!input.category) return yield* validationError('Category is required for public prompts', 'category');
		if (!(allowedCategories as readonly string[]).includes(input.category)) {
			return yield* validationError(`Category must be one of: ${allowedCategories.join(', ')}`, 'category');
		}
	});
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
