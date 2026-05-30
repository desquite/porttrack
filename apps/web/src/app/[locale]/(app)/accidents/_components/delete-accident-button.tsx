"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteAccidentAction } from "../actions";

export function DeleteAccidentButton({ accidentId, label = "Supprimer" }: { accidentId: string; label?: string }) {
  const [pending, start] = useTransition();
  function handleClick() {
    if (!window.confirm("Supprimer définitivement cet accident ? L'Ordre de Réparation lié restera mais ne pointera plus vers cet accident.")) return;
    start(async () => { await deleteAccidentAction(accidentId); });
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={pending}
      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
      {label}
    </Button>
  );
}
