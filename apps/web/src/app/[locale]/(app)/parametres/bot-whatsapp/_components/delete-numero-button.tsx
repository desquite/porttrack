"use client";

import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteBotNumeroAction } from "../actions";

export function DeleteNumeroButton({ id, numero }: { id: string; numero: string }) {
  const [pending, start] = useTransition();
  function handleClick() {
    if (!window.confirm(`Retirer le numéro ${numero} de la liste autorisée ?`)) return;
    start(async () => { await deleteBotNumeroAction(id); });
  }
  return (
    <Button type="button" variant="ghost" size="sm" onClick={handleClick} disabled={pending}
      className="h-8 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700">
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
