"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MATERIEL_ETATS, MATERIEL_TYPES } from "@porttrack/shared";

const TYPE_LABEL: Record<(typeof MATERIEL_TYPES)[number], string> = {
  TRACTEUR:              "Tracteur",
  REMORQUE:              "Remorque",
  SEMI_REMORQUE:         "Semi-remorque",
  PORTE_CONTENEUR_20:    "Porte-conteneur 20'",
  PORTE_CONTENEUR_40:    "Porte-conteneur 40'",
  PORTE_CONTENEUR_MIXTE: "Porte-conteneur mixte",
};

const ETAT_LABEL: Record<(typeof MATERIEL_ETATS)[number], string> = {
  EN_SERVICE:    "En service",
  EN_REPARATION: "En réparation",
  EN_PANNE:      "En panne",
  HORS_SERVICE:  "Hors service",
  VENDU:         "Vendu",
};

const ALERTE_OPTIONS = [
  { value: "",         label: "Toutes alertes" },
  { value: "expired",  label: "Document expiré" },
  { value: "soon",     label: "Expire bientôt" },
  { value: "ok",       label: "À jour" },
] as const;

const DEBOUNCE_MS = 350;

export function MaterielFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const type = searchParams.get("type") ?? "";
  const etat = searchParams.get("etat") ?? "";
  const alerte = searchParams.get("alerte") ?? "";
  const hasAnyFilter = q || type || etat || alerte;

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

  // Debounce auto sur le champ texte
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

        <select
          value={type}
          onChange={(e) => pushParams({ type: e.target.value })}
          className={selectClass}
          aria-label="Filtre type"
        >
          <option value="">Tous types</option>
          {MATERIEL_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>

        <select
          value={etat}
          onChange={(e) => pushParams({ etat: e.target.value })}
          className={selectClass}
          aria-label="Filtre état"
        >
          <option value="">Tous états</option>
          {MATERIEL_ETATS.map((e) => (
            <option key={e} value={e}>
              {ETAT_LABEL[e]}
            </option>
          ))}
        </select>

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
