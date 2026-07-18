// Shared typed user lookups so the Clerk-upsert, authed getOrCreateUser,
// Polar webhook, and private internal-query paths all resolve users the same
// way (spec 3.6). A single `queryUserBy` switch keeps the three index probes in
// one place so they don't clone; the named exports preserve a typed call site.

import type { GenericDatabaseReader, GenericDatabaseWriter } from "convex/server";
import type { DataModel, Doc } from "./_generated/dataModel";

type UserLookup =
	| { by: "token"; tokenIdentifier: string }
	| { by: "clerkId"; clerkId: string }
	| { by: "polarCustomerId"; polarCustomerId: string };

function queryUserBy(
	db: GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel>,
	lookup: UserLookup,
): Promise<Doc<"users"> | null> {
	switch (lookup.by) {
		case "token":
			return db
				.query("users")
				.withIndex("by_token", (q) => q.eq("tokenIdentifier", lookup.tokenIdentifier))
				.unique();
		case "clerkId":
			return db
				.query("users")
				.withIndex("by_clerk_id", (q) => q.eq("clerkId", lookup.clerkId))
				.unique();
		case "polarCustomerId":
			return db
				.query("users")
				.withIndex("by_polar_customer_id", (q) => q.eq("polarCustomerId", lookup.polarCustomerId))
				.unique();
	}
}

export const queryUserByToken = (
	db: GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel>,
	tokenIdentifier: string,
): Promise<Doc<"users"> | null> => queryUserBy(db, { by: "token", tokenIdentifier });

export const queryUserByClerkId = (
	db: GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel>,
	clerkId: string,
): Promise<Doc<"users"> | null> => queryUserBy(db, { by: "clerkId", clerkId });

export const queryUserByPolarCustomerId = (
	db: GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel>,
	polarCustomerId: string,
): Promise<Doc<"users"> | null> => queryUserBy(db, { by: "polarCustomerId", polarCustomerId });


