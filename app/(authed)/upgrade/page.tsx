"use client";

import { useCallback, useState } from "react";
import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { POLAR_PRODUCT_ID } from "@/lib/billing";
import { getVandlyCheckoutUrl } from "@/lib/vandly";
import { CheckCircle, CreditCard, Sparkle } from "@phosphor-icons/react";

/** Validates that a redirect URL points to a trusted origin (same-origin or known payment providers). */
function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Allow same-origin redirects
    if (parsed.origin === window.location.origin) return true;
    // Allow known payment provider domains
    const trustedHosts = ["polar.sh", "api.polar.sh", "checkout.polar.sh"];
    return trustedHosts.some(
      (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

// ─── Checkout option card ─────────────────────────────────────────────────────
// Extracts the repeated card layout shared by Vandly and Polar options so
// each only declares its unique content/action.

function CheckoutOptionCard({
  icon,
  title,
  badgeLabel,
  badgeColor,
  description,
  features,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  badgeLabel: string;
  badgeColor: string;
  description: string;
  features: string[];
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm hover:shadow-md transition-all">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          <span
            className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeColor}`}
          >
            {badgeLabel}
          </span>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
        <ul className="space-y-2 pt-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
            >
              <CheckCircle className="size-4 text-emerald-500" weight="fill" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6">{action}</div>
    </div>
  );
}

// fallow-ignore-next-line code-duplication
export default function UpgradePage() {
  const user = useQuery(api.authed.users.currentUser);
  // fallow-ignore-next-line code-duplication
  const generateCheckoutUrl = useAction(api.authed.billing.generateCheckoutUrl);

  const [polarPending, setPolarPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePolarCheckout = useCallback(() => {
    setPolarPending(true);
    setError(null);
    generateCheckoutUrl({
      productId: POLAR_PRODUCT_ID,
      successUrl: `${window.location.origin}/dashboard`,
    })
      .then((result) => {
        if (result?.url && isSafeRedirectUrl(result.url)) {
          // fallow-ignore-next-line security-sink
          window.location.assign(result.url);
        } else {
          setPolarPending(false);
          setError("We couldn't start Polar checkout. Please try again.");
        }
      })
      .catch(() => {
        setPolarPending(false);
        setError("We couldn't start Polar checkout. Please try again.");
      });
  }, [generateCheckoutUrl]);

  if (user === undefined || user === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-4"
        >
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-emerald-500 animate-spin"
          />
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            Preparing your upgrade options…
          </h1>
        </div>
      </div>
    );
  }

  const vandlyUrl = getVandlyCheckoutUrl(user.email);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 py-12 px-6">
      <div className="text-center max-w-xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkle className="size-4" weight="fill" /> Upgrade to Pro
        </div>
        <h1 className="font-heading text-3xl font-extrabold text-slate-900 dark:text-slate-100 sm:text-4xl">
          Choose your payment method
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
          Unlock unlimited prompts and public sharing with your preferred provider.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-4 rounded-xl bg-red-500/10 text-red-600 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        <CheckoutOptionCard
          icon={<CreditCard className="size-6 text-indigo-500" />}
          title="Vandly Checkout"
          badgeLabel="Recommended Regional"
          badgeColor="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
          description="Pay via Vandly subscription for quick regional payment processing."
          features={["Instant Pro access", "Flexible payment options"]}
          action={
            <a
              href={vandlyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors shadow-sm"
            >
              Pay with Vandly
            </a>
          }
        />

        <CheckoutOptionCard
          icon={<CreditCard className="size-6 text-emerald-500" />}
          title="Polar Checkout"
          badgeLabel="Global Stripe"
          badgeColor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          description="Pay via Polar subscription with global card support and self-serve customer portal."
          features={["Instant Pro access", "Manage via customer portal"]}
          action={
            <button
              type="button"
              onClick={handlePolarCheckout}
              disabled={polarPending}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm disabled:opacity-60"
            >
              {polarPending ? "Securing checkout…" : "Pay with Polar"}
            </button>
          }
        />
      </div>

      <Link
        href="/dashboard"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 underline-offset-4 hover:underline"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
