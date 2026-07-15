"use client";

import { useUser } from "@clerk/nextjs";
import { ChartBar, Eye, FileText, Sparkle } from "@phosphor-icons/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
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
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const trendConfig = {
  count: { label: "Prompts", color: "var(--chart-1)" },
} satisfies ChartConfig;

const visibilityConfig = {
  count: { label: "Prompts" },
  public: { label: "Public", color: "var(--chart-1)" },
  private: { label: "Private", color: "var(--chart-3)" },
} satisfies ChartConfig;

const promptTypeConfig = {
  count: { label: "Prompts" },
  template: { label: "Template", color: "var(--chart-2)" },
  static: { label: "Static", color: "var(--chart-4)" },
} satisfies ChartConfig;

const categoryConfig = {
  count: { label: "Prompts", color: "var(--chart-2)" },
} satisfies ChartConfig;

const formatShortDate = (date: string) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00Z"));

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
        <section aria-label="Prompt analytics" className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Prompts Created</CardTitle>
              <CardDescription>
                Daily prompt creation from {formatShortDate(analytics.period.startDate)} to{" "}
                {formatShortDate(analytics.period.endDate)} ({analytics.period.timezone}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={trendConfig} className="h-72 w-full aspect-auto">
                <AreaChart data={analytics.creationTrend} margin={{ left: 4, right: 12 }}>
                  <defs>
                    <linearGradient id="prompt-count-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    minTickGap={28}
                    tickFormatter={formatShortDate}
                  />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={28} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(_, payload) => formatShortDate(String(payload[0]?.payload?.date ?? ""))}
                      />
                    }
                  />
                  <Area
                    dataKey="count"
                    type="monotone"
                    fill="url(#prompt-count-fill)"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <DistributionCard
              title="Visibility"
              description="Public and private prompts in your library."
              data={analytics.visibility}
              config={visibilityConfig}
            />
            <DistributionCard
              title="Prompt Type"
              description="Template and static prompts in your library."
              data={analytics.promptTypes}
              config={promptTypeConfig}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Prompts by Category</CardTitle>
              <CardDescription>Your most-used prompt categories.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={categoryConfig} className="h-80 w-full aspect-auto">
                <BarChart
                  accessibilityLayer
                  data={analytics.categories}
                  layout="vertical"
                  margin={{ left: 8, right: 24 }}
                >
                  <CartesianGrid horizontal={false} />
                  <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    axisLine={false}
                    tickLine={false}
                    width={112}
                    tickFormatter={(label) => label.length > 16 ? label.slice(0, 15) + "…" : label}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} cursor={false} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={6} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function DistributionCard({
  title,
  description,
  data,
  config,
}: {
  title: string;
  description: string;
  data: ReadonlyArray<{ key: string; label: string; count: number }>;
  config: ChartConfig;
}) {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  const chartData = data.map((item) => ({ ...item, fill: "var(--color-" + item.key + ")" }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={config} className="mx-auto h-72 w-full max-w-md aspect-auto">
          <PieChart accessibilityLayer>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
            <Pie data={chartData} dataKey="count" nameKey="key" innerRadius={62} outerRadius={92} strokeWidth={4}>
              {chartData.map((item) => <Cell key={item.key} fill={item.fill} />)}
              <Label
                content={({ viewBox }) => {
                  if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) return null;
                  return (
                    <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                      <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                        {total}
                      </tspan>
                      <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                        Prompts
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="key" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
