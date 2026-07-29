import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';

export async function GET() {
	const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://promptcrafts.com';

	let dynamicPromptLines = '';
	try {
		const publicPrompts = await fetchQuery(api.public.prompts.listPublicPrompts, {});
		if (publicPrompts && Array.isArray(publicPrompts)) {
			dynamicPromptLines = publicPrompts
				.filter((prompt) => prompt.publicSlug)
				.map((prompt) => {
					const desc = prompt.content
						? prompt.content.slice(0, 100).replace(/\n/g, ' ') + '...'
						: 'Public AI prompt template.';
					return `- [${prompt.title}](${baseUrl}/p/${prompt.publicSlug}): ${desc}`;
				})
				.join('\n');
		}
	} catch (error) {
		console.error('Failed to fetch public prompts for llms.txt:', error);
	}

	const content = `# Prompt Crafts

> Prompt Crafts is a prompt engineering platform and public marketplace where creators and developers design, variable-interpolate, organize, and share AI prompt templates for ChatGPT, Claude, and modern LLMs.

Prompt Crafts helps users refine AI inputs to achieve optimal AI outputs. The platform provides interactive template field variables, community prompt sharing, single-click copy/export to major AI providers, and personal prompt library management.

## Core Pages

- [Home](${baseUrl}): Overview of Prompt Crafts features, prompt management capabilities, and pricing plans.
- [Public Marketplace](${baseUrl}/marketplace): Search, filter, and discover community-crafted public AI prompt templates.
- [Terms of Service](${baseUrl}/terms): Terms and conditions for using Prompt Crafts.
- [Privacy Policy](${baseUrl}/privacy): Privacy guidelines and data protection policies.

## Community Prompt Templates

${dynamicPromptLines || '- [Browse Marketplace](' + baseUrl + '/marketplace): Explore all public prompt templates.'}

## Optional

- [Logo Asset](${baseUrl}/logo.svg): Official Prompt Crafts logo.
`;

	return new Response(content, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400',
		},
	});
}
