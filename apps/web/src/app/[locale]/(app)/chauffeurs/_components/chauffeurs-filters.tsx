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

/**
 * Barre de filtres pour la liste des chauffeurs.
 *
 * URL = source de vérité (bookmarkable, partageable). Le composant lit les
 * params actuels via useSearchParams et pousse les nouveaux via router.push
 * en repartant systématiquement à page=1 quand un filtre change.
 *
 * Le champ texte est local pour permettre la saisie sans pousser à chaque
 * touche — la recherche s'applique sur Entrée ou sur clic du bouton.
 */
export function ChauffeursFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  // État local du champ texte (suit l'URL au mount et au reset)
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Sync le state local quand l'URL change (ex. clic sur "Réinitialiser")
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
    // Toujours revenir à la page 1 quand les filtres changent
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `?${qs}` : "?", { scroll: false });
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    pushParams({ q });
  }

  function handleReset() {
    setQ("");
    startTransition(() => {
      router.push("?", { scroll: false });
    });
  }

  return (
    <div className="rounded-md border bg-background p-3">
      <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par nom, prénom, téléphone ou CNI…"
            className="pl-8"
            type="search"
            aria-label="Recherche"
          />
        </div>

        {/* Filter statut */}
        <select
          value={statut}
          onChange={(e) => pushParams({ statut: e.target.value })}
          className={cn(
            "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          )}
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
          className={cn(
            "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
          )}
          aria-label="Filtre alerte"
        >
          {ALERTE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Submit */}
        <Button type="submit" variant="default" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
          <span className="ml-1">Rechercher</span>
        </Button>

        {/* Reset */}
        {hasAnyFilter && (
          <Button type="button" variant="ghost" size="sm" onClick={handleReset} disabled={pending}>
            <X className="size-3.5" />
            Réinitialiser
          </Button>
        )}
      </form>
    </div>
  );
}
