"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { SignInButton, Show, ClerkLoaded, ClerkLoading } from "@clerk/nextjs";

const LOGO_URL = "/logo.svg";

function handleScroll(e: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
  const element = document.getElementById(targetId);
  if (element) {
    e.preventDefault();
    element.scrollIntoView({ behavior: "smooth" });
  }
}

function ChevronArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
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

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-[9px]" aria-label="Prompt Crafts home">
      <Image src={LOGO_URL} alt="" width={28} height={28} className="h-7 w-auto brightness-0" />
      <span className="text-[20px] font-bold tracking-[-0.3px] text-[#111]">Prompt Crafts</span>
    </Link>
  );
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      document.body.style.height = "100%";
      document.documentElement.style.height = "100%";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.body.style.height = "";
      document.documentElement.style.height = "";
    };
  }, [menuOpen]);

  return (
    <>
      <nav className="sticky top-0 z-[70] backdrop-saturate-[180%] backdrop-blur-[10px] bg-[rgba(245,245,245,0.7)]">
        <div className="max-w-[1100px] mx-auto px-10 py-6 flex items-center justify-between relative">
          {/* Dashed bottom border */}
          <div className="nexto-dashed absolute left-10 right-10 bottom-0" />

          <Logo />

          <ul className="hidden md:flex items-center gap-9 list-none">
            {["Marketplace", "Pricing", "Process"].map((item) => (
              <li key={item}>
                <Link
                  href={item === "Marketplace" ? "/marketplace" : `/#${item.toLowerCase().replace(/\s/g, "-")}`}
                  onClick={item === "Marketplace" ? undefined : (e) => handleScroll(e, item.toLowerCase().replace(/\s/g, "-"))}
                  className="text-[14px] font-normal text-[#1a1a1a] opacity-65 hover:opacity-100 transition-opacity"
                >
                  {item}
                </Link>
              </li>
            ))}
          </ul>

          <ClerkLoading>
            <button type="button" className="nexto-pill-dark hidden md:inline-flex opacity-0 pointer-events-none" aria-hidden="true">
              <span className="nexto-arrow-circ">
                <ChevronArrow />
              </span>
              Sign In / Sign Up
            </button>
          </ClerkLoading>
          <ClerkLoaded>
            <Show when="signed-out">
              <SignInButton mode="modal" fallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
                <button
                  type="button"
                  className="nexto-pill-dark hidden md:inline-flex"
                  aria-label="Sign In / Sign Up"
                >
                  <span className="nexto-arrow-circ">
                    <ChevronArrow />
                  </span>
                  Sign In / Sign Up
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="nexto-pill-dark hidden md:inline-flex"
                aria-label="Go to Dashboard"
              >
                <span className="nexto-arrow-circ">
                  <ChevronArrow />
                </span>
                Go to Dashboard
              </Link>
            </Show>
          </ClerkLoaded>

          {/* Hamburger */}
          <button
            type="button"
            className="flex md:hidden flex-col gap-[6px] w-6 h-6 justify-center items-center cursor-pointer z-[61] relative"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span
              className={`block w-6 h-[2px] bg-[#111] rounded-sm transition-transform duration-300 ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
            />
            <span
              className={`block w-6 h-[2px] bg-[#111] rounded-sm transition-opacity duration-200 ${menuOpen ? "opacity-0" : ""}`}
            />
            <span
              className={`block w-6 h-[2px] bg-[#111] rounded-sm transition-transform duration-300 ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
            />
          </button>
        </div>
      </nav>

      {/* Mobile nav */}
      <div
        className={`fixed inset-0 bg-[#F5F5F5] z-[60] flex flex-col px-8 pt-[90px] pb-10 transition-transform duration-500 ease-[cubic-bezier(0.77,0,0.175,1)] ${menuOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        {["Marketplace", "Pricing", "Process"].map((item) => (
          <Link
            key={item}
            href={item === "Marketplace" ? "/marketplace" : `/#${item.toLowerCase().replace(/\s/g, "-")}`}
            className="text-[38px] font-black tracking-[-1.5px] text-[#0f0f0f] py-6 border-b border-dashed border-black/15"
            onClick={item === "Marketplace" ? () => setMenuOpen(false) : (e) => {
              setMenuOpen(false);
              handleScroll(e, item.toLowerCase().replace(/\s/g, "-"));
            }}
          >
            {item}
          </Link>
        ))}
        <ClerkLoading>
          <button type="button" tabIndex={-1} className="nexto-pill-dark lg mt-6 self-start opacity-0 pointer-events-none" aria-hidden="true">
            <span className="nexto-arrow-circ lg">
              <ChevronArrow />
            </span>
            Sign In / Sign Up
          </button>
        </ClerkLoading>
        <ClerkLoaded>
          <Show when="signed-out">
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
              <button
                type="button"
                className="nexto-pill-dark lg mt-6 self-start"
                onClick={() => setMenuOpen(false)}
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
              className="nexto-pill-dark lg mt-6 self-start"
              onClick={() => setMenuOpen(false)}
            >
              <span className="nexto-arrow-circ lg">
                <ChevronArrow />
              </span>
              Go to Dashboard
            </Link>
          </Show>
        </ClerkLoaded>
      </div>
    </>
  );
}
