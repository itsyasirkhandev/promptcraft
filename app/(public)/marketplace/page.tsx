import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MarketplaceSearch } from '@/components/marketplace/MarketplaceSearch';
import Navbar from '@/components/templates/nexto/sections/Navbar';
import Pricing from '@/components/templates/nexto/sections/Pricing';
import CTA from '@/components/templates/nexto/sections/CTA';
import Footer from '@/components/templates/nexto/sections/Footer';

export const metadata: Metadata = {
	title: 'Public Marketplace — Prompt Crafts',
	description:
		'Discover, search, and copy publicly shared AI prompts created by the community.',
};

export default function MarketplacePage() {
	return (
	<>
		<Navbar />
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

			<Suspense>
				<MarketplaceSearch />
			</Suspense>
		</div>
		<Pricing />
		<CTA />
		<Footer />
	</>
	);
}