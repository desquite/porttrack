"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

import { Input } from "@/components/ui/input";

/**
 * Barre de recherche pour la page « Saisie opération » : filtre les conteneurs
 * de l'onglet courant par n° / client / aconier (search_text). Conserve les
 * autres paramètres d'URL (notamment `onglet`).
 */
export function SaisieSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(sp.get("q") ?? "");

  // Sync si on revient en arrière dans l'historique
  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  const push = useCallback(
    (next: string) => {
      const params = new URLSearchParams(sp.toString());
      if (next.trim()) params.set("q", next.trim());
      else params.delete("q");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    },
    [router, pathname, sp],
  );

  // Debounce simple
  useEffect(() => {
    const t = setTimeout(() => push(q), 300);
    return () => clearTimeout(t);
  }, [q, push]);

  return (
    <div className="relative max-w-md">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher (n° conteneur, client, aconier…)"
        className="pl-8 pr-8"
        aria-label="Rechercher"
      />
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
          aria-label="Effacer"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
