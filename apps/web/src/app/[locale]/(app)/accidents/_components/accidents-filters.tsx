"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACCIDENT_STATUTS } from "@porttrack/shared";

const STATUT_LABEL: Record<(typeof ACCIDENT_STATUTS)[number], string> = {
  DECLARE:             "Déclaré",
  EN_COURS_TRAITEMENT: "En cours",
  CLOTURE:             "Clôturé",
};

export function AccidentsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [, startTransition] = useTransition();

  const statut = searchParams.get("statut") ?? "";

  useEffect(() => {
    const initial = searchParams.get("q") ?? "";
    if (q === initial) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (q) params.set("q", q); else params.delete("q");
      params.delete("page");
      startTransition(() => router.replace(`/accidents?${params.toString()}`));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setStatut(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("statut", value); else params.delete("statut");
    params.delete("page");
    router.replace(`/accidents?${params.toString()}`);
  }

  function reset() { setQ(""); router.replace("/accidents"); }

  const hasFilters = q || statut;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex-1 min-w-[200px]">
        <Label htmlFor="acc-q" className="text-xs">Recherche</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input id="acc-q" type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Lieu, circonstances…" className="pl-8" />
        </div>
      </div>
      <div>
        <Label htmlFor="acc-statut" className="text-xs">Statut</Label>
        <select id="acc-statut" value={statut} onChange={(e) => setStatut(e.target.value)}
          className="flex h-9 w-44 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">Tous</option>
          {ACCIDENT_STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
        </select>
      </div>
      {hasFilters && (
        <button type="button" onClick={reset}
          className="flex h-9 items-center gap-1 rounded-md border border-input bg-background px-3 text-xs text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
          Réinitialiser
        </button>
      )}
    </div>
  );
}
