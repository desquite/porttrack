import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PlayCircle,
  UploadCloud,
  FileDown,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { Database } from "@porttrack/shared";
import { PanneForm } from "../_components/panne-form";
import { loadMaterielsForPanne } from "../_components/load-materiels";
import { DeletePanneButton } from "../_components/delete-panne-button";
import {
  changePanneStatutAction,
  uploadFactureAction,
  downloadFactureAction,
} from "../actions";

type PanneStatut = Database["public"]["Enums"]["panne_statut"];

const STATUT_LABEL: Record<PanneStatut, string> = {
  DECLAREE:      "Déclarée",
  EN_REPARATION: "En réparation",
  REPAREE:       "Réparée",
  ANNULEE:       "Annulée",
};
const STATUT_VARIANT: Record<PanneStatut, "secondary" | "info" | "success" | "warning"> = {
  DECLAREE:      "warning",
  EN_REPARATION: "info",
  REPAREE:       "success",
  ANNULEE:       "secondary",
};

export default async function PanneDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ updated?: string; created?: string; factureUploaded?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: panne } = await supabase
    .from("pannes")
    .select(
      `*, materiel:materiel_roulant ( id, immatriculation, marque, modele, etat )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!panne) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("tenant_id, role")
    .eq("id", user!.id)
    .maybeSingle();
  const tenantId = panne.tenant_id;
  const isManager = profile?.role === "MANAGER" || profile?.role === "SUPER_ADMIN";

  const materiels = await loadMaterielsForPanne();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (panne as any).materiel as { id: string; immatriculation: string; marque: string | null; modele: string | null; etat: string } | null;
  const mrLabel = mr?.immatriculation
    ? `${mr.immatriculation}${mr.marque ? ` — ${mr.marque}${mr.modele ? " " + mr.modele : ""}` : ""}`
    : "—";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/pannes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Wrench className="size-6 text-primary" />
            Panne
          </h1>
          <Badge variant={STATUT_VARIANT[panne.statut as PanneStatut]} className="text-xs">
            {STATUT_LABEL[panne.statut as PanneStatut]}
          </Badge>
          {mr && (
            <Link href={`/flotte/${mr.id}`} className="text-sm text-muted-foreground hover:text-foreground">
              {mrLabel}
            </Link>
          )}
        </div>
      </div>

      {sp.updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>La panne a été mise à jour.</AlertDescription>
        </Alert>
      )}
      {sp.factureUploaded && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Facture uploadée</AlertTitle>
          <AlertDescription>Le justificatif est joint à cette intervention.</AlertDescription>
        </Alert>
      )}
      {sp.error && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{sp.error}</AlertDescription>
        </Alert>
      )}

      {/* Transitions rapides */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Statut</CardTitle>
          <CardDescription className="text-xs">
            Le matériel passe automatiquement en panne tant qu&apos;une intervention reste ouverte.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {panne.statut === "DECLAREE" && (
            <form action={changePanneStatutAction.bind(null, panne.id, "EN_REPARATION")}>
              <Button type="submit" size="sm" variant="default">
                <PlayCircle className="mr-2 size-4" />
                Marquer en réparation
              </Button>
            </form>
          )}
          {(panne.statut === "DECLAREE" || panne.statut === "EN_REPARATION") && (
            <form action={changePanneStatutAction.bind(null, panne.id, "REPAREE")}>
              <Button type="submit" size="sm" variant="success">
                <CheckCircle2 className="mr-2 size-4" />
                Marquer réparée
              </Button>
            </form>
          )}
          {(panne.statut === "DECLAREE" || panne.statut === "EN_REPARATION") && (
            <form action={changePanneStatutAction.bind(null, panne.id, "ANNULEE")}>
              <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">
                <AlertTriangle className="mr-2 size-4" />
                Annuler (fausse alerte)
              </Button>
            </form>
          )}
          {(panne.statut === "REPAREE" || panne.statut === "ANNULEE") && (
            <form action={changePanneStatutAction.bind(null, panne.id, "EN_REPARATION")}>
              <Button type="submit" size="sm" variant="outline">
                Ré-ouvrir
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Facture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Facture de réparation</CardTitle>
          <CardDescription className="text-xs">
            PDF, JPEG, PNG ou WEBP — 10 Mo maximum.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {panne.facture_url && (
            <form action={downloadFactureAction.bind(null, panne.id)} className="inline-flex">
              <Button type="submit" variant="outline" size="sm">
                <FileDown className="mr-2 size-4" />
                Télécharger {panne.facture_nom ?? "la facture"}
              </Button>
            </form>
          )}
          <form action={uploadFactureAction.bind(null, panne.id, tenantId)} className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="facture-file" className="text-xs">{panne.facture_url ? "Remplacer" : "Uploader"} la facture</Label>
              <input
                id="facture-file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                required
                className="block text-xs"
              />
            </div>
            <Button type="submit" size="sm">
              <UploadCloud className="mr-2 size-4" />
              Envoyer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Édition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de la panne</CardTitle>
        </CardHeader>
        <CardContent>
          <PanneForm
            mode="update"
            panneId={panne.id}
            tenantId={tenantId}
            materiels={materiels}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            defaultValues={panne as any}
          />
        </CardContent>
      </Card>

      {/* Suppression (manager) */}
      {isManager && (
        <div className="flex justify-end">
          <DeletePanneButton panneId={panne.id} label="Supprimer cette panne" />
        </div>
      )}
    </div>
  );
}
