"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteChauffeurAction } from "../actions";

type Props = {
  chauffeurId: string;
  chauffeurName: string;
};

/**
 * Bouton de suppression d'un chauffeur avec garde-fou utilisateur (confirm
 * natif) et état pending pour empêcher les double-clics.
 *
 * On utilise useTransition plutôt que useActionState parce que l'action
 * de suppression ne retourne pas d'état (elle redirige toujours).
 */
export function DeleteChauffeurButton({ chauffeurId, chauffeurName }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmed = window.confirm(
      `Supprimer définitivement le chauffeur "${chauffeurName}" ?\n\nCette action est irréversible. Tous les documents associés perdront leur référence.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      await deleteChauffeurAction(chauffeurId);
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
          Supprimer ce chauffeur
        </>
      )}
    </Button>
  );
}
