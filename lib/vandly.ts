/**
 * Builds the Vandly checkout URL, optionally pre-filling the customer email.
 * Shared between the upgrade page and billing page so the URL construction
 * logic lives in one place.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getVandlyCheckoutUrl(_email?: string): string {
	return (
		process.env.NEXT_PUBLIC_VANDLY_CHECKOUT_URL ||
		"https://stg-app.vandly.co/checkout/pay_aa56e06fa51495015f2b8ce3461bbd1f?interval=month"
	);
}
