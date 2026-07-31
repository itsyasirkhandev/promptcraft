import { defineApp } from "convex/server";
import { v } from "convex/values";

// [Phase 10] Typed app environment variables (Convex guidelines: declare env in
// convex.config.ts via defineApp and read with `env` from "./_generated/server"
// instead of process.env). All vars are optional to preserve the existing
// fail-open/fail-closed behavior in each consumer (e.g. missing webhook secrets
// return 500 at the http route; missing Polar credentials fail closed in the
// provider layer).
export default defineApp({
	env: {
		CLERK_FRONTEND_API_URL: v.optional(v.string()),
		CLERK_WEBHOOK_SECRET: v.optional(v.string()),
		CLERK_JWT_ISSUER_DOMAIN: v.optional(v.string()),
		CLERK_SECRET_KEY: v.optional(v.string()),
		POLAR_WEBHOOK_SECRET: v.optional(v.string()),
		POLAR_PRODUCT_ID: v.optional(v.string()),
		POLAR_ACCESS_TOKEN: v.optional(v.string()),
		POLAR_SERVER: v.optional(v.string()),
		SITE_URL: v.optional(v.string()),
		BREVO_API_KEY: v.optional(v.string())
	}
});
