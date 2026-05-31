import { History, FileText, ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { downloadJustificatifAction } from "../actions";

/**
 * Timeline en LECTURE SEULE des modifications tracées d'un enregistrement.
 * Réutilisable sur n'importe quelle fiche (conteneur, affectation, …).
 */
export async function ModificationsHistory({
  tableCible,
  recordId,
}: {
  tableCible: string;
  recordId: string;
}) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("modifications_historique")
    .select("id, champ_label, valeur_avant, valeur_apres, motif, user_email, created_at, justificatif_nom")
    .eq("table_cible", tableCible)
    .eq("enregistrement_id", recordId)
    .order("created_at", { ascending: false });

  if (!rows || rows.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" />
        Aucune modification tracée pour cet enregistrement.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-md border p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.champ_label}</span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">
                {r.valeur_avant ?? "(vide)"}
              </span>
              <ArrowRight className="size-3 text-muted-foreground" />
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">
                {r.valeur_apres ?? "(vide)"}
              </span>
            </span>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            <span className="italic">« {r.motif} »</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{r.user_email ?? "utilisateur inconnu"}</span>
            <span>{new Date(r.created_at).toLocaleString("fr-FR")}</span>
            <form action={downloadJustificatifAction.bind(null, r.id)}>
              <Button type="submit" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]">
                <FileText className="size-3" />
                {r.justificatif_nom ?? "justificatif"}
              </Button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
