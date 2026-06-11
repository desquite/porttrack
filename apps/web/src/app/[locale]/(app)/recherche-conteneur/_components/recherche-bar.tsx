"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Barre de recherche du module Recherche : champ unique (n° conteneur OU BL),
 * étroit et centré, sur un fond dégradé doux. Soumission = navigation vers la
 * même page avec ?q=… (rendu serveur côté page.tsx).
 */
export function RechercheBar({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    router.push(v ? `/recherche-conteneur?q=${encodeURIComponent(v)}` : "/recherche-conteneur");
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
      <form onSubmit={submit} className="mx-auto max-w-xl">
        <label htmlFor="q" className="mb-1.5 block text-center text-sm font-medium text-foreground/80">
          Rechercher un conteneur ou un BL
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="N° de conteneur ou de BL…"
            className="h-11 w-full rounded-full border border-input bg-background/80 pl-9 pr-9 text-sm shadow-sm backdrop-blur focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
              aria-label="Effacer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Saisis un n° de conteneur (ex. TLLU5057849) ou un n° de BL.
        </p>
      </form>
    </div>
  );
}
