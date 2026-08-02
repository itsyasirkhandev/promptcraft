import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { cn, getSiteUrl } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const defaultUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Prompt Crafts — Better AI Inputs, Better AI Outputs",
    template: "%s | Prompt Crafts",
  },
  description: "Craft, optimize, organize, and copy your perfect AI prompts. Free prompt management & public prompt marketplace.",
  alternates: {
    canonical: "./",
  },
  openGraph: {
    title: "Prompt Crafts — Better AI Inputs, Better AI Outputs",
    description: "Craft, optimize, organize, and copy your perfect AI prompts. Free prompt management & public prompt marketplace.",
    url: defaultUrl,
    siteName: "Prompt Crafts",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.svg",
        width: 800,
        height: 600,
        alt: "Prompt Crafts Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Crafts — Better AI Inputs, Better AI Outputs",
    description: "Craft, optimize, organize, and copy your perfect AI prompts.",
    images: ["/logo.svg"],
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  verification: {
    google: "kQ7PZlZ7QCByXW6mAYsITxSn41HcHYlZroeTF-neGcY",
  },
};

const dmSans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-sans",
  display: "swap",
});

export default function NextoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", dmSans.variable)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}{/* react-doctor-disable-next-line react-doctor/nextjs-no-font-link: Material Symbols Rounded is an icon font with custom variable-font axes (FILL, GRAD, opsz) that next/font/google does not fully expose; the <link> tag is the most reliable way to load it with these axes., react-doctor/nextjs-no-font-link */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0&display=optional"
        />
      </head>
      <body className={`${dmSans.variable} min-h-screen`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg">
          Skip to main content
        </a>
        <ConvexClientProvider>
          <NuqsAdapter>
            <TooltipProvider delayDuration={0}>
              {children}
              <Toaster />
            </TooltipProvider>
          </NuqsAdapter>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
