"use client";

import { useTransition } from "react";
import { Trash2, Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteDocumentAction, downloadDocumentAction } from "./actions";

export function DocumentDownloadButton({ documentId }: { documentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        startTransition(async () => {
          await downloadDocumentAction(documentId);
        });
      }}
      disabled={pending}
      title="Télécharger"
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
    </Button>
  );
}

export function DocumentDeleteButton({
  documentId,
  fileName,
  redirectPath,
}: {
  documentId: string;
  fileName: string;
  redirectPath: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const ok = window.confirm(
      `Supprimer le document "${fileName}" ?\n\nLe fichier sera retiré du stockage. Action irréversible.`,
    );
    if (!ok) return;
    startTransition(async () => {
      await deleteDocumentAction(documentId, redirectPath);
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
      title="Supprimer"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
    </Button>
  );
}
