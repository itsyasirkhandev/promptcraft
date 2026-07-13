"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  Tree,
  Database,
  LockKey,
} from "@phosphor-icons/react";
import { SignInButton, Show } from "@clerk/nextjs";
import ThemeToggle from "@/components/ThemeToggle";

const features = [
  {
    icon: LockKey,
    title: "Clerk Auth",
    description: "Clerk authentication with Convex token sync for seamless auth.",
  },
  {
    icon: ShieldCheck,
    title: "Authed/Private Guards",
    description: "Convention-based Convex function security out of the box.",
  },
  {
    icon: Tree,
    title: "Effect-TS",
    description: "Structured logging and typed errors on the backend.",
  },
  {
    icon: Database,
    title: "Zustand Store",
    description: "Persisted client state with Immer middleware.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col items-center">
      {/* Top bar with theme toggle */}
      <div className="flex w-full justify-end">
        <ThemeToggle />
      </div>

      {/* Hero */}
      <section className="mt-12 flex flex-col items-center gap-6 text-center sm:mt-20">
        <div className="flex items-center gap-4">
          <Image
            src="/convex.svg"
            alt="Convex logo"
            width={48}
            height={48}
            priority
          />
          <span className="text-3xl font-light text-slate-300 dark:text-slate-600">
            ×
          </span>
          <Image
            src="/nextjs-icon-light-background.svg"
            alt="Next.js logo"
            width={48}
            height={48}
            className="block dark:hidden"
            priority
          />
          <Image
            src="/nextjs-icon-dark-background.svg"
            alt="Next.js logo"
            width={48}
            height={48}
            className="hidden dark:block"
            priority
          />
        </div>

        <h1 className="font-heading text-5xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-6xl text-balance">
          Clerk, Convex, Nextjs Starter Template
        </h1>

        <p className="max-w-2xl text-lg leading-relaxed text-slate-500 dark:text-slate-400">
          A convention-heavy starter template for building real apps with Convex,
          Next.js, Clerk Auth, Effect-TS, and Zustand.
        </p>

        {/* CTA Buttons */}
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row">
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Open Dashboard →
            </Link>
          </Show>

          <Show when="signed-out">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Go to Dashboard →
            </Link>
            <SignInButton mode="modal">
              <button
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors duration-200 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <LockKey size={18} weight="bold" />
                Sign in
              </button>
            </SignInButton>
          </Show>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="mt-20 grid w-full gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <feature.icon
              size={28}
              weight="duotone"
              className="mb-3 text-emerald-600 dark:text-emerald-400"
            />
            <h3 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">
              {feature.title}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              {feature.description}
            </p>
          </div>
        ))}
      </section>

      {/* Footer tagline */}
      <p className="mt-16 pb-8 text-center font-mono text-xs text-slate-400 dark:text-slate-600">
        npx create-next-app → npx convex dev → build something real
      </p>
    </div>
  );
}
