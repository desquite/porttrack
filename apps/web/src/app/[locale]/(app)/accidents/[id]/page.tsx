import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft, ShieldAlert, CheckCircle2, XCircle, PlayCircle,
  UploadCloud, FileDown, Camera, Trash2, Wrench,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import type { Database } from "@porttrack/shared";
import { AccidentForm } from "../_components/accident-form";
import { loadAccidentRefs } from "../_components/load-refs";
import { DeleteAccidentButton } from "../_components/delete-accident-button";
import {
  changeAccidentStatutAction,
  uploadConstatAction,
  uploadQuittanceAction,
  downloadConstatAction,
  downloadQuittanceAction,
  addAccidentPhotoAction,
  deleteAccidentPhotoAction,
  downloadAccidentPhotoAction,
} from "../actions";

type AccidentStatut = Database["public"]["Enums"]["accident_statut"];

const STATUT_LABEL: Record<AccidentStatut, string> = {
  DECLARE:             "Déclaré",
  EN_COURS_TRAITEMENT: "En cours de traitement",
  CLOTURE:             "Clôturé",
};
const STATUT_VARIANT: Record<AccidentStatut, "danger" | "warning" | "success"> = {
  DECLARE:             "danger",
  EN_COURS_TRAITEMENT: "warning",
  CLOTURE:             "success",
};

export default async function AccidentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; uploaded?: string; photoAdded?: string; photoDeleted?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: accident } = await supabase
    .from("accidents")
    .select(`*, materiel:materiel_roulant ( id, immatriculation, marque, modele, etat ), chauffeur:chauffeurs ( id, nom, prenoms )`)
    .eq("id", id)
    .maybeSingle();
  if (!accident) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("role").eq("id", user!.id).maybeSingle();
  const isManager = profile?.role === "MANAGER" || profile?.role === "SUPER_ADMIN";
  const tenantId = accident.tenant_id;
  const refs = await loadAccidentRefs();

  const { data: photos } = await supabase
    .from("accident_photos")
    .select("id, photo_nom, created_at")
    .eq("accident_id", accident.id)
    .order("created_at", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (accident as any).materiel as { id: string; immatriculation: string; marque: string | null; modele: string | null; etat: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (accident as any).chauffeur as { id: string; nom: string; prenoms: string } | null;
  const mrLabel = mr ? `${mr.immatriculation}${mr.marque ? ` — ${mr.marque}${mr.modele ? " " + mr.modele : ""}` : ""}` : "—";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/accidents" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour à la liste
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ShieldAlert className="size-6 text-rose-600" />Accident
          </h1>
          <Badge variant={STATUT_VARIANT[accident.statut as AccidentStatut]} className="text-xs">
            {STATUT_LABEL[accident.statut as AccidentStatut]}
          </Badge>
          {mr && <Link href={`/flotte/${mr.id}`} className="text-sm text-muted-foreground hover:text-foreground">{mrLabel}</Link>}
          {ch && <span className="text-sm text-muted-foreground">· {ch.nom} {ch.prenoms}</span>}
        </div>
      </div>

      {sp.created && <Flash kind="ok" title="Accident déclaré" desc="OR créé automatiquement, matériel marqué Indisponible." />}
      {sp.updated && <Flash kind="ok" title="Modifications enregistrées" />}
      {sp.uploaded && <Flash kind="ok" title={`${sp.uploaded === "constat" ? "Constat" : "Quittance"} uploadé`} />}
      {sp.photoAdded && <Flash kind="ok" title="Photo ajoutée" />}
      {sp.photoDeleted && <Flash kind="ok" title="Photo retirée" />}
      {sp.error && (
        <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>
      )}

      {/* Lien OR */}
      {accident.panne_id && (
        <Alert>
          <Wrench className="size-4" />
          <AlertTitle>Ordre de Réparation lié</AlertTitle>
          <AlertDescription>
            Un OR a été créé automatiquement pour cet accident.{" "}
            <Link href={`/pannes/${accident.panne_id}`} className="font-medium underline">Voir l&apos;OR</Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Transitions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Statut</CardTitle>
          <CardDescription className="text-xs">Le matériel reste Indisponible tant que l&apos;accident n&apos;est pas clos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {accident.statut === "DECLARE" && (
            <form action={changeAccidentStatutAction.bind(null, accident.id, "EN_COURS_TRAITEMENT")}>
              <Button type="submit" size="sm"><PlayCircle className="mr-2 size-4" />Marquer en traitement</Button>
            </form>
          )}
          {(accident.statut === "DECLARE" || accident.statut === "EN_COURS_TRAITEMENT") && (
            <form action={changeAccidentStatutAction.bind(null, accident.id, "CLOTURE")}>
              <Button type="submit" size="sm" variant="success"><CheckCircle2 className="mr-2 size-4" />Clôturer</Button>
            </form>
          )}
          {accident.statut === "CLOTURE" && (
            <form action={changeAccidentStatutAction.bind(null, accident.id, "EN_COURS_TRAITEMENT")}>
              <Button type="submit" size="sm" variant="outline">Ré-ouvrir</Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Constat & quittance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Documents</CardTitle>
          <CardDescription className="text-xs">Constat amiable / rapport de police et quittance de clôture du sinistre.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <DocBlock
            title="Constat / rapport"
            currentUrl={accident.constat_url}
            currentName={accident.constat_nom}
            downloadAction={downloadConstatAction.bind(null, accident.id)}
            uploadAction={uploadConstatAction.bind(null, accident.id, tenantId)}
            inputId="constat-file"
          />
          <DocBlock
            title="Quittance assurance"
            currentUrl={accident.quittance_url}
            currentName={accident.quittance_nom}
            downloadAction={downloadQuittanceAction.bind(null, accident.id)}
            uploadAction={uploadQuittanceAction.bind(null, accident.id, tenantId)}
            inputId="quittance-file"
          />
        </CardContent>
      </Card>

      {/* Photos des dégâts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Camera className="size-4 text-primary" />Photos des dégâts ({photos?.length ?? 0})
          </CardTitle>
          <CardDescription className="text-xs">PDF, JPEG, PNG, WEBP, HEIC — 10 Mo max par photo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {photos && photos.length > 0 ? (
            <ul className="divide-y rounded-md border">
              {photos.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3 text-sm">
                  <Camera className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.photo_nom ?? "Photo"}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR") : ""}
                  </span>
                  <form action={downloadAccidentPhotoAction.bind(null, p.id)}>
                    <Button type="submit" size="sm" variant="ghost"><FileDown className="size-3.5" /></Button>
                  </form>
                  <form action={deleteAccidentPhotoAction.bind(null, p.id, accident.id)}>
                    <Button type="submit" size="sm" variant="ghost" className="text-rose-600 hover:bg-rose-50">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune photo pour le moment.</p>
          )}
          <form action={addAccidentPhotoAction.bind(null, accident.id, tenantId)} className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="photo-file" className="text-xs">Ajouter une photo</Label>
              <input id="photo-file" name="file" type="file" accept="image/*,application/pdf" required className="block text-xs" />
            </div>
            <Button type="submit" size="sm"><UploadCloud className="mr-2 size-4" />Ajouter</Button>
          </form>
        </CardContent>
      </Card>

      {/* Édition */}
      <Card>
        <CardHeader><CardTitle className="text-base">Détails du dossier</CardTitle></CardHeader>
        <CardContent>
          <AccidentForm
            mode="update"
            accidentId={accident.id}
            tenantId={tenantId}
            materiels={refs.materiels}
            chauffeurs={refs.chauffeurs}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            defaultValues={accident as any}
          />
        </CardContent>
      </Card>

      {isManager && (
        <div className="flex justify-end">
          <DeleteAccidentButton accidentId={accident.id} label="Supprimer cet accident" />
        </div>
      )}
    </div>
  );
}

function Flash({ kind, title, desc }: { kind: "ok" | "ko"; title: string; desc?: string }) {
  if (kind === "ok") {
    return (
      <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
        <CheckCircle2 className="size-4" /><AlertTitle>{title}</AlertTitle>
        {desc && <AlertDescription>{desc}</AlertDescription>}
      </Alert>
    );
  }
  return (
    <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>{title}</AlertTitle>{desc && <AlertDescription>{desc}</AlertDescription>}</Alert>
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
          <Button type="submit" variant="outline" size="sm">
            <FileDown className="mr-2 size-4" />{currentName ?? "Télécharger"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Aucun fichier.</p>
      )}
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
