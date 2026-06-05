"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  periode: string;
  annee: number;
  index: number;
  aconier: string | null;
};

export function ExportButton({ periode, annee, index, aconier }: Props) {
  const params = new URLSearchParams({
    periode,
    annee: String(annee),
    index: String(index),
  });
  if (aconier) params.set("aconier", aconier);
  const href = `/api/bilan-aconiers/export?${params.toString()}`;

  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} download>
        <Download className="size-4" />
        Exporter en Excel
      </a>
    </Button>
  );
}
