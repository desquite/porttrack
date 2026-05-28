"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTENEUR_STATUTS } from "@porttrack/shared";

const STATUT_LABEL: Record<(typeof CONTENEUR_STATUTS)[number], string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  LIVRE: "Livré",
  ANNULE: "Annulé",
};

const DEBOUNCE_MS = 350;

export function ConteneursFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  const statut = searchParams.get("statut") ?? "";
  const hasAnyFilter = q || statut;

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

  useEffect(() => {
    const currentInUrl = searchParams.get("q") ?? "";
    if (q === currentInUrl) return;
    const t = setTimeout(() => pushParams({ q }), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function handleReset() {
    setQ("");
    startTransition(() => router.push("?", { scroll: false }));
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
            placeholder="Rechercher (numéro, BL, client, déclaration…)"
            className="pl-8 pr-8"
            type="search"
            aria-label="Recherche"
          />
          {pending && (
            <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <select
          value={statut}
          onChange={(e) => pushParams({ statut: e.target.value })}
          className={selectClass}
          aria-label="Filtre statut"
        >
          <option value="">Tous statuts</option>
          {CONTENEUR_STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_LABEL[s]}
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
