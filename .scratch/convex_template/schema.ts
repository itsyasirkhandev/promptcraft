import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
	conferences: defineTable({
		name: v.string(),
		location: v.string(),
		startDate: v.number(),
		endDate: v.number(),
		description: v.optional(v.string())
	})
});
