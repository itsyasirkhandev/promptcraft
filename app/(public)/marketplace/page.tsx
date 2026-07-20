import type { Metadata } from 'next';
import { MarketplaceSearch } from '@/components/marketplace/MarketplaceSearch';

export const metadata: Metadata = {
	title: 'Public Marketplace — Prompt Crafts',
	description:
		'Discover, search, and copy publicly shared AI prompts created by the community.',
};

export default function MarketplacePage() {
	return (
		<div className="mx-auto max-w-7xl px-4 py-12">
			<div className="mb-12 text-center">
				<h1 className="text-4xl font-extrabold tracking-tight text-slate-900 font-heading lg:text-5xl dark:text-slate-50">
					Public Marketplace
				</h1>
				<p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500 dark:text-slate-400">
					Discover, search, and copy publicly shared AI prompts created by the
					community.
				</p>
			</div>

			<MarketplaceSearch />
		</div>
	);
}