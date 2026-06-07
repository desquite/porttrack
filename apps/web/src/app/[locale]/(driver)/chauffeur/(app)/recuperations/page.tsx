import { setRequestLocale } from "next-intl/server";
import { Undo2, MapPin, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { loadDriverContext } from "../_components/load-driver";

const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };

/**
 * Historique des récupérations confirmées par le chauffeur (RLS limite déjà
 * aux siennes). Symétrique de la page « Mes livraisons ».
 */
export default async function DriverRecuperationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { chauffeur } = await loadDriverContext();
  if (!chauffeur) return null;

  const supabase = await createClient();

  const { data: recups } = await supabase
    .from("recuperations")
    .select(`id, date_recuperation, destination_type, destination_lieu,
             conteneur:conteneurs ( numero, client, destination_libre )`)
    .eq("chauffeur_id", chauffeur.id)
    .eq("statut", "CONFIRMEE")
    .order("date_recuperation", { ascending: false, nullsFirst: false })
    .limit(100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (recups ?? []) as any[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Undo2 className="size-5 text-primary" />Mes récupérations
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} vide{rows.length > 1 ? "s" : ""} récupéré{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">
          Aucune récupération confirmée pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const c = r.conteneur ?? {};
            const dest = r.destination_lieu || DEST_LABEL[r.destination_type ?? ""] || "destination";
            return (
              <Card key={r.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-medium">{c.numero ?? "—"}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {r.date_recuperation && (
                        <span>
                          Récupéré le {new Date(r.date_recuperation + "T12:00:00").toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {c.client && <span>{c.client}</span>}
                      {c.destination_libre && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />{c.destination_libre}
                        </span>
                      )}
                      <span>→ {dest}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
