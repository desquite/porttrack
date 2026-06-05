"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PERIOD_KINDS, makePeriod, selectableYears,
  MONTH_LABELS_FR, type PeriodKind,
} from "@/lib/bilan/periods";

type Props = {
  kind: PeriodKind;
  year: number;
  index: number;
};

export function PeriodSelector({ kind, year, index }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(updates: Partial<Record<"periode" | "annee" | "index", string>>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") p.delete(k);
      else p.set(k, v);
    }
    startTransition(() => router.replace(`${pathname}?${p.toString()}`));
  }

  function changeKind(next: PeriodKind) {
    // Quand on change de granularité, on garde l'année et on remet l'index par défaut
    const now = new Date();
    const m = now.getMonth() + 1;
    const def =
      next === "mois" ? m :
      next === "trimestre" ? Math.ceil(m / 3) :
      next === "semestre" ? (m <= 6 ? 1 : 2) :
      1;
    setParam({ periode: next, index: String(def) });
  }

  function shift(delta: number) {
    if (kind === "annee") {
      setParam({ annee: String(year + delta) });
      return;
    }
    let i = index + delta;
    let y = year;
    const max =
      kind === "mois" ? 12 :
      kind === "trimestre" ? 4 :
      2;
    if (i < 1) { i = max; y--; }
    if (i > max) { i = 1; y++; }
    setParam({ annee: String(y), index: String(i) });
  }

  const years = selectableYears();
  const indexOptions =
    kind === "mois"      ? Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: MONTH_LABELS_FR[i] })) :
    kind === "trimestre" ? Array.from({ length: 4 },  (_, i) => ({ v: i + 1, label: `T${i + 1}` })) :
    kind === "semestre"  ? Array.from({ length: 2 },  (_, i) => ({ v: i + 1, label: `S${i + 1}` })) :
    [];

  const periodLabel = makePeriod(kind, year, index).label;

  return (
    <div className="flex flex-col gap-3 w-full sm:w-auto">
      {/* Tabs : Mois / Trimestre / Semestre / Année */}
      <div className="inline-flex rounded-md border bg-background p-0.5 self-start" role="tablist">
        {PERIOD_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={k === kind}
            disabled={pending}
            onClick={() => changeKind(k)}
            className={cn(
              "px-3 py-1.5 text-sm rounded transition-colors",
              k === kind
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {labelOf(k)}
          </button>
        ))}
      </div>

      {/* Sélecteurs + navigation */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => shift(-1)}
          disabled={pending}
          aria-label="Période précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {indexOptions.length > 0 && (
          <select
            value={index}
            onChange={(e) => setParam({ index: e.target.value })}
            disabled={pending}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {indexOptions.map((o) => (
              <option key={o.v} value={o.v}>{o.label}</option>
            ))}
          </select>
        )}

        <select
          value={year}
          onChange={(e) => setParam({ annee: e.target.value })}
          disabled={pending}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => shift(1)}
          disabled={pending}
          aria-label="Période suivante"
        >
          <ChevronRight className="size-4" />
        </Button>

        <span className="ml-1 text-sm text-muted-foreground">
          → <span className="font-medium text-foreground">{periodLabel}</span>
        </span>
      </div>
    </div>
  );
}

function labelOf(k: PeriodKind): string {
  switch (k) {
    case "mois":      return "Mois";
    case "trimestre": return "Trimestre";
    case "semestre":  return "Semestre";
    case "annee":     return "Année";
  }
}
