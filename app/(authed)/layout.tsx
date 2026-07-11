"use client";

import { AuthGuard } from "@/components/auth/AuthGuard";
import ThemeToggle from "@/components/ThemeToggle";
import { UserButton, Show } from "@clerk/nextjs";
import {
  House,
  List,
  PlusCircle,
  Folders
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

const navItems = [
  { href: "/dashboard", label: "Home", icon: House },
  { href: "/dashboard/prompts", label: "Prompts", icon: List },
  { href: "/dashboard/create", label: "Create", icon: PlusCircle },
  { href: "/dashboard/workspace", label: "Workspace", icon: Folders },
];

function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActuallyActive = item.href === "/dashboard" 
                  ? pathname === "/dashboard" 
                  : pathname.startsWith(item.href);

                return (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton asChild isActive={isActuallyActive}>
                      <Link href={item.href}>
                        <item.icon weight={isActuallyActive ? "fill" : "regular"} />
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
    </Sidebar>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <h1 className="text-lg font-bold font-heading">Dashboard</h1>
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
