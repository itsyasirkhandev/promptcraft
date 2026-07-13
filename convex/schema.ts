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
		.index('by_clerk_id', ['clerkId'])
});
