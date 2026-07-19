import { v } from 'convex/values';
import { effectAuthedQuery, effectAuthedMutation, AuthedContext } from './helpers';
import { Effect, Schema } from 'effect';
import { ConvexDB } from '../services/ConvexDB';
import { GenericDatabaseReader, GenericDatabaseWriter } from 'convex/server';
import { DataModel, Doc } from '../_generated/dataModel';
import { validatePrompt } from './validation';
import { UnauthorizedError } from './errors';
import { generateUniqueSlug } from '../slugs';

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()("NotFoundError", {
	message: Schema.String
}) {}

export class ForbiddenError extends Schema.TaggedErrorClass<ForbiddenError>()("ForbiddenError", {
	message: Schema.String
}) {}

export class PlanLimitError extends Schema.TaggedErrorClass<PlanLimitError>()("PlanLimitError", {
	message: Schema.String
}) {}

// Hobby plan limits (match the published Pricing spec: 30 prompts, 10 public).
export const HOBBY_PROMPT_LIMIT = 30;
export const HOBBY_PUBLIC_PROMPT_LIMIT = 10;

// Hobby-only quota enforcement. Reads are bounded (limit + 1) so they stay
// efficient even for users who downgrade from Pro with a large library.
function enforceHobbyQuota(
	db: GenericDatabaseReader<DataModel>,
	viewer: Doc<'users'>,
	opts: { checkTotal: boolean; markPublic: boolean }
) {
	return Effect.gen(function* () {
		if (viewer.plan !== 'hobby') return;

		if (opts.checkTotal) {
			const existing = yield* Effect.tryPromise(() =>
				db
					.query('prompts')
					.withIndex('by_userId_isPublic', (q) => q.eq('userId', viewer._id))
					.take(HOBBY_PROMPT_LIMIT + 1)
			);
			if (existing.length >= HOBBY_PROMPT_LIMIT) {
				return yield* Effect.fail(
					new PlanLimitError({
						message: `You've reached the ${HOBBY_PROMPT_LIMIT}-prompt limit on the Hobby plan. Upgrade to Pro to create more prompts.`
					})
				);
			}
		}

		if (opts.markPublic) {
			const publicPrompts = yield* Effect.tryPromise(() =>
				db
					.query('prompts')
					.withIndex('by_userId_isPublic', (q) => q.eq('userId', viewer._id).eq('isPublic', true))
					.take(HOBBY_PUBLIC_PROMPT_LIMIT + 1)
			);
			if (publicPrompts.length >= HOBBY_PUBLIC_PROMPT_LIMIT) {
				return yield* Effect.fail(
					new PlanLimitError({
						message: `You've reached the ${HOBBY_PUBLIC_PROMPT_LIMIT} public-prompt limit on the Hobby plan. Upgrade to Pro to share more public prompts.`
					})
				);
			}
		}
	});
}

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
			yield* enforceHobbyQuota(db, viewer, { checkTotal: true, markPublic: args.isPublic });

			const publicSlug = args.isPublic
				? yield* generateUniqueSlug(writerDb, args.title)
				: undefined;

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
					publicSlug,
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
			yield* enforceHobbyQuota(db, viewer, { checkTotal: false, markPublic: args.isPublic && !prompt.isPublic });
			// Generate a slug only on private->public transition with no existing slug.
			// An existing slug is always preserved (never regenerated on title edit).
			const publicSlug = args.isPublic && !prompt.publicSlug
				? yield* generateUniqueSlug(writerDb, args.title)
				: prompt.publicSlug;

			yield* Effect.tryPromise(() =>
				writerDb.patch(args.id, {
					title: args.title,
					content: args.content,
					templateMode: args.templateMode,
					isPublic: args.isPublic,
					tags: args.tags,
					templateFields: args.templateFields,
					category: args.category,
					publicSlug,
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

export const getUsage = effectAuthedQuery({
	args: {},
	handler: () =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			if (!viewer) {
				return yield* Effect.fail(new UnauthorizedError({ message: 'Not authenticated' }));
			}

			if (viewer.plan === 'pro') {
				return {
					plan: 'pro' as const,
					promptsUsed: 0,
					promptsLimit: null,
					publicUsed: 0,
					publicLimit: null
				};
			}

			const { db } = yield* ConvexDB;
			const [prompts, publicPrompts] = yield* Effect.tryPromise(() =>
				Promise.all([
					db
						.query('prompts')
						.withIndex('by_userId_isPublic', (q) => q.eq('userId', viewer._id))
						.take(HOBBY_PROMPT_LIMIT + 1),
					db
						.query('prompts')
						.withIndex('by_userId_isPublic', (q) => q.eq('userId', viewer._id).eq('isPublic', true))
						.take(HOBBY_PUBLIC_PROMPT_LIMIT + 1)
				])
			);

			return {
				plan: 'hobby' as const,
				promptsUsed: prompts.length,
				promptsLimit: HOBBY_PROMPT_LIMIT,
				publicUsed: publicPrompts.length,
				publicLimit: HOBBY_PUBLIC_PROMPT_LIMIT
			};
		})
});
