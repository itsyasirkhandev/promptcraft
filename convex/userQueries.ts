// Shared typed user lookups so the Clerk-upsert, authed getOrCreateUser,
// Polar webhook, Vandly webhook, and private internal-query paths all resolve
// users the same way (spec 3.6). A single `queryUserBy` switch keeps the
// index probes in one place; the named exports preserve typed call sites.

import type { GenericDatabaseReader, GenericDatabaseWriter } from "convex/server";
import type { DataModel } from "./_generated/dataModel";

/** Any Convex database handle (read or read-write). */
type UserDb = GenericDatabaseReader<DataModel> | GenericDatabaseWriter<DataModel>;

type UserLookup =
	| { by: "token"; tokenIdentifier: string }
	| { by: "clerkId"; clerkId: string }
	| { by: "polarCustomerId"; polarCustomerId: string }
	| { by: "vandlySubscriptionId"; vandlySubscriptionId: string }
	| { by: "email"; email: string };

// fallow-ignore-next-line code-duplication
function queryUserBy(db: UserDb, lookup: UserLookup) {
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
		// fallow-ignore-next-line code-duplication
		case "polarCustomerId":
			return db
				.query("users")
				.withIndex("by_polar_customer_id", (q) => q.eq("polarCustomerId", lookup.polarCustomerId))
				.unique();
		case "vandlySubscriptionId":
			return db
				.query("users")
				.withIndex("by_vandly_subscription_id", (q) => q.eq("vandlySubscriptionId", lookup.vandlySubscriptionId))
				.unique();
		case "email":
			return db
				.query("users")
				.withIndex("by_email", (q) => q.eq("email", lookup.email))
				.unique();
	}
}

export const queryUserByToken = (db: UserDb, tokenIdentifier: string) =>
	queryUserBy(db, { by: "token", tokenIdentifier });

export const queryUserByClerkId = (db: UserDb, clerkId: string) =>
	queryUserBy(db, { by: "clerkId", clerkId });

// fallow-ignore-next-line code-duplication
export const queryUserByPolarCustomerId = (db: UserDb, polarCustomerId: string) =>
	queryUserBy(db, { by: "polarCustomerId", polarCustomerId });

export const queryUserByVandlySubscriptionId = (db: UserDb, vandlySubscriptionId: string) =>
	queryUserBy(db, { by: "vandlySubscriptionId", vandlySubscriptionId });

export const queryUserByEmail = (db: UserDb, email: string) =>
	queryUserBy(db, { by: "email", email });
