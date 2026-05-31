"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteChecklistItemAction } from "../actions";

export function DeleteChecklistItemButton({ itemId, label }: { itemId: string; label: string }) {
  const [pending, start] = useTransition();
  function handleClick() {
    if (!window.confirm(`Supprimer définitivement l'item « ${label} » ? Bloqué si déjà utilisé par une check-list (utilise plutôt « Désactiver »).`)) return;
    start(async () => { await deleteChecklistItemAction(itemId); });
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={pending}
      className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
