"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AFFECTATION_STATUTS } from "@porttrack/shared";

const STATUT_LABEL: Record<(typeof AFFECTATION_STATUTS)[number], string> = {
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export function AffectationsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const statut = searchParams.get("statut") ?? "";

  function pushParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `?${qs}` : "?", { scroll: false }));
  }

  const selectClass = cn(
    "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
  );

  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statut}
          onChange={(e) => pushParams({ statut: e.target.value })}
          className={selectClass}
          aria-label="Filtre statut"
        >
          <option value="">Tous statuts</option>
          {AFFECTATION_STATUTS.map((s) => (
            <option key={s} value={s}>
              {STATUT_LABEL[s]}
            </option>
          ))}
        </select>

        {statut && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.push("?", { scroll: false }))}
            disabled={pending}
          >
            <X className="size-3.5" />
            Réinitialiser
          </Button>
        )}
      </div>
    </div>
  );
}
