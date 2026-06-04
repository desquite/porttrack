"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, LogOut, ChevronDown, Loader2, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export function DriverHeaderMenu({ name, truck }: { name: string; truck: string | null }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const initials = name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  async function logout() {
    setLoggingOut(true); // on garde le spinner jusqu'à la redirection
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/chauffeur/connexion");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-1 py-1"
      >
        <div className="text-right leading-tight">
          <div className="text-sm font-semibold">{name}</div>
          <div className="flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
            <Truck className="size-3" />
            {truck ?? "Non désigné"}
          </div>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initials || "?"}
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <>
          <button type="button" aria-label="Fermer" className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-1 w-52 rounded-md border bg-popover p-1 shadow-md">
            <Link
              href="/chauffeur/camion"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
            >
              <Truck className="size-4" />
              Mon camion
            </Link>
            <Link
              href="/chauffeur/conformite"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent"
            >
              <ShieldCheck className="size-4" />
              Ma conformité
            </Link>
            <div className="my-1 border-t" />
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent disabled:opacity-70"
            >
              {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              {loggingOut ? "Déconnexion…" : "Se déconnecter"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
