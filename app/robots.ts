import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/utils';

export default function robots(): MetadataRoute.Robots {
	const baseUrl = getSiteUrl();

	return {
		rules: {
			userAgent: '*',
			allow: ['/', '/marketplace', '/p/', '/terms', '/privacy', '/llms.txt'],
			disallow: ['/dashboard/', '/prompt/', '/upgrade/'],
		},
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
