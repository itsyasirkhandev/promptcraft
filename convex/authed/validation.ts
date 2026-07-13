import { Effect } from 'effect';
import { ValidationError } from './errors';

const allowedCategories = [
	'coding',
	'writing',
	'marketing',
	'analysis',
	'design',
	'education',
	'other'
] as const;

const allowedFieldTypes = [
	'text',
	'longText',
	'number',
	'singleSelect',
	'multiSelect'
] as const;

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

function validateTitle(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (input.title.trim().length < 1) {
			return yield* Effect.fail(new ValidationError({ message: 'Title is required', field: 'title' }));
		}
		if (input.title.length > 300) {
			return yield* Effect.fail(
				new ValidationError({ message: 'Title must be 300 characters or less', field: 'title' })
			);
		}
	});
}

function validateContent(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (input.content.trim().length < 1) {
			return yield* Effect.fail(new ValidationError({ message: 'Content is required', field: 'content' }));
		}
		if (input.content.length > 10000) {
			return yield* Effect.fail(
				new ValidationError({ message: 'Content must be 10,000 characters or less', field: 'content' })
			);
		}
	});
}

function validateTags(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (input.tags.length > 20) {
			return yield* Effect.fail(new ValidationError({ message: 'Maximum 20 tags allowed', field: 'tags' }));
		}
		const seenTags = new Set<string>();
		for (const tag of input.tags) {
			if (tag.trim().length < 1) {
				return yield* Effect.fail(new ValidationError({ message: 'Tag cannot be empty', field: 'tags' }));
			}
			if (tag.length > 30) {
				return yield* Effect.fail(
					new ValidationError({ message: 'Tag must be 30 characters or less', field: 'tags' })
				);
			}
			if (seenTags.has(tag)) {
				return yield* Effect.fail(new ValidationError({ message: 'Duplicate tags are not allowed', field: 'tags' }));
			}
			seenTags.add(tag);
		}
	});
}

function validateTemplateFields(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		for (let i = 0; i < input.templateFields.length; i++) {
			const field = input.templateFields[i];
			if (field.name.trim().length < 1) {
				return yield* Effect.fail(
					new ValidationError({ message: 'Field name cannot be empty', field: `templateFields[${i}].name` })
				);
			}
			if (field.name.length > 50) {
				return yield* Effect.fail(
					new ValidationError({ message: 'Field name must be 50 characters or less', field: `templateFields[${i}].name` })
				);
			}
			if (!(allowedFieldTypes as readonly string[]).includes(field.type)) {
				return yield* Effect.fail(
					new ValidationError({
						message: `Field type must be one of: ${allowedFieldTypes.join(', ')}`,
						field: `templateFields[${i}].type`
					})
				);
			}
			if (field.options) {
				for (let j = 0; j < field.options.length; j++) {
					const opt = field.options[j];
					if (opt.trim().length < 1) {
						return yield* Effect.fail(
							new ValidationError({ message: 'Option cannot be empty', field: `templateFields[${i}].options[${j}]` })
						);
					}
					if (opt.length > 100) {
						return yield* Effect.fail(
							new ValidationError({
								message: 'Option must be 100 characters or less',
								field: `templateFields[${i}].options[${j}]`
							})
						);
					}
				}
			}
		}
	});
}

function validateCategory(input: PromptInput): Effect.Effect<void, ValidationError> {
	return Effect.gen(function* () {
		if (!input.isPublic) return;
		if (!input.category) {
			return yield* Effect.fail(
				new ValidationError({ message: 'Category is required for public prompts', field: 'category' })
			);
		}
		if (!(allowedCategories as readonly string[]).includes(input.category)) {
			return yield* Effect.fail(
				new ValidationError({
					message: `Category must be one of: ${allowedCategories.join(', ')}`,
					field: 'category'
				})
			);
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
