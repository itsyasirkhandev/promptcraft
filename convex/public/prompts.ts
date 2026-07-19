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
import { query } from '../_generated/server';

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
			title: prompt.title,
			content: prompt.content,
			tags: prompt.tags,
			templateMode: prompt.templateMode,
			templateFields: prompt.templateFields,
			category: prompt.category,
			publicSlug: prompt.publicSlug,
			_creationTime: prompt._creationTime,
			author: author
				? { name: author.name, avatarUrl: author.avatarUrl }
				: { name: 'Anonymous' }
		};
	}
});
