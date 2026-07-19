"use client";

import { useUser } from "@clerk/nextjs";
import { ChartBar, Eye, FileText, Sparkle } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { api } from "@/convex/_generated/api";
import DashboardSkeleton from "@/components/skeletons/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Lazy-load the chart sections so recharts only ships to the browser when
// the user actually has prompts to chart. Keeps the initial bundle lean.
const DashboardCharts = dynamic(
  () => import("./_components/DashboardCharts").then((m) => m.DashboardCharts),
  { ssr: false }
);

export default function DashboardPage() {
  const user = useUser();
  const analytics = useQuery(api.authed.promptAnalytics.getInventoryAnalytics);

  if (analytics === undefined) return <DashboardSkeleton />;

  const displayName = user.user?.firstName ?? user.user?.fullName ?? user.user?.username;
  const stats = [
    { label: "Total Prompts", value: analytics.summary.totalPrompts, icon: FileText },
    { label: "Public Prompts", value: analytics.summary.publicPrompts, icon: Eye },
    { label: "Template Prompts", value: analytics.summary.templatePrompts, icon: Sparkle },
    { label: "Created in Last 30 Days", value: analytics.summary.createdLast30Days, icon: ChartBar },
  ];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-800 dark:text-slate-200">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Welcome back{displayName ? ", " + displayName : ""}!
        </p>
      </div>

      <section aria-label="Prompt summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardDescription>{stat.label}</CardDescription>
              <stat.icon aria-hidden="true" className="size-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <HobbyUsageCard />

      {analytics.summary.totalPrompts === 0 ? (
        <Card className="min-h-80 justify-center">
          <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <ChartBar aria-hidden="true" className="size-6 text-muted-foreground" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="font-heading text-xl font-semibold">Your analytics will appear here</h2>
              <p className="text-sm text-muted-foreground">
                Create your first prompt to start seeing creation trends and library distributions.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/prompt/create">Create your first prompt</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DashboardCharts analytics={analytics} />
      )}
    </div>
  );
}

function HobbyUsageCard() {
  const usage = useQuery(api.authed.prompts.getUsage);

  // Loading, Pro, and unauthenticated states render nothing so the card
  // never flashes stale content. The header pill already covers Pro/loading.
  if (usage === undefined || usage.plan !== "hobby" || usage.promptsLimit === null) return null;

  const promptsRemaining = Math.max(0, usage.promptsLimit - usage.promptsUsed);
  const publicRemaining = Math.max(0, (usage.publicLimit ?? 0) - usage.publicUsed);
  const promptsPct = Math.min(100, Math.round((usage.promptsUsed / usage.promptsLimit) * 100));
  const publicPct = usage.publicLimit ? Math.min(100, Math.round((usage.publicUsed / usage.publicLimit) * 100)) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hobby plan usage</CardTitle>
        <CardDescription>
          You&apos;re on the free Hobby plan. Upgrade to Pro for unlimited prompts and public sharing.
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
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Prompts used" aria-valuenow={promptsPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${promptsPct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{promptsRemaining} prompts remaining</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Public prompts</span>
            <span className="font-medium tabular-nums">
              {usage.publicUsed} / {usage.publicLimit}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden" role="progressbar" aria-label="Public prompts used" aria-valuenow={publicPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${publicPct}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{publicRemaining} public prompts remaining</span>
        </div>

        <Button asChild size="sm" className="self-start">
          <Link href="/upgrade">Upgrade to Pro</Link>
        </Button>
      </CardContent>
    </Card>
  );
}