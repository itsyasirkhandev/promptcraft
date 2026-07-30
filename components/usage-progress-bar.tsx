"use client";

/**
 * Reusable progress bar for displaying plan usage metrics.
 * Eliminates duplication between the dashboard HobbyUsageCard and the
 * billing HobbyBilling usage display.
 */
export function UsageProgressBar({
	label,
	used,
	limit,
	remainingLabel,
}: {
	label: string;
	used: number;
	limit: number;
	remainingLabel: string;
}) {
	const pct = Math.min(100, Math.round((used / limit) * 100));
	const remaining = Math.max(0, limit - used);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">{label}</span>
				<span className="font-medium tabular-nums">
					{used} / {limit}
				</span>
			</div>
			<div
				className="h-2 w-full rounded-full bg-muted overflow-hidden"
				role="progressbar"
				aria-label={`${label} used`}
				aria-valuenow={pct}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div
					className="h-full rounded-full bg-primary transition-colors"
					style={{ width: `${pct}%` }}
				/>
			</div>
			<span className="text-xs text-muted-foreground">
				{remaining} {remainingLabel}
			</span>
		</div>
	);
}
