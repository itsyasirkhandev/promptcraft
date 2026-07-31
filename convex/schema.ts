import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({
		name: v.string(),
		email: v.string(),
		avatarUrl: v.optional(v.string()),
		tokenIdentifier: v.string(),
		clerkId: v.optional(v.string()),
		plan: v.union(v.literal('hobby'), v.literal('pro')),
		polarCustomerId: v.optional(v.string()),
		polarSubscriptionId: v.optional(v.string()),
		polarSubscriptionStatus: v.optional(v.string()),
		polarLastEventAt: v.optional(v.number())
	})
		.index('by_tokenIdentifier', ['tokenIdentifier'])
		.index('by_clerkId', ['clerkId'])
		.index('by_polarCustomerId', ['polarCustomerId'])
		.index('by_email', ['email']),
	prompts: defineTable({
		userId: v.id('users'),
		title: v.string(),
		content: v.string(),
		templateMode: v.boolean(),
		isPublic: v.boolean(),
		tags: v.array(v.string()),
		templateFields: v.array(
			v.object({
				id: v.string(),
				name: v.string(),
				type: v.union(v.literal('text'), v.literal('longText'), v.literal('number'), v.literal('singleSelect'), v.literal('multiSelect')),
				options: v.optional(v.array(v.string()))
			})
		),
		category: v.optional(v.string()),
		publicSlug: v.optional(v.string()),
		searchableText: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.optional(v.number())
	})
		.index('by_userId', ['userId'])
		.index('by_userId_and_createdAt', ['userId', 'createdAt'])
		.index('by_userId_and_isPublic', ['userId', 'isPublic'])
		.index('by_isPublic', ['isPublic'])
		.index('by_isPublic_and_category', ['isPublic', 'category'])
		.index('by_isPublic_and_category_and_title', ['isPublic', 'category', 'title'])
		.index('by_publicSlug', ['publicSlug'])
		.index('by_isPublic_and_title', ['isPublic', 'title'])
		.searchIndex('search_all', { searchField: 'searchableText', filterFields: ['isPublic', 'category'] }),
	pendingSubscriptions: defineTable({
		clerkId: v.optional(v.string()),
		polarCustomerId: v.optional(v.string()),
		polarSubscriptionId: v.optional(v.string()),
		polarSubscriptionStatus: v.optional(v.string()),
		plan: v.union(v.literal('hobby'), v.literal('pro')),
		eventTimestamp: v.number(),
		createdAt: v.number()
	})
		.index('by_clerkId', ['clerkId'])
		.index('by_polarCustomerId', ['polarCustomerId']),
	webhookEvents: defineTable({
		provider: v.literal('polar'),
		eventId: v.string(),
		eventType: v.string(),
		eventTimestamp: v.number(),
		status: v.union(
			v.literal('processing'),
			v.literal('applied'),
			v.literal('ignored'),
			v.literal('unresolved'),
			v.literal('dead_letter')
		),
		processedAt: v.optional(v.number()),
		error: v.optional(v.string())
	})
		.index('by_provider_and_eventId', ['provider', 'eventId'])
		.index('by_status', ['status'])
});

