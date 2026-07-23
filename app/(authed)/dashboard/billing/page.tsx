"use client";

import { CheckCircle, Spinner } from "@phosphor-icons/react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { POLAR_PRODUCT_ID } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";

export default function BillingPage() {
  const user = useQuery(api.authed.users.currentUser);

  if (user === undefined || user === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
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

function HobbyBilling() {
  const usage = useQuery(api.authed.prompts.getUsage);
  const generateCheckoutUrl = useAction(api.authed.billing.generateCheckoutUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loading, Pro, and unauthenticated states render nothing so the cards
  // never flash stale content. The parent already gates on the user query.
  if (
    usage === undefined ||
    usage.plan !== "hobby" ||
    usage.promptsLimit === null
  ) {
    return null;
  }

  const promptsPct = Math.min(
    100,
    Math.round((usage.promptsUsed / usage.promptsLimit) * 100)
  );
  const promptsRemaining = Math.max(0, usage.promptsLimit - usage.promptsUsed);
  const publicPct = usage.publicLimit
    ? Math.min(100, Math.round((usage.publicUsed / usage.publicLimit) * 100))
    : 0;
  const publicRemaining = Math.max(
    0,
    (usage.publicLimit ?? 0) - usage.publicUsed
  );

  const handleCheckout = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await generateCheckoutUrl({
        productId: POLAR_PRODUCT_ID,
        successUrl: `${window.location.origin}/dashboard`,
      });
      if (!result?.url) throw new Error("No URL returned");
      window.location.assign(result.url);
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setPending(false);
    }
  };

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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Prompts created</span>
              <span className="font-medium tabular-nums">
                {usage.promptsUsed} / {usage.promptsLimit}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-label="Prompts used"
              aria-valuenow={promptsPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${promptsPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {promptsRemaining} prompts remaining
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Public prompts</span>
              <span className="font-medium tabular-nums">
                {usage.publicUsed} / {usage.publicLimit}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-label="Public prompts used"
              aria-valuenow={publicPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${publicPct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {publicRemaining} public prompts remaining
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upgrade to Pro</CardTitle>
          <CardDescription>
            Unlock everything you need to scale your prompt library.
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
          <Button
            onClick={handleCheckout}
            disabled={pending}
            aria-disabled={pending}
            aria-busy={pending}
            className="self-start bg-[#111] text-white hover:bg-[#222] disabled:opacity-60"
          >
            {pending ? "Securing checkout…" : "Continue to checkout"}
          </Button>

          {/* Full-screen blocking overlay while checkout URL is being generated */}
          <Dialog open={pending}>
            <DialogPortal>
              <DialogOverlay className="z-[100] bg-black/60 backdrop-blur-sm" />
              <DialogContent
                showCloseButton={false}
                className="z-[101] flex w-fit flex-col items-center gap-4 border-none bg-transparent p-12 shadow-none sm:max-w-none"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
              >
                <Spinner
                  className="size-8 animate-spin text-white"
                  aria-hidden="true"
                />
                <p className="text-sm text-white/80 font-medium">
                  Securing checkout…
                </p>
              </DialogContent>
            </DialogPortal>
          </Dialog>

        </CardContent>
      </Card>
    </>
  );
}

function ProBilling() {
  const generatePortalUrl = useAction(api.authed.billing.generatePortalUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePortal = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await generatePortalUrl();
      if (!result?.url) throw new Error("No URL returned");
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
          Update payment methods, change plans, or cancel your subscription via the Polar customer portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <span role="alert" aria-live="polite" className="text-xs text-red-600">
            {error}
          </span>
        )}
        <Button
          onClick={handlePortal}
          disabled={pending}
          aria-disabled={pending}
          aria-busy={pending}
          className="self-start bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Loading portal…" : "Manage Subscription"}
        </Button>
      </CardContent>
    </Card>
  );
}
