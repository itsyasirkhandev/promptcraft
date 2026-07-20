/**
 * public/prompts.ts — Unauthenticated public read
 *
 * The single intentional exception to the "client-facing functions use
 * convex/authed/" convention: this is a read-only `query` (NOT an authed
 * query) so an unauthenticated visitor can resolve a public prompt by slug.
 * Writes remain in convex/authed/. This is a minimal convention extension,
 * not a general pattern.
 *
 * Security boundary: `getBySlug` returns `null` for any prompt that is
 * missing, private, or has no slug — no distinction is made so prompt
 * existence is never leaked. The returned `PublicPromptDTO` is a strict
 * projection: it never carries userId, tokenIdentifier, clerkId, email,
 * or polarCustomerId.
 */

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
			.unique();

		// Collapse missing / private / no-slug into a single null so existence
		// is not leaked. A toggled-private prompt retains its slug on the
		// document but is unreachable here until re-publicized.
		if (!prompt || prompt.isPublic !== true || !prompt.publicSlug) return null;

		const author = await ctx.db.get(prompt.userId);
		return {
			...toPublicPromptDTO(prompt, author),
			templateFields: prompt.templateFields
		};
	}
});

/**
 * `listPublicPrompts` — unauthenticated, Effect-based list query for the
 * public Marketplace. Returns a bounded (take 50) projection of every public
 * prompt, with the same filtering/sorting behavior as the marketplace
 * reference (convex/dal/prompts.dal.ts):
 *   - searchQuery present  -> `search_all` full-text search, then in-memory
 *                             category filter + optional A-Z sort.
 *   - no search, a-z        -> `by_isPublic_and_title` ascending; category
 *                             applied via `for await` push-until-50.
 *   - no search, recent     -> `by_isPublic` descending (newest first); same
 *                             `for await` category behavior.
 *
 * Security boundary mirrors `getBySlug`: only `isPublic === true` prompts are
 * ever returned, and the projection carries no `userId`, author email, or any
 * internal id — just the fields the marketplace card needs. The entry point is
 * a plain `query` (no Clerk identity for an anonymous visitor); the handler is
 * Effect-based via `runEffect(Effect.gen(...).pipe(Effect.provideService(
 * ConvexDB, { db: ctx.db })))`, going through `Effect.tryPromise` for each db op.
 */

const MARKETPLACE_PAGE_SIZE = 50;

// `for await` push-until-limit over an already-ordered public-prompt query,
// keeping only prompts whose category matches. Category filtering is done
// in-memory/iteratively (never the Convex query `.filter()` operator, by spec).
async function collectByCategory(
	query: AsyncIterable<Doc<'prompts'>>,
	category: string,
	limit: number,
): Promise<Doc<'prompts'>[]> {
	const out: Doc<'prompts'>[] = [];
	for await (const p of query) {
		if (p.category === category) {
			out.push(p);
			if (out.length >= limit) break;
		}
	}
	return out;
}

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
		author: author ? { name: author.name, avatarUrl: author.avatarUrl } : { name: 'Anonymous' }
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
				let prompts: Doc<'prompts'>[] = [];

				if (args.searchQuery) {
					const searchQuery = args.searchQuery;
					prompts = yield* Effect.tryPromise(() =>
						db
							.query('prompts')
							.withSearchIndex('search_all', (q) =>
								q.search('searchableText', searchQuery).eq('isPublic', true)
							)
							.take(limit)
					);
					if (category && category !== 'all') {
						prompts = prompts.filter((p) => p.category === category);
					}
					if (args.sortBy === 'a-z') {
						prompts = [...prompts].sort((a, b) => a.title.localeCompare(b.title));
					}
				} else if (args.sortBy === 'a-z') {
					if (category && category !== 'all') {
						prompts = yield* Effect.tryPromise(() =>
							collectByCategory(
								db
									.query('prompts')
									.withIndex('by_isPublic_and_title', (q) => q.eq('isPublic', true))
									.order('asc'),
								category,
								limit
							)
						);
					} else {
						prompts = yield* Effect.tryPromise(() =>
							db
								.query('prompts')
								.withIndex('by_isPublic_and_title', (q) => q.eq('isPublic', true))
								.order('asc')
								.take(limit)
						);
					}
				} else {
					// `recent` (the default): newest first via `by_isPublic` desc.
					if (category && category !== 'all') {
						prompts = yield* Effect.tryPromise(() =>
							collectByCategory(
								db
									.query('prompts')
									.withIndex('by_isPublic', (q) => q.eq('isPublic', true))
									.order('desc'),
								category,
								limit
							)
						);
					} else {
						prompts = yield* Effect.tryPromise(() =>
							db
								.query('prompts')
								.withIndex('by_isPublic', (q) => q.eq('isPublic', true))
								.order('desc')
								.take(limit)
						);
					}
				}

				const results = yield* Effect.tryPromise(() =>
					Promise.all(
						prompts.map(async (p) => {
							const author = await db.get(p.userId);
							return { _id: p._id, ...toPublicPromptDTO(p, author) };
						})
					)
				);
				return results;
			}).pipe(Effect.provideService(ConvexDB, { db: ctx.db }))
		);
	}
});
