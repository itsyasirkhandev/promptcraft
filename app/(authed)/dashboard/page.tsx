"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function DashboardPage() {
  const viewer = useQuery(api.authed.users.currentUser);

  if (viewer === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
          <div
            className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.1s" }}
          ></div>
          <div
            className="w-2 h-2 bg-slate-600 rounded-full animate-bounce"
            style={{ animationDelay: "0.2s" }}
          ></div>
          <p className="ml-2 text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-200 font-heading">
          Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
          Welcome back{viewer?.name ? `, ${viewer.name}` : ""}!
        </p>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800"></div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-200">
          User Information
        </h2>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-2 text-sm text-slate-600 dark:text-slate-400">
          <p><span className="font-semibold text-slate-800 dark:text-slate-200">Name:</span> {viewer?.name}</p>
          <p><span className="font-semibold text-slate-800 dark:text-slate-200">Email:</span> {viewer?.email}</p>
          <p><span className="font-semibold text-slate-800 dark:text-slate-200">Plan:</span> <span className="capitalize font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">{viewer?.plan}</span></p>
        </div>
      </div>

      <div className="h-px bg-slate-200 dark:bg-slate-800"></div>

      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg text-slate-800 dark:text-slate-200">
          Making changes
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">
          Edit{" "}
          <code className="text-sm font-semibold font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
            app/(authed)/dashboard/page.tsx
          </code>{" "}
          to change the frontend.
        </p>
      </div>
    </div>
  );
}
