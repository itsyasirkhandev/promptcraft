import { v } from 'convex/values';
import { Effect } from 'effect';
import { GenericDatabaseReader } from 'convex/server';
import { query } from '../_generated/server';
import { DataModel, Doc } from '../_generated/dataModel';
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
type MarketplaceSort = 'recent' | 'a-z' | undefined;

function toPublicPromptDTO(prompt: Doc<'prompts'>, author: Doc<'users'> | null) {
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

async function searchPublicPrompts(
	db: GenericDatabaseReader<DataModel>,
	searchQuery: string,
	category: string | undefined,
	sortBy: MarketplaceSort
) {
	const hasCategory = Boolean(category && category !== 'all');
	const takeSize = hasCategory ? MARKETPLACE_PAGE_SIZE * 3 : MARKETPLACE_PAGE_SIZE;
	const search = db.query('prompts').withSearchIndex('search_all', (q) =>
		q.search('searchableText', searchQuery).eq('isPublic', true)
	);
	let prompts = await search.take(takeSize);
	if (hasCategory) prompts = prompts.filter((prompt) => prompt.category === category);
	prompts = prompts.slice(0, MARKETPLACE_PAGE_SIZE);
	return sortBy === 'a-z'
		? [...prompts].sort((left, right) => left.title.localeCompare(right.title))
		: prompts;
}

async function listAlphabetically(
	db: GenericDatabaseReader<DataModel>,
	category: string | undefined
) {
	if (category && category !== 'all') {
		return db
			.query('prompts')
			.withIndex('by_isPublic_and_category_and_title', (q) =>
				q.eq('isPublic', true).eq('category', category)
			)
			.order('asc')
			.take(MARKETPLACE_PAGE_SIZE);
	}
	return db
		.query('prompts')
		.withIndex('by_isPublic_and_title', (q) => q.eq('isPublic', true))
		.order('asc')
		.take(MARKETPLACE_PAGE_SIZE);
}

async function listRecentlyCreated(
	db: GenericDatabaseReader<DataModel>,
	category: string | undefined
) {
	if (category && category !== 'all') {
		return db
			.query('prompts')
			.withIndex('by_isPublic_and_category', (q) =>
				q.eq('isPublic', true).eq('category', category)
			)
			.order('desc')
			.take(MARKETPLACE_PAGE_SIZE);
	}
	return db
		.query('prompts')
		.withIndex('by_isPublic', (q) => q.eq('isPublic', true))
		.order('desc')
		.take(MARKETPLACE_PAGE_SIZE);
}

function loadMarketplacePrompts(
	db: GenericDatabaseReader<DataModel>,
	args: { searchQuery?: string; category?: string; sortBy?: MarketplaceSort }
) {
	if (args.searchQuery) {
		return searchPublicPrompts(db, args.searchQuery, args.category, args.sortBy);
	}
	return args.sortBy === 'a-z'
		? listAlphabetically(db, args.category)
		: listRecentlyCreated(db, args.category);
}

async function attachAuthors(
	db: GenericDatabaseReader<DataModel>,
	prompts: Doc<'prompts'>[]
) {
	return Promise.all(
		prompts.map(async (prompt) => {
			const author = await db.get(prompt.userId);
			return { _id: prompt._id, ...toPublicPromptDTO(prompt, author) };
		})
	);
}

export const listPublicPrompts = query({
	args: {
		searchQuery: v.optional(v.string()),
		category: v.optional(v.string()),
		sortBy: v.optional(v.union(v.literal('recent'), v.literal('a-z')))
	},
	handler: async (ctx, args) =>
		runEffect(
			Effect.gen(function* () {
				const { db } = yield* ConvexDB;
				const prompts = yield* Effect.tryPromise(() => loadMarketplacePrompts(db, args));
				return yield* Effect.tryPromise(() => attachAuthors(db, prompts));
			}).pipe(Effect.provideService(ConvexDB, { db: ctx.db }))
		)
});
