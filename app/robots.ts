import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptcrafts.com';

	return {
		rules: {
			userAgent: '*',
			allow: ['/', '/marketplace', '/p/', '/terms', '/privacy', '/llms.txt'],
			disallow: ['/dashboard/', '/prompt/', '/upgrade/'],
		},
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
