'use client';

import Link from 'next/link';
import Image from 'next/image';
import { SignInButton, Show } from '@clerk/nextjs';

const LOGO_URL = '/logo.svg';

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

/**
 * Slim top bar for the public prompt use page.
 *
 * Renders application branding on the left and auth-aware actions on the
 * right: a Sign In / Sign Up button for unauthenticated visitors, and
 * Dashboard + Marketplace buttons for authenticated users.
 */
export function PublicPromptHeader() {
  return (
    <header className="sticky top-0 z-[70] backdrop-saturate-[180%] backdrop-blur-[10px] bg-[rgba(245,245,245,0.7)]">
      <div className="max-w-[1100px] mx-auto px-10 py-5 flex items-center justify-between relative">
        {/* Dashed bottom border */}
        <div className="nexto-dashed absolute left-10 right-10 bottom-0" />

        <Link
          href="/"
          className="flex items-center gap-[9px]"
          aria-label="Prompt Crafts home"
        >
          <Image src={LOGO_URL} alt="" width={28} height={28} className="h-7 w-auto brightness-0" />
          <span className="text-[20px] font-bold tracking-[-0.3px] text-[#111]">
            Prompt Crafts
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <SignInButton
              mode="modal"
              fallbackRedirectUrl="/dashboard"
              signUpFallbackRedirectUrl="/dashboard"
            >
              <button
                type="button"
                className="nexto-pill-dark lg"
                aria-label="Sign In / Sign Up"
              >
                <span className="nexto-arrow-circ lg">
                  <ChevronArrow />
                </span>
                Sign In / Sign Up
              </button>
            </SignInButton>
          </Show>

          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="nexto-pill-dark lg"
              aria-label="Go to Dashboard"
            >
              <span className="nexto-arrow-circ lg">
                <ChevronArrow />
              </span>
              Go to Dashboard
            </Link>
            <Link
              href="/marketplace"
              className="nexto-pill-dark lg"
              aria-label="Browse marketplace"
            >
              <span className="nexto-arrow-circ lg">
                <ChevronArrow />
              </span>
              Marketplace
            </Link>
          </Show>
        </div>
      </div>
    </header>
  );
}
