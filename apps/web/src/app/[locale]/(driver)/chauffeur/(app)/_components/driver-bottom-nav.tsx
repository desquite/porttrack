"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Truck, Users } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/chauffeur", label: "Accueil", icon: Home, exact: true },
  { href: "/chauffeur/mouvements", label: "Mouvements", icon: Truck },
  { href: "/chauffeur/equipe", label: "Équipe", icon: Users },
];

export function DriverBottomNav() {
  const pathname = usePathname();
  const clean = pathname.replace(/^\/(fr|en)(?=\/|$)/, "") || "/";

  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-3 border-t bg-background">
      {TABS.map((t) => {
        const active = t.exact ? clean === t.href : clean === t.href || clean.startsWith(t.href + "/");
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-5" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
