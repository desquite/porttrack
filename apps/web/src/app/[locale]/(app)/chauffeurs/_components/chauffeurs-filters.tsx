"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CHAUFFEUR_STATUTS } from "@porttrack/shared";

const STATUT_LABEL: Record<(typeof CHAUFFEUR_STATUTS)[number], string> = {
  ACTIF: "Actif",
  EN_CONGE: "En congé",
  SUSPENDU: "Suspendu",
  INACTIF: "Inactif",
};

const ALERTE_OPTIONS = [
  { value: "",         label: "Toutes alertes" },
  { value: "expired",  label: "Document expiré" },
  { value: "soon",     label: "Expire bientôt" },
  { value: "ok",       label: "À jour" },
] as const;

const DEBOUNCE_MS = 350;

/**
 * Barre de filtres pour la liste des chauffeurs.
 *
 * Comportement :
 * - URL = source de vérité (bookmarkable, partageable)
 * - Recherche texte : debounce 350ms après la dernière frappe → push auto.
 *   La recherche est tolérante aux accents et à la casse côté serveur
 *   (colonne search_text avec lower+unaccent).
 * - Selects : push immédiat à chaque changement.
 * - Reset : visible dès qu'un filtre est actif.
 */
export function ChauffeursFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // État local du champ texte (synchro initiale avec l'URL)
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Resynchro quand l'URL change de l'extérieur (ex. clic Reset)
  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const statut = searchParams.get("statut") ?? "";
  const alerte = searchParams.get("alerte") ?? "";
  const hasAnyFilter = q || statut || alerte;

  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    });
  }

  // Debounce auto sur le champ texte : ne push que si q diffère de l'URL
  // (évite la double-soumission au mount et après un push).
  useEffect(() => {
    const currentInUrl = searchParams.get("q") ?? "";
    if (q === currentInUrl) return;

    const timeoutId = setTimeout(() => {
      pushParams({ q });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function handleReset() {
    setQ("");
    startTransition(() => {
      router.push("?", { scroll: false });
    });
  }

  const selectClass = cn(
    "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
  );

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search avec spinner de pending */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher (tolère accents et majuscules)…"
            className="pl-8 pr-8"
            type="search"
            aria-label="Recherche"
          />
          {pending && (
            <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Filter statut */}
        <select
          value={statut}
          onChange={(e) => pushParams({ statut: e.target.value })}
          className={selectClass}
          aria-label="Filtre statut"
        >
          <option value="">Tous statuts</option>
          {CHAUFFEUR_STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_LABEL[s]}
            </option>
          ))}
        </select>

        {/* Filter alerte */}
        <select
          value={alerte}
          onChange={(e) => pushParams({ alerte: e.target.value })}
          className={selectClass}
          aria-label="Filtre alerte"
        >
          {ALERTE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Reset */}
        {hasAnyFilter && (
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={pending}>
            <X className="size-3.5" />
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  );
}
