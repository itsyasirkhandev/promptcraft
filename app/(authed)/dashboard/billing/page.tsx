"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { POLAR_PRODUCT_ID } from "@/lib/billing";
import { getVandlyCheckoutUrl } from "@/lib/vandly";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckoutLoadingDialog } from "@/components/checkout-loading-dialog";
import { UsageProgressBar } from "@/components/usage-progress-bar";

export default function BillingPage() {
  const user = useQuery(api.authed.users.currentUser);

  if (user === undefined || user === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen/2 gap-4">
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-emerald-500 animate-spin"
        />
        <span className="text-sm text-slate-500 dark:text-slate-400">
          Loading billing…
        </span>
      </div>
    );
  }

  const isPro = user.plan === "pro";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-800 dark:text-slate-200">
          Billing
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage your subscription and usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            {isPro
              ? "You're on the Pro plan with unlimited prompts and public sharing."
              : "You're on the free Hobby plan."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={isPro ? "default" : "secondary"}>
            {isPro ? "Pro" : "Hobby"}
          </Badge>
        </CardContent>
      </Card>

      {isPro ? <ProBilling /> : <HobbyBilling />}
    </div>
  );
}

// fallow-ignore-next-line code-duplication
function HobbyBilling() {
  const user = useQuery(api.authed.users.currentUser);
  // fallow-ignore-next-line code-duplication
  const usage = useQuery(api.authed.prompts.getUsage);
  const generateCheckoutUrl = useAction(api.authed.billing.generateCheckoutUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (
    usage === undefined ||
    usage.plan !== "hobby" ||
    usage.promptsLimit === null
  ) {
    return null;
  }

  const handlePolarCheckout = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await generateCheckoutUrl({
        productId: POLAR_PRODUCT_ID,
        successUrl: `${window.location.origin}/dashboard`,
      });
      if (!result?.url) throw new Error("No URL returned");
      // fallow-ignore-next-line security-sink
      window.location.assign(result.url);
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setPending(false);
    }
  };

  const vandlyUrl = getVandlyCheckoutUrl(user?.email);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Plan usage</CardTitle>
          <CardDescription>
            Upgrade to Pro for unlimited prompts and public sharing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <UsageProgressBar
            label="Prompts created"
            used={usage.promptsUsed}
            limit={usage.promptsLimit}
            remainingLabel="prompts remaining"
          />
          <UsageProgressBar
            label="Public prompts"
            used={usage.publicUsed}
            limit={usage.publicLimit ?? 0}
            remainingLabel="public prompts remaining"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upgrade to Pro</CardTitle>
          <CardDescription>
            Choose your preferred checkout provider to upgrade.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2">
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-emerald-500"
              />
              <span>Create unlimited prompts</span>
            </li>
            <li className="flex items-start gap-2 text-sm">
              <CheckCircle
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-emerald-500"
              />
              <span>Share unlimited public prompts</span>
            </li>
          </ul>
          {error && (
            <span role="alert" aria-live="polite" className="text-xs text-red-600">
              {error}
            </span>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <a
              href={vandlyUrl}
              className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition-colors"
            >
              Pay with Vandly
            </a>
            <Button
              onClick={handlePolarCheckout}
              disabled={pending}
              aria-disabled={pending}
              aria-busy={pending}
              className="w-full sm:w-auto bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "Securing checkout…" : "Pay with Polar"}
            </Button>
          </div>

          <CheckoutLoadingDialog
            open={pending}
            message="Securing checkout…"
          />
        </CardContent>
      </Card>
    </>
  );
}

// fallow-ignore-next-line code-duplication
function ProBilling() {
  const user = useQuery(api.authed.users.currentUser);
  // fallow-ignore-next-line code-duplication
  const generatePortalUrl = useAction(api.authed.billing.generatePortalUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPolarActive = user?.polarSubscriptionStatus === "active";
  const isVandlyActive = user?.vandlySubscriptionStatus === "active";

  const handlePortal = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await generatePortalUrl();
      if (!result?.url) throw new Error("No URL returned");
      // fallow-ignore-next-line security-sink
      window.location.assign(result.url);
    } catch {
      setError("Couldn't open the subscription portal. Please try again.");
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage subscription</CardTitle>
        <CardDescription>
          Your active payment provider and subscription status.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          {isVandlyActive && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-sm">
              <span className="font-medium text-indigo-700 dark:text-indigo-300">
                Vandly Subscription
              </span>
              <Badge className="bg-indigo-600">Active</Badge>
            </div>
          )}

          {isPolarActive && (
            <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-sm">
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                Polar Subscription
              </span>
              <Badge className="bg-emerald-600">Active</Badge>
            </div>
          )}

          {!isPolarActive && !isVandlyActive && (
            <div className="text-sm text-slate-500">
              Pro plan active
            </div>
          )}
        </div>

        {error && (
          <span role="alert" aria-live="polite" className="text-xs text-red-600">
            {error}
          </span>
        )}

        {isPolarActive && (
          <Button
            onClick={handlePortal}
            disabled={pending}
            aria-disabled={pending}
            aria-busy={pending}
            className="self-start bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 mt-2"
          >
            {pending ? "Loading portal…" : "Manage Polar Subscription"}
          </Button>
        )}

        <CheckoutLoadingDialog
          open={pending}
          message="Loading portal…"
        />
      </CardContent>
    </Card>
  );
}
