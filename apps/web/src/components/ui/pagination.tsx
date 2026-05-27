"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Page actuelle (1-indexée) */
  page: number;
  /** Taille de page */
  pageSize: number;
  /** Total d'items après filtrage */
  total: number;
  /** Préfixe à conserver dans les URL (ex. "/chauffeurs") */
  pathname: string;
  /** Label pour les items affichés (ex. "chauffeur", "véhicule") */
  itemLabel?: string;
  className?: string;
};

/**
 * Pagination Prev/Next + récap "X-Y sur Z" basée sur les searchParams.
 * Conserve tous les autres params (filtres) lors du changement de page.
 */
export function Pagination({
  page,
  pageSize,
  total,
  pathname,
  itemLabel = "élément",
  className,
}: Props) {
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Construit une URL en remplaçant juste ?page=
  const buildUrl = (targetPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (targetPage <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(targetPage));
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const { from, to } = useMemo(() => {
    if (total === 0) return { from: 0, to: 0 };
    const f = (page - 1) * pageSize + 1;
    const t = Math.min(page * pageSize, total);
    return { from: f, to: t };
  }, [page, pageSize, total]);

  if (total === 0) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 sm:flex-row",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Affichage{" "}
        <strong className="text-foreground">
          {from}–{to}
        </strong>{" "}
        sur{" "}
        <strong className="text-foreground">{total}</strong> {itemLabel}
        {total > 1 ? "s" : ""}
      </p>

      <div className="flex items-center gap-1">
        <Button asChild={hasPrev} variant="outline" size="sm" disabled={!hasPrev}>
          {hasPrev ? (
            <Link href={buildUrl(page - 1)}>
              <ChevronLeft className="mr-1 size-3.5" />
              Précédent
            </Link>
          ) : (
            <span>
              <ChevronLeft className="mr-1 size-3.5" />
              Précédent
            </span>
          )}
        </Button>

        <span className="px-2 text-xs text-muted-foreground">
          Page {page} sur {totalPages}
        </span>

        <Button asChild={hasNext} variant="outline" size="sm" disabled={!hasNext}>
          {hasNext ? (
            <Link href={buildUrl(page + 1)}>
              Suivant
              <ChevronRight className="ml-1 size-3.5" />
            </Link>
          ) : (
            <span>
              Suivant
              <ChevronRight className="ml-1 size-3.5" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
