import { v } from 'convex/values';
import { Effect } from 'effect';
import { query } from '../_generated/server';
import { Doc } from '../_generated/dataModel';
import { runEffect } from '../effectHelpers';
import { ConvexDB } from '../services/ConvexDB';

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const prompt = await ctx.db
			.query('prompts')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', args.slug))
			.first();

		if (!prompt || prompt.isPublic !== true || !prompt.publicSlug) return null;

		const author = await ctx.db.get(prompt.userId);
		return {
			...toPublicPromptDTO(prompt, author),
			templateFields: prompt.templateFields
		};
	}
});

const MARKETPLACE_PAGE_SIZE = 50;

function toPublicPromptDTO(
	prompt: Doc<'prompts'>,
	author: Doc<'users'> | null,
) {
	return {
		_creationTime: prompt._creationTime,
		title: prompt.title,
		content: prompt.content,
		tags: prompt.tags,
		templateMode: prompt.templateMode,
		category: prompt.category,
		publicSlug: prompt.publicSlug,
		author: { name: author?.name ?? 'Anonymous', avatarUrl: author?.avatarUrl ?? null }
	};
}

export const listPublicPrompts = query({
	args: {
		searchQuery: v.optional(v.string()),
		category: v.optional(v.string()),
		sortBy: v.optional(v.union(v.literal('recent'), v.literal('a-z')))
	},
	handler: async (ctx, args) => {
		return runEffect(
			Effect.gen(function* () {
				const { db } = yield* ConvexDB;
				const limit = MARKETPLACE_PAGE_SIZE;
				const category = args.category;
				const hasCategory = Boolean(category && category !== 'all');
				let prompts: Doc<'prompts'>[] = [];

				if (args.searchQuery) {
					const takeSize = hasCategory ? limit * 3 : limit;
					prompts = yield* Effect.tryPromise(() =>
						db
							.query('prompts')
							.withSearchIndex('search_all', (q) =>
								q.search('searchableText', args.searchQuery!).eq('isPublic', true)
							)
							.take(takeSize)
					);
					if (hasCategory) prompts = prompts.filter((p) => p.category === category);
					prompts = prompts.slice(0, limit);
					if (args.sortBy === 'a-z') {
						prompts = [...prompts].sort((a, b) => a.title.localeCompare(b.title));
					}
				} else if (args.sortBy === 'a-z') {
					prompts = hasCategory
						? yield* Effect.tryPromise(() =>
							db
								.query('prompts')
								.withIndex('by_isPublic_and_category_and_title', (q) =>
									q.eq('isPublic', true).eq('category', category!)
								)
								.order('asc')
								.take(limit)
						)
						: yield* Effect.tryPromise(() =>
							db
								.query('prompts')
								.withIndex('by_isPublic_and_title', (q) => q.eq('isPublic', true))
								.order('asc')
								.take(limit)
						);
				} else {
					prompts = hasCategory
						? yield* Effect.tryPromise(() =>
							db
								.query('prompts')
								.withIndex('by_isPublic_and_category', (q) =>
									q.eq('isPublic', true).eq('category', category!)
								)
								.order('desc')
								.take(limit)
						)
						: yield* Effect.tryPromise(() =>
							db
								.query('prompts')
								.withIndex('by_isPublic', (q) => q.eq('isPublic', true))
								.order('desc')
								.take(limit)
						);
				}

				return yield* Effect.tryPromise(() =>
					Promise.all(
						prompts.map(async (p) => {
							const author = await db.get(p.userId);
							return { _id: p._id, ...toPublicPromptDTO(p, author) };
						})
					)
				);
			}).pipe(Effect.provideService(ConvexDB, { db: ctx.db }))
		);
	}
});
