"use client";

import { SignInButton, Show, ClerkLoading, ClerkLoaded } from "@clerk/nextjs";
import { LockKey } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  return (
    <>
      <ClerkLoading>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-800 border-t-emerald-500 animate-spin"></div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
          </div>
        </div>
      </ClerkLoading>
      
      <ClerkLoaded>
        <Show when="signed-in">
          {children}
        </Show>
        
        <Show when="signed-out">
          <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-8 max-w-sm text-center px-6">
              <div className="flex items-center gap-3">
                <Image src="/convex.svg" alt="Convex Logo" width={40} height={40} />
                <div className="w-px h-10 bg-slate-300 dark:bg-slate-600"></div>
                <Image
                  src="/nextjs-icon-light-background.svg"
                  alt="Next.js Logo"
                  width={40}
                  height={40}
                  className="dark:hidden"
                />
                <Image
                  src="/nextjs-icon-dark-background.svg"
                  alt="Next.js Logo"
                  width={40}
                  height={40}
                  className="hidden dark:block"
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                  Sign in required
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Please sign in to access this page.
                </p>
              </div>
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium px-6 py-3 rounded-full cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  <LockKey size={18} weight="bold" />
                  <span>Sign in</span>
                </button>
              </SignInButton>
              <Link
                href="/"
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                ← Back to home
              </Link>
            </div>
          </div>
        </Show>
      </ClerkLoaded>
    </>
  );
}
