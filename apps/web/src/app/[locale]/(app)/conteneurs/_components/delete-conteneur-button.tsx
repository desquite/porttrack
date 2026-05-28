"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteConteneurAction } from "../actions";

export function DeleteConteneurButton({
  conteneurId,
  numero,
}: {
  conteneurId: string;
  numero: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        `Supprimer définitivement le conteneur "${numero}" ?\n\nCette action est irréversible.`,
      )
    )
      return;
    startTransition(async () => {
      await deleteConteneurAction(conteneurId);
    });
  }

  return (
    <Button type="button" variant="destructive" onClick={handleClick} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Suppression…
        </>
      ) : (
        <>
          <Trash2 className="mr-2 size-4" />
          Supprimer ce conteneur
        </>
      )}
    </Button>
  );
}
