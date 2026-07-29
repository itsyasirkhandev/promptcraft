import type { MetadataRoute } from 'next';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

// The sitemap fetches live data from Convex via fetchQuery, which uses
// cache: 'no-store', so it must be dynamically rendered.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptcrafts.com';

	const staticRoutes: MetadataRoute.Sitemap = [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: 'daily',
			priority: 1.0,
		},
		{
			url: `${baseUrl}/marketplace`,
			lastModified: new Date(),
			changeFrequency: 'hourly',
			priority: 0.9,
		},
		{
			url: `${baseUrl}/terms`,
			lastModified: new Date(),
			changeFrequency: 'monthly',
			priority: 0.3,
		},
		{
			url: `${baseUrl}/privacy`,
			lastModified: new Date(),
			changeFrequency: 'monthly',
			priority: 0.3,
		},
	];

	let dynamicRoutes: MetadataRoute.Sitemap = [];

	try {
		const publicPrompts = await fetchQuery(api.public.prompts.listPublicPrompts, {});
		if (publicPrompts && Array.isArray(publicPrompts)) {
			dynamicRoutes = publicPrompts.flatMap((prompt) => {
				if (!prompt.publicSlug) return [];
				return [{
					url: `${baseUrl}/p/${prompt.publicSlug}`,
					lastModified: prompt._creationTime ? new Date(prompt._creationTime) : new Date(),
					changeFrequency: 'weekly',
					priority: 0.8,
				}];
			});
		}
	} catch (error) {
		console.error('Failed to fetch public prompts for sitemap generation:', error);
	}

	return [...staticRoutes, ...dynamicRoutes];
}
