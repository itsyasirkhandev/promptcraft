"use client";

import { Spinner } from "@phosphor-icons/react";
import {
	Dialog,
	DialogContent,
	DialogOverlay,
	DialogPortal,
} from "@/components/ui/dialog";

/**
 * Full-screen blocking overlay shown while a checkout or portal redirect is
 * being prepared. Extracted from repeated Dialog patterns in billing, upgrade,
 * and pricing pages.
 */
export function CheckoutLoadingDialog({
	open,
	message,
}: {
	open: boolean;
	message: string;
}) {
	return (
		<Dialog open={open}>
			<DialogPortal>
				<DialogOverlay className="bg-black/60 backdrop-blur-sm" />
				<DialogContent
					showCloseButton={false}
					className="flex w-fit flex-col items-center gap-4 border-none bg-transparent p-12 shadow-none sm:max-w-none"
					onInteractOutside={(e) => e.preventDefault()}
					onEscapeKeyDown={(e) => e.preventDefault()}
				>
					<Spinner
						className="size-8 animate-spin text-white"
						aria-hidden="true"
					/>
					<p className="text-sm text-white/80 font-medium">{message}</p>
				</DialogContent>
			</DialogPortal>
		</Dialog>
	);
}
