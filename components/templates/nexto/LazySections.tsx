"use client";

import dynamic from "next/dynamic";

const Process = dynamic(
  () => import("@/components/templates/nexto/sections/Process"),
  { ssr: false }
);
const Pricing = dynamic(
  () => import("@/components/templates/nexto/sections/Pricing"),
  { ssr: false }
);
const CTA = dynamic(
  () => import("@/components/templates/nexto/sections/CTA"),
  { ssr: false }
);
const Footer = dynamic(
  () => import("@/components/templates/nexto/sections/Footer"),
  { ssr: false }
);

export function LazyProcess() {
  return <Process />;
}

export function LazyPricing() {
  return <Pricing />;
}

export function LazyCTA() {
  return <CTA />;
}

export function LazyFooter() {
  return <Footer />;
}
