import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Truck, FileText, MinusCircle, Wrench, FileX } from "lucide-react";

import { createAdminClient } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { classifyExpiry, EXPIRY_BADGE_VARIANT, formatExpiryLabel } from "@/lib/utils/dates";
import { loadDriverContext } from "../_components/load-driver";
import { downloadCamionDocAction } from "./actions";

// Lignes documentaires d'un tracteur (cahier §8) : label + colonne d'échéance.
const DOC_ROWS: { type: string; label: string; col: string | null }[] = [
  { type: "CARTE_GRISE",         label: "Carte grise",          col: null },
  { type: "ASSURANCE",           label: "Assurance",            col: "assurance_fin" },
  { type: "VISITE_TECHNIQUE",    label: "Visite technique",     col: "visite_technique_fin" },
  { type: "CARTE_TRANSPORT",     label: "Carte de transport",   col: "carte_transport_fin" },
  { type: "CARTE_STATIONNEMENT", label: "Carte de stationnement", col: "carte_stationnement_fin" },
];

const ETAT_LABEL: Record<string, string> = {
  EN_SERVICE: "En service",
  EN_PANNE: "En panne",
  INDISPONIBLE: "Indisponible",
  EN_REPARATION: "En réparation",
  HORS_SERVICE: "Hors service",
  VENDU: "Vendu",
};

export default async function MonCamionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { chauffeur, designation } = await loadDriverContext();
  if (!chauffeur) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (designation as any)?.materiel as { id: string; immatriculation: string; chrono: string | null; marque: string | null } | null;

  const back = (
    <Link href="/chauffeur" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" />Retour
    </Link>
  );

  if (!mr) {
    return (
      <div className="space-y-4">
        {back}
        <h1 className="text-xl font-bold tracking-tight">Mon camion</h1>
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <MinusCircle className="size-5" />
            Aucun camion ne t&apos;est désigné aujourd&apos;hui.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Détails matériel (lisibles en session — RLS materiel_driver_tenant) + GED via admin.
  const admin = createAdminClient();
  const [{ data: materiel }, { data: docs }] = await Promise.all([
    admin
      .from("materiel_roulant")
      .select("etat, modele, assurance_fin, visite_technique_fin, carte_transport_fin, carte_stationnement_fin, patente_fin")
      .eq("id", mr.id)
      .maybeSingle(),
    admin
      .from("documents")
      .select("id, type_document, fichier_url, date_expiration")
      .eq("owner_type", "MATERIEL")
      .eq("owner_id", mr.id),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (materiel ?? {}) as any;
  const docByType = new Map<string, { id: string; hasFile: boolean }>();
  for (const d of docs ?? []) {
    if (!docByType.has(d.type_document)) docByType.set(d.type_document, { id: d.id, hasFile: !!d.fichier_url });
  }

  const rows = [...DOC_ROWS];
  if (m.patente_fin) rows.push({ type: "PATENTE_TRANSPORT", label: "Patente", col: "patente_fin" });

  const truckTitle = mr.chrono ? `${mr.chrono} (${mr.immatriculation})` : mr.immatriculation;

  return (
    <div className="space-y-4">
      {back}
      <h1 className="text-xl font-bold tracking-tight">Mon camion</h1>

      {/* Carte camion */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-1 p-4">
          <div className="flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <span className="text-lg font-semibold">{truckTitle}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {[mr.marque, m.modele].filter(Boolean).join(" ") || "—"}
            {m.etat && <> · {ETAT_LABEL[m.etat] ?? m.etat}</>}
          </div>
        </CardContent>
      </Card>

      {/* Documents & échéances */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Documents du véhicule</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((row) => {
              const expiry = row.col ? (m[row.col] as string | null) : null;
              const status = expiry ? classifyExpiry(expiry) : null;
              const ged = docByType.get(row.type);
              return (
                <div key={row.type} className="flex items-center gap-3 p-3">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{row.label}</div>
                    {expiry && status && (
                      <Badge variant={EXPIRY_BADGE_VARIANT[status]} className="mt-0.5 text-[10px]">
                        {formatExpiryLabel(expiry)}
                      </Badge>
                    )}
                  </div>
                  {ged?.hasFile ? (
                    <form action={downloadCamionDocAction.bind(null, ged.id)}>
                      <Button type="submit" variant="outline" size="sm" className="h-8">Voir</Button>
                    </form>
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><FileX className="size-3" />Manquant</span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Déclarer une panne (action contextuelle sur ce camion) */}
      <Link href="/chauffeur/panne" className="block">
        <Button className="h-12 w-full gap-2" variant="outline">
          <Wrench className="size-4" />Déclarer une panne
        </Button>
      </Link>
    </div>
  );
}
