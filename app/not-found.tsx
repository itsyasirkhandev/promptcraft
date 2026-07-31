import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main-content" className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">
        <div className="text-7xl font-bold text-slate-200 dark:text-slate-800 font-heading">
          404
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
            Page not found
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved.
          </p>
        </div>
        <Link
          href="/"
          className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-medium rounded-xl transition-colors duration-200 active:scale-[0.98]"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
