import { v } from 'convex/values';
import { query } from '../_generated/server';
import type { GenericDatabaseReader } from 'convex/server';
import type { DataModel, Doc } from '../_generated/dataModel';

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

export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, { slug }) => {
		if (!slug || slug.length > 400) return null;
		const prompt = await ctx.db.query('prompts').withIndex('by_publicSlug', (q) => q.eq('publicSlug', slug)).unique();
		if (!prompt || !prompt.isPublic || !prompt.publicSlug) return null;
		const author = await ctx.db.get("users", prompt.userId);
		return { ...toPublicPromptDTO(prompt, author), templateFields: prompt.templateFields };
	}
});

async function searchPublicPrompts(db: GenericDatabaseReader<DataModel>, searchQuery: string, category: string | undefined, sortBy: MarketplaceSort) {
	// Standardize search input: trim leading/trailing whitespace, collapse internal spaces, and limit length.
	const normalized = searchQuery.trim().replace(/\s+/g, ' ').slice(0, 200);
	if (!normalized) return [];
	const hasCategory = Boolean(category && category !== 'all');
	const search = db.query('prompts').withSearchIndex('search_all', (q) => {
		const publicSearch = q.search('searchableText', normalized).eq('isPublic', true);
		return hasCategory ? publicSearch.eq('category', category) : publicSearch;
	});
	const prompts = await search.take(MARKETPLACE_PAGE_SIZE);
	return sortBy === 'a-z' ? [...prompts].sort((a, b) => a.title.localeCompare(b.title)) : prompts;
}

function listPublic(db: GenericDatabaseReader<DataModel>, category: string | undefined, sortBy: MarketplaceSort) {
	const hasCategory = Boolean(category && category !== 'all');
	if (sortBy === 'a-z') {
		return hasCategory
			? db.query('prompts').withIndex('by_isPublic_and_category_and_title', (q) => q.eq('isPublic', true).eq('category', category)).order('asc').take(MARKETPLACE_PAGE_SIZE)
			: db.query('prompts').withIndex('by_isPublic_and_title', (q) => q.eq('isPublic', true)).order('asc').take(MARKETPLACE_PAGE_SIZE);
	}
	return hasCategory
		? db.query('prompts').withIndex('by_isPublic_and_category', (q) => q.eq('isPublic', true).eq('category', category)).order('desc').take(MARKETPLACE_PAGE_SIZE)
		: db.query('prompts').withIndex('by_isPublic', (q) => q.eq('isPublic', true)).order('desc').take(MARKETPLACE_PAGE_SIZE);
}

export const listPublicPrompts = query({
	args: {
		searchQuery: v.optional(v.string()),
		category: v.optional(v.string()),
		sortBy: v.optional(v.union(v.literal('recent'), v.literal('a-z')))
	},
	handler: async (ctx, args) => {
		const prompts = args.searchQuery
			? await searchPublicPrompts(ctx.db, args.searchQuery, args.category, args.sortBy)
			: await listPublic(ctx.db, args.category, args.sortBy);
		return Promise.all(prompts.map(async (prompt) => ({ _id: prompt._id, ...toPublicPromptDTO(prompt, await ctx.db.get("users", prompt.userId)) })));
	}
});
