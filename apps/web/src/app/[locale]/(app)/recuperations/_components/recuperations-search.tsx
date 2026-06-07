"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";

/**
 * Recherche pour les listes Récupération — filtre l'onglet courant (à récupérer
 * / récupérés) sur le n° de conteneur, le client, le BL, l'aconier…
 * Met à jour ?q= dans l'URL en conservant l'onglet.
 */
export function RecuperationsSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  useEffect(() => {
    const current = sp.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp.toString());
      if (q.trim()) params.set("q", q.trim());
      else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`);
    }, 300);
    return () => clearTimeout(t);
  }, [q, sp, pathname, router]);

  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher (n° conteneur, client, BL…)"
        className="pl-9 pr-9"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label="Effacer"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
