"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ChartBar,
  Database,
  Export,
  FolderOpen,
  Gear,
  HardDrives,
  List,
  Moon,
  SignOut,
  Sun,
  Users,
  X,
} from "@phosphor-icons/react";
import { getHealth, clearTokens, getRole, type Health } from "@/lib/api";
import { storeAuthReturnPath, useAccessToken, useAuthReady } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function getInitials(name: string): string {
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function SidebarUserFooter({
  username,
  role,
  theme,
  onToggleTheme,
}: {
  username: string | null;
  role: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-border p-3">
      {username ? (
        <div className="rounded-lg border border-border bg-muted/40 p-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-primary/20"
              aria-hidden
            >
              {getInitials(username)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{username}</p>
              {role && (
                <Badge
                  variant={role === "admin" ? "default" : "secondary"}
                  className="mt-1 px-1.5 py-0 text-[10px] uppercase tracking-wide"
                >
                  {formatRole(role)}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="h-8 w-8 shrink-0 text-muted-foreground"
              type="button"
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={onToggleTheme} className="w-full justify-start" type="button">
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          {theme === "light" ? "Dark mode" : "Light mode"}
        </Button>
      )}
    </div>
  );
}

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: HardDrives },
  { href: "/shares", label: "Shares", icon: FolderOpen },
  { href: "/groups", label: "Groups", icon: Database },
  { href: "/templates", label: "Templates", icon: List },
  { href: "/reports", label: "Reports", icon: ChartBar },
  { href: "/configuration/export-import", label: "Export / Import", icon: Export, admin: true },
  { href: "/users", label: "Users", icon: Users, admin: true },
  { href: "/settings", label: "Settings", icon: Gear },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const authReady = useAuthReady();
  const accessToken = useAccessToken();
  const isLoginPage = pathname === "/login";
  const [health, setHealth] = useState<Health | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = accessToken ? getRole() : null;
  const username = accessToken && typeof window !== "undefined" ? localStorage.getItem("username") : null;

  useEffect(() => {
    if (isLoginPage || !accessToken) return;
    getHealth().then(setHealth).catch(() => {});
  }, [accessToken, isLoginPage]);

  useEffect(() => {
    if (isLoginPage || !authReady || accessToken) return;
    const returnPath = window.location.pathname + window.location.search;
    storeAuthReturnPath(returnPath);
    router.replace("/login");
  }, [accessToken, authReady, isLoginPage, router]);

  if (isLoginPage) return <>{children}</>;

  if (!authReady || !accessToken) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-6">
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    );
  }

  const visibleNav = nav.filter((n) => !n.admin || role === "admin");

  const handleLogout = () => {
    setMobileOpen(false);
    clearTokens();
    router.push("/login");
  };

  const navLinks = (
    <nav className="flex flex-col gap-0.5 p-3">
      {visibleNav.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" weight={active ? "fill" : "regular"} />
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SignOut className="h-4 w-4 shrink-0" />
        Logout
      </button>
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col lg:h-dvh lg:overflow-hidden">
      {health?.provider === "mock" && (
        <div className="bg-amber-500/90 text-amber-950 text-center text-sm py-1.5 font-medium shrink-0">
          Mock NFS provider: metrics and apply are simulated (dev mode)
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-border bg-card">
          <div className="flex h-14 shrink-0 items-center px-4 border-b border-border">
            <Link href="/dashboard" className="font-semibold tracking-tight">
              NFS Manager
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">v3</span>
            </Link>
          </div>
          <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">{navLinks}</div>
          <SidebarUserFooter username={username} role={role} theme={theme} onToggleTheme={toggle} />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="lg:hidden flex h-14 shrink-0 items-center justify-between px-4 border-b border-border bg-card">
            <Link href="/dashboard" className="font-semibold text-sm">
              NFS Manager v3
            </Link>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggle} type="button">
                {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} type="button">
                <List className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {mobileOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
              <aside className="relative ml-auto flex h-full w-72 flex-col bg-card border-l border-border shadow-xl">
                <div className="flex h-14 items-center justify-between px-4 border-b border-border">
                  <span className="font-semibold text-sm">Menu</span>
                  <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} type="button">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="scrollbar-themed flex-1 overflow-y-auto">{navLinks}</div>
                <SidebarUserFooter username={username} role={role} theme={theme} onToggleTheme={toggle} />
              </aside>
            </div>
          )}

          <main className="scrollbar-themed flex min-h-0 w-full flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
