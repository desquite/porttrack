"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Truck,
  Package,
  ClipboardList,
  Receipt,
  Settings,
  LogOut,
  Anchor,
  Menu,
  X,
  ChevronDown,
  Bug,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { signOutAction } from "@/app/[locale]/(app)/actions";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  comingSoon?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { label: "Chauffeurs",      href: "/chauffeurs", icon: Users },
  { label: "Flotte",          href: "/flotte",     icon: Truck },
  { label: "Conteneurs",      href: "/conteneurs", icon: Package },
  { label: "Flux & affectations", href: "/affectations", icon: ClipboardList, comingSoon: true },
  { label: "Facturation",     href: "/facturation", icon: Receipt, comingSoon: true },
  { label: "Paramètres",      href: "/parametres", icon: Settings },
];

type AppShellProps = {
  children: React.ReactNode;
  userEmail: string;
  userRole: string;
  tenantName: string | null;
};

export function AppShell({
  children,
  userEmail,
  userRole,
  tenantName,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // pathname inclut le préfixe locale (/fr/dashboard, /en/dashboard) — on
  // le retire pour matcher les hrefs de NAV_ITEMS qui sont locale-agnostiques.
  const stripLocale = (p: string) => p.replace(/^\/(fr|en)(?=\/|$)/, "") || "/";
  const cleanPath = stripLocale(pathname);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Backdrop mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Anchor className="size-4" />
            </span>
            PORTTRACK
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fermer"
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              cleanPath === item.href || cleanPath.startsWith(item.href + "/");
            const Icon = item.icon;

            const inner = (
              <span
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : item.comingSoon
                      ? "text-muted-foreground/60 cursor-not-allowed"
                      : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="size-4" />
                  {item.label}
                </span>
                {item.comingSoon && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    Bientôt
                  </Badge>
                )}
              </span>
            );

            return item.comingSoon ? (
              <div key={item.href} aria-disabled>
                {inner}
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
              >
                {inner}
              </Link>
            );
          })}

          {/* Debug — visible pour tous (utile en dev, on le restreindra à SUPER_ADMIN plus tard) */}
          <Link href="/debug" onClick={() => setMobileOpen(false)} className="block pt-4">
            <span
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                cleanPath === "/debug"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Bug className="size-4" />
              Debug session
            </span>
          </Link>
        </nav>

        <div className="border-t p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground/70">PORTTRACK v0.1.0</p>
          <p>© 2026 Port Autonome d'Abidjan</p>
        </div>
      </aside>

      {/* Contenu principal */}
      <div className="flex min-h-screen flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Menu className="size-5" />
            </Button>
            {tenantName ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Espace de</span>
                <span className="text-sm font-medium">{tenantName}</span>
              </div>
            ) : userRole === "SUPER_ADMIN" ? (
              <Badge variant="info" className="text-xs">
                Mode SUPER_ADMIN — Tous les tenants
              </Badge>
            ) : null}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
                {userEmail.slice(0, 2).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{userEmail}</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>

            {userMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30"
                  aria-label="Fermer le menu"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-md border bg-popover p-1 shadow-md">
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Connecté en tant que
                    <div className="mt-0.5 font-medium text-foreground">{userEmail}</div>
                    <div className="mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {userRole}
                      </Badge>
                    </div>
                  </div>
                  <div className="my-1 border-t" />
                  <form action={signOutAction}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-foreground hover:bg-accent"
                    >
                      <LogOut className="size-4" />
                      Se déconnecter
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
