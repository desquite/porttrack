import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft, Gavel, CheckCircle2, XCircle, UploadCloud, FileDown, AlertTriangle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { Database } from "@porttrack/shared";
import { InfractionForm } from "../_components/infraction-form";
import { loadInfractionRefs } from "../_components/load-refs";
import { DeleteInfractionButton } from "../_components/delete-infraction-button";
import {
  changeInfractionStatutAction,
  uploadPvAction, uploadRecuAction,
  downloadPvAction, downloadRecuAction,
} from "../actions";

type InfractionStatut = Database["public"]["Enums"]["infraction_statut"];

const STATUT_LABEL: Record<InfractionStatut, string> = {
  NON_PAYEE: "Non payée", PAYEE: "Payée", CONTESTEE: "Contestée",
};
const STATUT_VARIANT: Record<InfractionStatut, "danger" | "success" | "warning"> = {
  NON_PAYEE: "danger", PAYEE: "success", CONTESTEE: "warning",
};

export default async function InfractionDetailPage({
  params, searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; uploaded?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: infraction } = await supabase
    .from("infractions")
    .select(`*, chauffeur:chauffeurs ( id, nom, prenoms ), materiel:materiel_roulant ( id, immatriculation, marque )`)
    .eq("id", id)
    .maybeSingle();
  if (!infraction) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("role").eq("id", user!.id).maybeSingle();
  const isManager = profile?.role === "MANAGER" || profile?.role === "SUPER_ADMIN";
  const tenantId = infraction.tenant_id;
  const refs = await loadInfractionRefs();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (infraction as any).chauffeur as { id: string; nom: string; prenoms: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (infraction as any).materiel as { id: string; immatriculation: string; marque: string | null } | null;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/infractions" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour à la liste
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Gavel className="size-6 text-amber-700" />Infraction
          </h1>
          <Badge variant={STATUT_VARIANT[infraction.statut as InfractionStatut]} className="text-xs">
            {STATUT_LABEL[infraction.statut as InfractionStatut]}
          </Badge>
          {ch && <Link href={`/chauffeurs/${ch.id}`} className="text-sm text-muted-foreground hover:text-foreground">{ch.nom} {ch.prenoms}</Link>}
          {mr && <span className="text-sm text-muted-foreground">· {mr.immatriculation}{mr.marque ? ` — ${mr.marque}` : ""}</span>}
        </div>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Infraction enregistrée</AlertTitle></Alert>}
      {sp.updated && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Mise à jour enregistrée</AlertTitle></Alert>}
      {sp.uploaded && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>{sp.uploaded === "pv" ? "PV" : "Reçu"} uploadé</AlertTitle></Alert>}
      {sp.error && <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>}

      {infraction.statut === "NON_PAYEE" && infraction.date_limite_paiement && (
        <Alert className="border-amber-300 bg-amber-50/60 text-amber-900">
          <AlertTriangle className="size-4" />
          <AlertTitle>Limite de paiement</AlertTitle>
          <AlertDescription>
            Date limite : <strong>{new Date(infraction.date_limite_paiement).toLocaleDateString("fr-FR")}</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Statut rapide */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Statut paiement</CardTitle>
          <CardDescription className="text-xs">Le passage en « Payée » remplit automatiquement la date de paiement.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {infraction.statut !== "PAYEE" && (
            <form action={changeInfractionStatutAction.bind(null, infraction.id, "PAYEE")}>
              <Button type="submit" size="sm" variant="success"><CheckCircle2 className="mr-2 size-4" />Marquer payée</Button>
            </form>
          )}
          {infraction.statut !== "CONTESTEE" && (
            <form action={changeInfractionStatutAction.bind(null, infraction.id, "CONTESTEE")}>
              <Button type="submit" size="sm" variant="outline"><AlertTriangle className="mr-2 size-4" />Contester</Button>
            </form>
          )}
          {infraction.statut !== "NON_PAYEE" && (
            <form action={changeInfractionStatutAction.bind(null, infraction.id, "NON_PAYEE")}>
              <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">Repasser à Non payée</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* PV & Reçu */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Justificatifs</CardTitle>
          <CardDescription className="text-xs">PV / avis d&apos;amende et reçu de paiement. PDF / images.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DocBlock
            title="PV / Avis d'amende"
            currentUrl={infraction.pv_url}
            currentName={infraction.pv_nom}
            downloadAction={downloadPvAction.bind(null, infraction.id)}
            uploadAction={uploadPvAction.bind(null, infraction.id, tenantId)}
            inputId="pv-file"
          />
          <DocBlock
            title="Reçu de paiement"
            currentUrl={infraction.recu_url}
            currentName={infraction.recu_nom}
            downloadAction={downloadRecuAction.bind(null, infraction.id)}
            uploadAction={uploadRecuAction.bind(null, infraction.id, tenantId)}
            inputId="recu-file"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Détails</CardTitle></CardHeader>
        <CardContent>
          <InfractionForm
            mode="update"
            infractionId={infraction.id}
            tenantId={tenantId}
            materiels={refs.materiels}
            chauffeurs={refs.chauffeurs}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            defaultValues={infraction as any}
          />
        </CardContent>
      </Card>

      {isManager && (
        <div className="flex justify-end">
          <DeleteInfractionButton infractionId={infraction.id} label="Supprimer cette infraction" />
        </div>
      )}
    </div>
  );
}

function DocBlock({
  title, currentUrl, currentName, downloadAction, uploadAction, inputId,
}: {
  title: string;
  currentUrl: string | null;
  currentName: string | null;
  downloadAction: () => Promise<void>;
  uploadAction: (fd: FormData) => Promise<void>;
  inputId: string;
}) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {currentUrl ? (
        <form action={downloadAction}>
          <Button type="submit" variant="outline" size="sm"><FileDown className="mr-2 size-4" />{currentName ?? "Télécharger"}</Button>
        </form>
      ) : <p className="text-xs text-muted-foreground">Aucun fichier.</p>}
      <form action={uploadAction} className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[160px]">
          <Label htmlFor={inputId} className="text-xs">{currentUrl ? "Remplacer" : "Uploader"}</Label>
          <input id={inputId} name="file" type="file" accept="application/pdf,image/*" required className="block w-full text-xs" />
        </div>
        <Button type="submit" size="sm"><UploadCloud className="mr-2 size-4" />Envoyer</Button>
      </form>
    </div>
  );
}
