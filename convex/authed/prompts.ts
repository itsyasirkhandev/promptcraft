import { v } from 'convex/values';
import { effectAuthedQuery, effectAuthedMutation, AuthedContext } from './helpers';
import { Effect, Schema } from 'effect';
import { ConvexDB } from '../services/ConvexDB';
import { GenericDatabaseWriter } from 'convex/server';
import { DataModel } from '../_generated/dataModel';
import { validatePrompt } from './validation';
import { UnauthorizedError } from './errors';

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", {
	message: Schema.String
}) {}

export class ForbiddenError extends Schema.TaggedErrorClass<ForbiddenError>()("ForbiddenError", {
	message: Schema.String
}) {}

const templateFieldsValidator = v.array(
	v.object({
		id: v.string(),
		name: v.string(),
		type: v.union(v.literal('text'), v.literal('longText'), v.literal('number'), v.literal('singleSelect'), v.literal('multiSelect')),
		options: v.optional(v.array(v.string()))
	})
);

export const create = effectAuthedMutation({
	args: {
		title: v.string(),
		content: v.string(),
		templateMode: v.boolean(),
		isPublic: v.boolean(),
		tags: v.array(v.string()),
		templateFields: templateFieldsValidator,
		category: v.optional(v.string())
	},
	handler: (args) =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			if (!viewer) {
				return yield* Effect.fail(new UnauthorizedError({ message: 'Not authenticated or user not registered' }));
			}

			// Validate the prompt structure and constraints
			yield* validatePrompt({
				title: args.title,
				content: args.content,
				templateMode: args.templateMode,
				isPublic: args.isPublic,
				tags: args.tags,
				templateFields: args.templateFields,
				category: args.category
			});

			const { db } = yield* ConvexDB;
			const writerDb = db as GenericDatabaseWriter<DataModel>;

			const promptId = yield* Effect.tryPromise(() =>
				writerDb.insert('prompts', {
					userId: viewer._id,
					title: args.title,
					content: args.content,
					templateMode: args.templateMode,
					isPublic: args.isPublic,
					tags: args.tags,
					templateFields: args.templateFields,
					category: args.category,
					createdAt: Date.now()
				})
			);

			const prompt = yield* Effect.tryPromise(() => writerDb.get(promptId));
			if (!prompt) {
				return yield* Effect.fail(new NotFoundError({ message: 'Failed to retrieve newly created prompt' }));
			}

			return prompt;
		})
});

export const update = effectAuthedMutation({
	args: {
		id: v.id('prompts'),
		title: v.string(),
		content: v.string(),
		templateMode: v.boolean(),
		isPublic: v.boolean(),
		tags: v.array(v.string()),
		templateFields: templateFieldsValidator,
		category: v.optional(v.string())
	},
	handler: (args) =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			if (!viewer) {
				return yield* Effect.fail(new UnauthorizedError({ message: 'Not authenticated' }));
			}

			const { db } = yield* ConvexDB;
			const writerDb = db as GenericDatabaseWriter<DataModel>;

			// Verify existance
			const prompt = yield* Effect.tryPromise(() => writerDb.get(args.id));
			if (!prompt) {
				return yield* Effect.fail(new NotFoundError({ message: 'Prompt not found' }));
			}

			// Verify ownership
			if (prompt.userId !== viewer._id) {
				return yield* Effect.fail(new ForbiddenError({ message: 'You do not own this prompt' }));
			}

			// Validate inputs
			yield* validatePrompt({
				title: args.title,
				content: args.content,
				templateMode: args.templateMode,
				isPublic: args.isPublic,
				tags: args.tags,
				templateFields: args.templateFields,
				category: args.category
			});

			yield* Effect.tryPromise(() =>
				writerDb.patch(args.id, {
					title: args.title,
					content: args.content,
					templateMode: args.templateMode,
					isPublic: args.isPublic,
					tags: args.tags,
					templateFields: args.templateFields,
					category: args.category,
					updatedAt: Date.now()
				})
			);

			const updatedPrompt = yield* Effect.tryPromise(() => writerDb.get(args.id));
			return updatedPrompt;
		})
});

export const remove = effectAuthedMutation({
	args: {
		id: v.id('prompts')
	},
	handler: (args) =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			if (!viewer) {
				return yield* Effect.fail(new UnauthorizedError({ message: 'Not authenticated' }));
			}

			const { db } = yield* ConvexDB;
			const writerDb = db as GenericDatabaseWriter<DataModel>;

			// Verify existence
			const prompt = yield* Effect.tryPromise(() => writerDb.get(args.id));
			if (!prompt) {
				return yield* Effect.fail(new NotFoundError({ message: 'Prompt not found' }));
			}

			// Verify ownership
			if (prompt.userId !== viewer._id) {
				return yield* Effect.fail(new ForbiddenError({ message: 'You do not own this prompt' }));
			}

			yield* Effect.tryPromise(() => writerDb.delete(args.id));

			return { success: true };
		})
});

export const list = effectAuthedQuery({
	args: {},
	handler: () =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			if (!viewer) {
				return yield* Effect.fail(new UnauthorizedError({ message: 'Not authenticated' }));
			}

			const { db } = yield* ConvexDB;
			const prompts = yield* Effect.tryPromise(() =>
				db
					.query('prompts')
					.withIndex('by_userId', (q) => q.eq('userId', viewer._id))
					.collect()
			);

			return prompts;
		})
});

export const get = effectAuthedQuery({
	args: {
		id: v.id('prompts')
	},
	handler: (args) =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			if (!viewer) {
				return yield* Effect.fail(new UnauthorizedError({ message: 'Not authenticated' }));
			}

			const { db } = yield* ConvexDB;
			const prompt = yield* Effect.tryPromise(() => db.get(args.id));
			if (!prompt) {
				return yield* Effect.fail(new NotFoundError({ message: 'Prompt not found' }));
			}

			if (prompt.isPublic === true || prompt.userId === viewer._id) {
				return prompt;
			}

			return yield* Effect.fail(new ForbiddenError({ message: 'Access denied' }));
		})
});
