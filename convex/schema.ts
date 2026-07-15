import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	users: defineTable({
		name: v.string(),
		email: v.string(),
		avatarUrl: v.optional(v.string()),
		tokenIdentifier: v.string(),
		clerkId: v.optional(v.string()),
		plan: v.union(v.literal('hobby'), v.literal('pro'))
	})
		.index('by_token', ['tokenIdentifier'])
		.index('by_clerk_id', ['clerkId']),
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
				type: v.string(),
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
