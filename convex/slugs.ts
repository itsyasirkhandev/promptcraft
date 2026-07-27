import { Effect } from 'effect';
import { GenericDatabaseReader } from 'convex/server';
import { DataModel } from './_generated/dataModel';

const MAX_ATTEMPTS = 10;

export function baseSlugFrom(title: string): string {
	const base = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');
	return base.length > 0 ? base : 'prompt';
}

function slugExists(db: GenericDatabaseReader<DataModel>, candidate: string) {
	return Effect.tryPromise(() =>
		db
			.query('prompts')
			.withIndex('by_publicSlug', (q) => q.eq('publicSlug', candidate))
			.first()
	);
}

export const generateUniqueSlug = (db: GenericDatabaseReader<DataModel>, title: string) =>
	Effect.gen(function* () {
		const baseSlug = baseSlugFrom(title);

		for (let i = 0; i < MAX_ATTEMPTS; i++) {
			const candidate = `${baseSlug}-${Math.random().toString(36).substring(2, 8)}`;
			if (!(yield* slugExists(db, candidate))) return candidate;
		}

		const fallback = `${baseSlug}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
		if (!(yield* slugExists(db, fallback))) return fallback;
		throw new Error('Unable to generate a unique public slug');
	});
