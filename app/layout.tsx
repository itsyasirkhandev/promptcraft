import type { Metadata } from "next";
import { DM_Sans, Raleway } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Prompt Crafts",
  description: "Better AI inputs. Better AI outputs. Craft prompts. Save hours.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}{/* react-doctor-disable-next-line react-doctor/nextjs-no-font-link: Material Symbols Rounded is an icon font with custom variable-font axes (FILL, GRAD, opsz) that next/font/google does not fully expose; the <link> tag is the most reliable way to load it with these axes., react-doctor/nextjs-no-font-link */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0&display=optional"
        />
      </head>
      <body className={`${dmSans.variable} min-h-screen`}>
        <ConvexClientProvider>
          <TooltipProvider delayDuration={0}>
            {children}
            <Toaster />
          </TooltipProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
