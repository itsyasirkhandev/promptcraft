/**
 * slugs.ts — Public slug generation and uniqueness checking
 *
 * All slug-domain logic lives here. No caller needs to know how uniqueness
 * is enforced or how many retry attempts are made — that is the depth.
 *
 * Exports:
 *   generateUniqueSlug — derive a URL-safe slug from a title, retrying until unique
 *   baseSlugFrom        — pure title -> base-slug normaliser (exported for tests)
 */

import { Effect } from 'effect';
import { GenericDatabaseReader } from 'convex/server';
import { DataModel } from './_generated/dataModel';

const MAX_ATTEMPTS = 5;

/**
 * Normalise a title into a URL-safe base slug.
 * - lowercase
 * - collapse runs of non-alphanumerics to a single `-`
 * - trim leading/trailing `-`
 * - empty result -> literal `prompt` (prevents slugs that start with `-`)
 */
export function baseSlugFrom(title: string): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	return base.length > 0 ? base : 'prompt';
}

/**
 * Generate a unique public slug for a prompt title.
 *
 * Strategy:
 *  1. Normalise the title to a base slug.
 *  2. Append a 6-char random suffix (`Math.random().toString(36).substring(2, 8)`)
 *     and check the `by_publicSlug` index. Retry up to `MAX_ATTEMPTS` times.
 *  3. On exhaustion, fall back to `${baseSlug}-${Date.now().toString(36)}`,
 *     which is deterministic and unique within a single deployment.
 *
 * Convex has no unique insert constraint, so uniqueness is enforced app-side
 * via the indexed `.unique()` lookup returning at most one doc.
 *
 * Never fails — always returns a slug string. The `Effect.tryPromise` error
 * channel only surfaces a genuine DB read failure, which propagates to the
 * enclosing mutation exactly like the other `Effect.tryPromise` calls in
 * `convex/authed/prompts.ts`.
 */
export const generateUniqueSlug = (db: GenericDatabaseReader<DataModel>, title: string) =>
	Effect.gen(function* () {
		const baseSlug = baseSlugFrom(title);

		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			const candidate = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
			const existing = yield* Effect.tryPromise(() =>
				db
					.query('prompts')
					.withIndex('by_publicSlug', (q) => q.eq('publicSlug', candidate))
					.unique()
			);
			if (!existing) return candidate;
		}

		// Deterministic fallback — unique within the same deployment.
		// Append a random suffix so two mutations arriving in the same millisecond
		// still produce distinct slugs.
		return `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
	});
