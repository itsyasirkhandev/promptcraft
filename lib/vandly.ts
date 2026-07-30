/**
 * Builds the Vandly checkout URL, optionally pre-filling the customer email.
 * Shared between the upgrade page and billing page so the URL construction
 * logic lives in one place.
 */
export function getVandlyCheckoutUrl(email?: string): string {
	const baseUrl =
		process.env.NEXT_PUBLIC_VANDLY_CHECKOUT_URL ||
		"https://stg-app.vandly.co/checkout/pay_aa56e06fa51495015f2b8ce3461bbd1f?interval=month";
	if (!email) return baseUrl;
	const separator = baseUrl.includes("?") ? "&" : "?";
	return `${baseUrl}${separator}customerEmail=${encodeURIComponent(email)}`;
}
