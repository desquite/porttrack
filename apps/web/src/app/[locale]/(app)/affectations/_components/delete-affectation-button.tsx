"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteAffectationAction } from "../actions";

export function DeleteAffectationButton({ affectationId }: { affectationId: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (
      !window.confirm(
        "Supprimer définitivement cette affectation ?\n\nCette action est irréversible.",
      )
    )
      return;
    startTransition(async () => {
      await deleteAffectationAction(affectationId);
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
          Supprimer cette affectation
        </>
      )}
    </Button>
  );
}
