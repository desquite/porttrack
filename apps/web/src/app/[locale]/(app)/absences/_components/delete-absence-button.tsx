"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteAbsenceAction } from "../actions";

export function DeleteAbsenceButton({ absenceId }: { absenceId: string }) {
  const [pending, start] = useTransition();
  function handleClick() {
    if (!window.confirm("Supprimer cette absence ?")) return;
    start(async () => { await deleteAbsenceAction(absenceId); });
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={pending}
      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
      Supprimer
    </Button>
  );
}
