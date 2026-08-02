import * as React from 'react';
import { fetchQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { PublicPromptClient } from '@/components/prompts/PublicPromptClient';
import Navbar from '@/components/templates/nexto/sections/Navbar';
import Pricing from '@/components/templates/nexto/sections/Pricing';
import CTA from '@/components/templates/nexto/sections/CTA';
import Footer from '@/components/templates/nexto/sections/Footer';

interface PageProps {
	params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;

	let prompt = null;
	try {
		prompt = await fetchQuery(api.public.prompts.getBySlug, { slug });
	} catch (err) {
		console.error('Failed to fetch prompt for dynamic metadata:', err);
	}

	const title = prompt?.title
		? `${prompt.title} — AI Prompt Template`
		: `${slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} — Public Prompt`;

	const description = prompt?.content
		? prompt.content.slice(0, 155).replace(/\n/g, ' ') + '...'
		: 'Use and copy this public prompt. Fill in the fields, copy, or open in your AI tool of choice.';

	return {
		title,
		description,
		alternates: {
			canonical: `/p/${slug}`,
		},
		openGraph: {
			title,
			description,
			url: `/p/${slug}`,
			type: 'article',
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
		},
	};
}

export default function Page({ params }: PageProps) {
	const { slug } = React.use(params);
	return (
		<>
			<Navbar />
			<main id="main-content" className="flex-1">
				<PublicPromptClient slug={slug} />
				<Pricing />
				<CTA />
			</main>
			<Footer />
		</>
	);
}
