import { Card, CardContent, CardHeader } from "@/components/ui/card";

const pulse = "animate-pulse rounded-md bg-muted";

export default function DashboardSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6" aria-label="Loading dashboard">
      <div className="space-y-2">
        <div className={`${pulse} h-7 w-36`} />
        <div className={`${pulse} h-4 w-56`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="flex-row items-center justify-between">
              <div className={`${pulse} h-4 w-32`} />
              <div className={`${pulse} size-5 rounded-full`} />
            </CardHeader>
            <CardContent>
              <div className={`${pulse} h-9 w-16`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <ChartPlaceholder className="h-96" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ChartPlaceholder className="h-96" />
        <ChartPlaceholder className="h-96" />
      </div>
      <ChartPlaceholder className="h-[26rem]" />
    </div>
  );
}

function ChartPlaceholder({ className }: { className: string }) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <div className={`${pulse} h-5 w-40`} />
        <div className={`${pulse} h-4 w-64 max-w-full`} />
      </CardHeader>
      <CardContent className="flex flex-1 items-end gap-3">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className={`${pulse} flex-1`}
            style={{ height: `${28 + ((index * 17) % 58)}%` }}
          />
        ))}
      </CardContent>
    </Card>
  );
}

