import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface PromptUseSkeletonProps {
	headerIconClassName?: string;
	titleWidth?: string;
	subtitleWidth?: string;
}

export function PromptUseSkeleton({
	headerIconClassName = 'size-9 bg-slate-200 dark:bg-slate-800 rounded-xl',
	titleWidth = 'w-48',
	subtitleWidth = 'w-72',
}: PromptUseSkeletonProps) {
	return (
		<div className="flex flex-col gap-6 max-w-6xl mx-auto p-1 animate-pulse">
			<div className="flex items-center gap-3">
				<div className={headerIconClassName}></div>
				<div>
					<div className={cn('h-6 bg-slate-200 dark:bg-slate-800 rounded mb-1', titleWidth)}></div>
					<div className={cn('h-4 bg-slate-100 dark:bg-slate-800/50 rounded', subtitleWidth)}></div>
				</div>
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				<div className="lg:col-span-5">
					<Card className="h-96 p-6">
						<div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
						<div className="space-y-4">
							<div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
							<div className="h-10 w-full bg-slate-200 dark:bg-slate-850 rounded"></div>
						</div>
					</Card>
				</div>
				<div className="lg:col-span-7">
					<Card className="h-96 p-6">
						<div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-6"></div>
						<div className="h-48 w-full bg-slate-150 dark:bg-slate-850 rounded"></div>
					</Card>
				</div>
			</div>
		</div>
	);
}