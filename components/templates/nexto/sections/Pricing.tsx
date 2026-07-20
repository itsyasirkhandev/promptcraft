"use client";

import { SignInButton, Show, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";
import { useQuery, useAction } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { POLAR_PRODUCT_ID } from "@/lib/billing";

function ChevronArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const UPGRADE_PATH = "/upgrade";

type BillingActionName = "checkout" | "portal";

function useBillingRedirect() {
  const [pending, setPending] = useState<BillingActionName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generateCheckoutUrl = useAction(api.authed.billing.generateCheckoutUrl);
  const generatePortalUrl = useAction(api.authed.billing.generatePortalUrl);

  async function run(name: BillingActionName) {
    if (pending) return;
    setPending(name);
    setError(null);
    try {
      const result =
        name === "checkout"
          ? await generateCheckoutUrl({
              productId: POLAR_PRODUCT_ID,
              successUrl: `${window.location.origin}/dashboard`,
            })
          : await generatePortalUrl();
      if (!result?.url) {
        throw new Error("No URL returned");
      }
      window.location.assign(result.url);
    } catch {
      setError(
        name === "checkout"
          ? "Couldn't start checkout. Please try again."
          : "Couldn't open the subscription portal. Please try again."
      );
      setPending(null);
    }
  }

  return { pending, error, run, clearError: () => setError(null) };
}

function HobbyCardCta({ isPro }: { isPro: boolean }) {
  if (isPro) {
    return (
      <button
        type="button"
        className="nexto-pill-dark w-full justify-center opacity-60 cursor-default"
        disabled
        aria-disabled="true"
      >
        <span className="nexto-arrow-circ">
          <ChevronArrow />
        </span>
        Hobby Plan
      </button>
    );
  }
  return (
    <button
      type="button"
      className="nexto-pill-dark w-full justify-center opacity-60 cursor-default"
      disabled
      aria-disabled="true"
    >
      <span className="nexto-arrow-circ">
        <ChevronArrow />
      </span>
      Current Plan
    </button>
  );
}

function ProCardCta() {
  const user = useQuery(api.authed.users.currentUser);
  const billing = useBillingRedirect();
  const isPro = user?.plan === "pro";
  const loading = user === undefined;
  const pendingCheckout = billing.pending === "checkout";
  const pendingPortal = billing.pending === "portal";

  if (loading) {
    return (
      <button
        type="button"
        className="nexto-pill-dark w-full justify-center opacity-60"
        disabled
        aria-disabled="true"
        aria-busy="true"
      >
        <span className="nexto-arrow-circ">
          <ChevronArrow />
        </span>
        Loading…
      </button>
    );
  }

  const onUpgrade = () => billing.run("checkout");
  const onManage = () => billing.run("portal");

  return (
    <div>
      {isPro ? (
        <button
          type="button"
          className="nexto-pill-dark w-full justify-center disabled:opacity-60"
          onClick={onManage}
          disabled={pendingPortal}
          aria-disabled={pendingPortal}
          aria-busy={pendingPortal}
        >
          <span className="nexto-arrow-circ">
            <ChevronArrow />
          </span>
          {pendingPortal ? "Loading portal…" : "Manage Subscription"}
        </button>
      ) : (
        <button
          type="button"
          className="nexto-pill-dark w-full justify-center disabled:opacity-60"
          onClick={onUpgrade}
          disabled={pendingCheckout}
          aria-disabled={pendingCheckout}
          aria-busy={pendingCheckout}
        >
          <span className="nexto-arrow-circ">
            <ChevronArrow />
          </span>
          {pendingCheckout ? "Securing checkout…" : "Upgrade to Pro"}
        </button>
      )}
      {billing.error && (
        <p
          role="alert"
          aria-live="polite"
          className="mt-2 text-[12.5px] text-red-600 text-center"
        >
          {billing.error}
        </p>
      )}
    </div>
  );
}

function AuthedPricing() {
  const user = useQuery(api.authed.users.currentUser);
  const isPro = user?.plan === "pro";
  const loading = user === undefined;

  return (
    <>
      <div className="mt-8">
        {loading ? (
          <button
            type="button"
            className="nexto-pill-dark w-full justify-center opacity-60"
            disabled
            aria-hidden="true"
          >
            <span className="nexto-arrow-circ">
              <ChevronArrow />
            </span>
            Loading…
          </button>
        ) : (
          <HobbyCardCta isPro={isPro} />
        )}
      </div>
    </>
  );
}

type PricingCardProps = {
  name: string;
  description: string;
  price: string;
  priceSuffix?: string;
  features: string[];
  ctaLabel: string;
  fallbackRedirectUrl: string;
  signedInCta: React.ReactNode;
  cardClassName: string;
  popular?: boolean;
};

function PricingCard({
  name,
  description,
  price,
  priceSuffix,
  features,
  ctaLabel,
  fallbackRedirectUrl,
  signedInCta,
  cardClassName,
  popular,
}: PricingCardProps) {
  return (
    <div className={cardClassName}>
      {popular && (
        <div className="absolute top-4 right-4 bg-[#111] text-white text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
          Popular
        </div>
      )}

      <div>
        <div className="flex justify-between items-start">
          <div>
            <h4 className="text-[22px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
              {name}
            </h4>
            <p className="text-[13.5px] text-[#888] mt-2 min-h-[40px]">
              {description}
            </p>
          </div>
          <div className={`text-right${priceSuffix ? " flex flex-col" : ""}`}>
            <span className="text-[32px] font-bold text-[#111]">{price}</span>
            {priceSuffix && (
              <span className="text-[11px] text-[#888] font-medium -mt-1">
                {priceSuffix}
              </span>
            )}
          </div>
        </div>

        <div className="nexto-dashed my-6" />

        <ul className="space-y-4">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-3 text-[14px] text-[#1a1a1a]"
            >
              <span className="nexto-icon text-[18px] text-emerald-600">check_circle</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <ClerkLoading>
          <button type="button" tabIndex={-1} className="nexto-pill-dark w-full justify-center opacity-0 pointer-events-none" aria-hidden="true">
            <span className="nexto-arrow-circ">
              <ChevronArrow />
            </span>
            {ctaLabel}
          </button>
        </ClerkLoading>
        <ClerkLoaded>
          <Show when="signed-out">
            <SignInButton mode="modal" fallbackRedirectUrl={fallbackRedirectUrl} signUpFallbackRedirectUrl={fallbackRedirectUrl}>
              <button type="button" className="nexto-pill-dark w-full justify-center">
                <span className="nexto-arrow-circ">
                  <ChevronArrow />
                </span>
                {ctaLabel}
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            {signedInCta}
          </Show>
        </ClerkLoaded>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <section className="nexto-section" id="pricing">
      <div className="nexto-wrap">
        <div className="nexto-section-head text-center max-w-[600px] mx-auto mb-16">
          <span className="nexto-eyebrow">PRICING</span>
          <h2 className="mt-[18px]">
            Simple pricing.{" "}
            <em className="italic font-light">Upgrade as you grow.</em>
          </h2>
          <p className="nexto-section-lede mt-4">
            Start for free with no credit card required. Unlock unlimited potential when you are ready.
          </p>
        </div>

        <div className="grid gap-8 grid-cols-1 md:grid-cols-2 max-w-[840px] mx-auto">
          <PricingCard
            name="Hobby"
            description="Perfect for getting started with prompt engineering."
            price="$0"
            features={["Up to 30 Prompts", "Share 10 Prompts Publicly"]}
            ctaLabel="Start for Free"
            fallbackRedirectUrl="/dashboard"
            signedInCta={<AuthedPricing />}
            cardClassName="nexto-card flex flex-col justify-between p-8 border border-black/5 bg-white rounded-[22px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] relative"
          />

          <PricingCard
            name="Pro"
            description="For power users and professional prompt engineers."
            price="$5"
            priceSuffix="/mo"
            features={["Unlimited Prompts", "Unlimited Public Shares"]}
            ctaLabel="Get Pro Access"
            fallbackRedirectUrl={UPGRADE_PATH}
            signedInCta={<ProCardCta />}
            cardClassName="nexto-card flex flex-col justify-between p-8 border-2 border-[#111] bg-white rounded-[22px] shadow-[0_4px_20px_rgba(0,0,0,0.06)] relative overflow-hidden"
            popular
          />
        </div>
      </div>
    </section>
  );
}