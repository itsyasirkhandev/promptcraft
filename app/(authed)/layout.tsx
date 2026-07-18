"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import ThemeToggle from "@/components/ThemeToggle";
import { UserButton, Show, useUser } from "@clerk/nextjs";
import { House, List, PlusCircle, Folders } from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useAction } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";

const POLAR_PRODUCT_ID = "31b0505a-9ff3-4fa0-a370-adf5e6ad3143";

const navItems = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/dashboard/prompts", label: "Prompts", icon: List },
  { href: "/prompt/create", label: "Create", icon: PlusCircle },
  { href: "/dashboard/workspace", label: "Workspace", icon: Folders },
];

function PlanBadge() {
  const user = useQuery(api.authed.users.currentUser);

  if (!user) return null;

  const isPro = user.plan === "pro";

  return (
    <Badge variant={isPro ? "default" : "secondary"}>
      {isPro ? "Pro" : "Hobby"}
    </Badge>
  );
}

function PlanControl() {
  const user = useQuery(api.authed.users.currentUser);
  const isPro = user?.plan === "pro";
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generateCheckoutUrl = useAction(api.authed.billing.generateCheckoutUrl);
  const generatePortalUrl = useAction(api.authed.billing.generatePortalUrl);

  if (!user) return null;

  const handleCheckout = async () => {
    if (pending) return;
    setPending("checkout");
    setError(null);
    try {
      const result = await generateCheckoutUrl({
        productId: POLAR_PRODUCT_ID,
        successUrl: `${window.location.origin}/dashboard`,
      });
      if (!result?.url) throw new Error("No URL returned");
      window.location.assign(result.url);
    } catch {
      setError("Couldn't start checkout. Please try again.");
      setPending(null);
    }
  };

  const handlePortal = async () => {
    if (pending) return;
    setPending("portal");
    setError(null);
    try {
      const result = await generatePortalUrl();
      if (!result?.url) throw new Error("No URL returned");
      window.location.assign(result.url);
    } catch {
      setError("Couldn't open the subscription portal. Please try again.");
      setPending(null);
    }
  };

  const pendingCheckout = pending === "checkout";
  const pendingPortal = pending === "portal";

  return (
    <div className="flex items-center gap-2">
      {isPro ? (
        <button
          onClick={handlePortal}
          disabled={pendingPortal}
          aria-disabled={pendingPortal}
          aria-busy={pendingPortal}
          className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
        >
          {pendingPortal ? "Loading portal…" : "Manage Subscription"}
        </button>
      ) : (
        <button
          onClick={handleCheckout}
          disabled={pendingCheckout}
          aria-disabled={pendingCheckout}
          aria-busy={pendingCheckout}
          className="text-[11px] font-medium px-3 py-1.5 rounded-full bg-[#111] text-white hover:bg-[#222] disabled:opacity-60 transition-colors"
        >
          {pendingCheckout ? "Securing checkout…" : "Upgrade to Pro"}
        </button>
      )}
      {error && (
        <span role="alert" aria-live="polite" className="text-[10px] text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}

function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const { user } = useUser();

  const isCollapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/50 py-4">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Logo" className="h-6 w-6" />
          {!isCollapsed && (
            <span className="font-bold text-sm text-slate-800 dark:text-slate-200 tracking-tight transition-all duration-200">
              Prompt Crafts
            </span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActuallyActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={isActuallyActive}>
                      <Link href={item.href}>
                        <item.icon
                          weight={isActuallyActive ? "fill" : "regular"}
                        />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-4">
        <div className="flex items-center gap-3">
          <UserButton />
          {!isCollapsed && user && (
            <div className="flex flex-col text-left min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-semibold truncate text-slate-800 dark:text-slate-200 leading-none mb-1">
                {user.fullName || user.username || "User"}
                <PlanBadge />
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate leading-none">
                {user.primaryEmailAddress?.emailAddress}
              </span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <h1 className="text-lg font-bold font-heading">Dashboard</h1>
        <PlanBadge />
        <PlanControl />
      </div>

      <div className="flex items-center gap-3">
        <ThemeToggle />
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}

export default function AuthedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto p-6">{children}</main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
