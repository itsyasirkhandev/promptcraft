import type { Metadata } from "next";
import { JetBrains_Mono, IBM_Plex_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Clerk, Convex, Nextjs Starter Template",
  description:
    "Convention-heavy starter template with Convex, Next.js, Clerk Auth, Effect-TS, and Zustand.",
  icons: {
    icon: "/convex.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        ibmPlexSans.variable,
        jetbrainsMono.variable,
        playfairDisplay.variable,
        "font-sans"
      )}
    >
      <body className="antialiased">
        <ConvexClientProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ConvexClientProvider>
        <Toaster />
      </body>
    </html>
  );
}

