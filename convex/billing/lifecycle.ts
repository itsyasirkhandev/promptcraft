// [Phase 2] Pure lifecycle mapping — no SDK/network dependency.
// Per spec 3.6: entitlement derives from the subscription CURRENT state,
// not merely the webhook event name.

export type Plan = "hobby" | "pro";

/**
 * Map a Polar subscription's current status to the Promptcraft plan.
 *
 * Rules (spec 3.6):
 * - Active paid access, including scheduled-to-cancel at period end: "pro"
 * - Past due (Polar retrying payment): "pro" (retain during retry window)
 * - Uncanceled / reactivated and active: "pro" (covered by status === "active")
 * - Fully canceled, revoked, or unpaid: "hobby" (terminal downgrade)
 * - Unknown/intermediate status (incomplete, trialing, etc.): return null so the
 *   caller preserves the existing plan instead of changing it prematurely.
 */
export function mapSubscriptionToPlan(status: string): Plan | null {
	switch (status) {
		case "active":
		case "past_due":
			return "pro";
		case "canceled":
		case "unpaid":
		case "revoked":
			return "hobby";
		default:
			return null;
	}
}

// ponytail: trialing grants Pro access once configured; upgrade this mapping when the Pro product introduces a trial.