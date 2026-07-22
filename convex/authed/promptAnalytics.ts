import { Effect } from 'effect';
import { ConvexDB } from '../services/ConvexDB';
import { effectAuthedQuery, AuthedContext } from './helpers';

const DAYS_IN_PERIOD = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const UNCATEGORIZED_KEY = 'uncategorized';

const toUtcDate = (timestamp: number) => new Date(timestamp).toISOString().slice(0, 10);

export const getInventoryAnalytics = effectAuthedQuery({
	args: {},
	handler: () =>
		Effect.gen(function* () {
			const { viewer } = yield* AuthedContext;
			if (!viewer) {
				return {
					summary: { totalPrompts: 0, publicPrompts: 0, templatePrompts: 0, createdLast30Days: 0 },
					creationTrend: [],
					visibility: [],
					promptTypes: [],
					categories: [],
					period: { timezone: 'UTC' as const, startDate: '', endDate: '', days: DAYS_IN_PERIOD }
				};
			}

			const now = Date.now();
			const currentDate = new Date(now);
			const endDayStart = Date.UTC(
				currentDate.getUTCFullYear(),
				currentDate.getUTCMonth(),
				currentDate.getUTCDate()
			);
			const startTimestamp = endDayStart - (DAYS_IN_PERIOD - 1) * DAY_IN_MILLISECONDS;

			const { db } = yield* ConvexDB;
			const [prompts, recentPrompts] = yield* Effect.tryPromise(() =>
				Promise.all([
					db
						.query('prompts')
						.withIndex('by_userId', (query) => query.eq('userId', viewer._id))
						.collect(),
					db
						.query('prompts')
						.withIndex('by_userId_createdAt', (query) =>
							query.eq('userId', viewer._id).gte('createdAt', startTimestamp)
						)
						.collect()
				])
			);
			const createdInWindow = recentPrompts.filter((prompt) => prompt.createdAt <= now);

			const creationCounts = new Map<string, number>();
			for (const prompt of createdInWindow) {
				const date = toUtcDate(prompt.createdAt);
				creationCounts.set(date, (creationCounts.get(date) ?? 0) + 1);
			}
			const creationTrend = Array.from({ length: DAYS_IN_PERIOD }, (_, index) => {
				const date = toUtcDate(startTimestamp + index * DAY_IN_MILLISECONDS);
				return { date, count: creationCounts.get(date) ?? 0 };
			});

			let publicPrompts = 0;
			let templatePrompts = 0;
			const categoryGroups = new Map<
				string,
				{
					count: number;
					firstSeen: number;
					variants: Map<string, { count: number; firstSeen: number }>;
				}
			>();

			for (const [index, prompt] of prompts.entries()) {
				if (prompt.isPublic) publicPrompts += 1;
				if (prompt.templateMode) templatePrompts += 1;

				const trimmedCategory = prompt.category?.trim() ?? '';
				const key = trimmedCategory ? trimmedCategory.toLocaleLowerCase() : UNCATEGORIZED_KEY;
				const label = trimmedCategory || 'Uncategorized';
				const group = categoryGroups.get(key);

				if (!group) {
					categoryGroups.set(key, {
						count: 1,
						firstSeen: index,
						variants: new Map([[label, { count: 1, firstSeen: index }]])
					});
					continue;
				}

				group.count += 1;
				const variant = group.variants.get(label);
				if (variant) variant.count += 1;
				else group.variants.set(label, { count: 1, firstSeen: index });
			}

			const rankedCategories = Array.from(categoryGroups, ([key, group]) => {
				const label = Array.from(group.variants).sort(
					([, left], [, right]) => right.count - left.count || left.firstSeen - right.firstSeen
				)[0][0];

				return { key, label, count: group.count };
			}).sort(
				(left, right) => right.count - left.count || left.label.localeCompare(right.label)
			);

			const uncategorized = rankedCategories.find(({ key }) => key === UNCATEGORIZED_KEY);
			const categorized = rankedCategories.filter(({ key }) => key !== UNCATEGORIZED_KEY);
			const namedCategories = uncategorized
				? [uncategorized, ...categorized.slice(0, 5)]
				: categorized.slice(0, 6);
			namedCategories.sort(
				(left, right) => right.count - left.count || left.label.localeCompare(right.label)
			);
			const overflow = uncategorized ? categorized.slice(5) : categorized.slice(6);
			const otherCount = overflow.reduce((total, category) => total + category.count, 0);
			const categories = namedCategories.map(({ key, label, count }) => ({ key, label, count }));

			if (otherCount > 0) categories.push({ key: 'other', label: 'Other', count: otherCount });

			return {
				summary: {
					totalPrompts: prompts.length,
					publicPrompts,
					templatePrompts,
					createdLast30Days: createdInWindow.length
				},
				creationTrend,
				visibility: [
					{ key: 'public' as const, label: 'Public' as const, count: publicPrompts },
					{ key: 'private' as const, label: 'Private' as const, count: prompts.length - publicPrompts }
				],
				promptTypes: [
					{ key: 'template' as const, label: 'Template' as const, count: templatePrompts },
					{ key: 'static' as const, label: 'Static' as const, count: prompts.length - templatePrompts }
				],
				categories,
				period: {
					timezone: 'UTC' as const,
					startDate: toUtcDate(startTimestamp),
					endDate: toUtcDate(endDayStart),
					days: DAYS_IN_PERIOD
				}
			};
		})
});
