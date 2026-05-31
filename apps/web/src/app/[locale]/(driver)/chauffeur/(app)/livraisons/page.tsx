import { setRequestLocale } from "next-intl/server";
import { PackageCheck, MapPin, FileArchive } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { loadDriverContext } from "../_components/load-driver";

export default async function DriverDeliveriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { chauffeur } = await loadDriverContext();
  if (!chauffeur) return null;

  const supabase = await createClient();

  // EIR archivés du chauffeur = ses livraisons confirmées (RLS limite déjà à lui)
  const { data: eirs } = await supabase
    .from("eir_archives")
    .select(`id, date_livraison, conteneur:conteneurs ( numero, client, destination_libre )`)
    .order("date_livraison", { ascending: false })
    .limit(100);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (eirs ?? []) as any[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <PackageCheck className="size-5 text-primary" />Mes livraisons
        </h1>
        <p className="text-sm text-muted-foreground">{rows.length} conteneur(s) livré(s)</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">
          Aucune livraison enregistrée pour l&apos;instant.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => {
            const c = e.conteneur ?? {};
            return (
              <Card key={e.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="flex size-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                    <FileArchive className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-medium">{c.numero ?? "—"}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      <span>Livré le {new Date(e.date_livraison + "T12:00:00").toLocaleDateString("fr-FR")}</span>
                      {c.client && <span>{c.client}</span>}
                      {c.destination_libre && <span className="flex items-center gap-1"><MapPin className="size-3" />{c.destination_libre}</span>}
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
