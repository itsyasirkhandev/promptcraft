import { DM_Sans, Raleway } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";

const raleway = Raleway({subsets:['latin'],variable:'--font-sans'});

const dmSans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-dm-sans",
  display: "swap",
});

export default function NextoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", raleway.variable)}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0"
        />
      </head>
      <body className={`${dmSans.variable} min-h-screen`}>
        <ConvexClientProvider>
          <TooltipProvider delayDuration={0}>
            {children}
          </TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
