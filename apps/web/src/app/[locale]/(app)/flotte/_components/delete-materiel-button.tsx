"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteMaterielAction } from "../actions";

type Props = {
  materielId: string;
  materielLabel: string;
};

/**
 * Bouton de suppression d'un véhicule avec confirm natif et état pending
 * pour éviter les double-clics. Pattern identique au DeleteChauffeurButton.
 */
export function DeleteMaterielButton({ materielId, materielLabel }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      `Supprimer définitivement le véhicule "${materielLabel}" ?\n\nCette action est irréversible. Tous les documents associés perdront leur référence.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteMaterielAction(materielId);
    });
  }

  return (
    <Button
      type="button"
      variant="destructive"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="mr-2 size-4 animate-spin" />
          Suppression…
        </>
      ) : (
        <>
          <Trash2 className="mr-2 size-4" />
          Supprimer ce véhicule
        </>
      )}
    </Button>
  );
}
