"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deletePanneAction } from "../actions";

export function DeletePanneButton({ panneId, label = "Supprimer" }: { panneId: string; label?: string }) {
  const [pending, start] = useTransition();

  function handleClick() {
    if (!window.confirm("Supprimer définitivement cette panne ? Cette action ne peut pas être annulée.")) return;
    start(async () => {
      await deletePanneAction(panneId);
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
    >
      {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
      {label}
    </Button>
  );
}
