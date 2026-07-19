"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4 max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
          <span className="text-lg">⚠️</span>
        </div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
          Dashboard error
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {error.message || "Failed to load dashboard data."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-all duration-200 cursor-pointer active:scale-[0.98]"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
