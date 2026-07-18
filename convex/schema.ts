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
		polarSubscriptionStatus: v.optional(v.string())
	})
		.index('by_token', ['tokenIdentifier'])
		.index('by_clerk_id', ['clerkId'])
		.index('by_polar_customer_id', ['polarCustomerId']),
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
		createdAt: v.number(),
		updatedAt: v.optional(v.number())
	})
		.index('by_userId', ['userId'])
		.index('by_userId_createdAt', ['userId', 'createdAt'])
		.index('by_isPublic', ['isPublic'])
});
