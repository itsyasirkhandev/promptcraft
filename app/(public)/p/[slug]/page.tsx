import * as React from 'react';
import { PublicPromptClient } from '@/components/prompts/PublicPromptClient';

interface PageProps {
	params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
	const { slug } = await params;
	// Derive a human-readable title from the slug for <head> metadata.
	const readable = slug
		.replace(/-/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());
	return {
		title: `${readable} — Public Prompt`,
		description: 'Use and copy this public prompt. Fill in the fields, copy, or open in your AI tool of choice.',
		openGraph: { title: readable, type: 'article' },
		twitter: { card: 'summary' }
	};
}

export default function Page({ params }: PageProps) {
	const { slug } = React.use(params);
	return <PublicPromptClient slug={slug} />;
}
