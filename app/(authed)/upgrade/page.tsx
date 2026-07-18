"use client";

// [Phase 7] Fixed internal upgrade-continuation route (spec 3.4 / 4.3).
// Signed-out visitors who clicked the Pro CTA are sent here by Clerk's
// fallbackRedirectUrl after auth. We wait for the Convex user to sync, then
// invoke the authed checkout action exactly once and hard-redirect to the
// server-validated Polar URL. No redirect target is read from the URL/query —
// the only navigation is to the URL returned by the server action, so there is
// no open-redirect surface. Errors show a single retry action (no loop) and
// leave the user signed in.

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

type UpgradeStatus = "syncing" | "redirecting" | "error";

const RETRY_MESSAGE = "We couldn't start checkout. Please try again.";

export default function UpgradePage() {
  // currentUser is Doc<'users'> | null (does not create the user); the global
  // UserSyncTrigger fires getOrCreateUser on auth, after which this query
  // reactively resolves to the user doc. undefined = query loading;
  // null = authenticated but the Convex user isn't synced yet.
  const user = useQuery(api.authed.users.currentUser);
  const generateCheckoutUrl = useAction(api.authed.billing.generateCheckoutUrl);

  const [status, setStatus] = useState<UpgradeStatus>("syncing");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const runCheckout = useCallback(() => {
    setStatus("redirecting");
    setError(null);
    generateCheckoutUrl()
      .then((result) => {
        // generateCheckoutUrl routes Hobby->checkout and Pro->portal and
        // validates the returned URL is HTTPS Polar-hosted (Phase 4).
        if (result?.url) {
          window.location.assign(result.url);
        } else {
          setStatus("error");
          setError(RETRY_MESSAGE);
        }
      })
      .catch(() => {
        setStatus("error");
        setError(RETRY_MESSAGE);
      });
  }, [generateCheckoutUrl]);

  // Wait until the Convex user exists, then kick off checkout exactly once.
  useEffect(() => {
    if (user === undefined || user === null) return;
    if (startedRef.current) return; // StrictMode / re-render safe
    startedRef.current = true;
    runCheckout();
  }, [user, runCheckout]);

  const syncing = user === undefined || user === null;
  const pending = status === "syncing" || status === "redirecting";
  const label = syncing
    ? "Preparing your upgrade…"
    : status === "redirecting"
      ? "Securing checkout…"
      : "Checkout failed";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-col items-center gap-4"
      >
        {pending && (
          <div
            aria-hidden="true"
            className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-emerald-500 animate-spin"
          />
        )}
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          {label}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          {syncing
            ? "We're signing you in and preparing your upgrade. Hang tight."
            : status === "redirecting"
              ? "Redirecting you to Polar to complete your Pro subscription."
              : error}
        </p>
      </div>

      {status === "error" && (
        <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={runCheckout}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium px-6 py-3 rounded-full transition-colors shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-full"
          >
            Go to dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
