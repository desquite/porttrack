import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft, ClipboardCheck, CheckCircle2, XCircle, AlertTriangle, Truck, User,
  Image as ImageIcon, Upload, Trash2,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils/dates";
import { CHECKLIST_ITEMS, type ChecklistItemKey } from "@porttrack/shared";
import { ChecklistForm } from "../_components/checklist-form";
import { DeleteChecklistButton } from "../_components/delete-checklist-button";
import {
  addChecklistPhotoAction,
  deleteChecklistPhotoAction,
  downloadChecklistPhotoAction,
} from "../actions";

type ItemEtat = "OK" | "ANOMALIE";

export default async function ChecklistDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; photoAdded?: string; photoDeleted?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: cl } = await supabase
    .from("checklists_depart")
    .select(`
      *,
      chauffeur:chauffeurs ( id, nom, prenoms, telephone ),
      materiel:materiel_roulant ( id, immatriculation, chrono, marque, modele ),
      designation:designations ( id, date_designation, equipe:equipes ( nom, code, couleur, heure_debut, heure_fin ) )
    `)
    .eq("id", id)
    .maybeSingle();
  if (!cl) notFound();

  const { data: photos } = await supabase
    .from("checklist_photos")
    .select("id, photo_url, photo_nom, created_at")
    .eq("checklist_id", id)
    .order("created_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (cl as any).chauffeur as { id: string; nom: string; prenoms: string; telephone: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (cl as any).materiel as { id: string; immatriculation: string; chrono: string | null; marque: string | null; modele: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const des = (cl as any).designation as { id: string; date_designation: string; equipe: { nom: string; code: string; couleur: string | null; heure_debut: string | null; heure_fin: string | null } | null } | null;
  const eq = des?.equipe ?? null;

  const statut = cl.statut_global as "FAITE" | "REMARQUE";
  const statutVariant = statut === "FAITE" ? "success" : "warning";
  const StatIcon = statut === "FAITE" ? CheckCircle2 : AlertTriangle;

  const heure = new Date(cl.heure_validation).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const mrLabel = mr ? (mr.chrono ? `${mr.chrono} (${mr.immatriculation})` : mr.immatriculation) : "—";

  const defaults: Record<ChecklistItemKey, ItemEtat> = {
    item_huile: cl.item_huile,
    item_pneus: cl.item_pneus,
    item_feux: cl.item_feux,
    item_freins: cl.item_freins,
    item_retros: cl.item_retros,
    item_documents: cl.item_documents,
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/checklists?date=${cl.date_depart}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux check-lists
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <ClipboardCheck className="size-6 text-primary" />Check-list de départ
          </h1>
          <Badge variant={statutVariant} className="gap-1 text-xs">
            <StatIcon className="size-3.5" />
            {statut === "FAITE" ? "Faite" : "Remarque"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatDateFR(cl.date_depart)} — validée à {heure}
        </p>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Check-list enregistrée</AlertTitle></Alert>}
      {sp.updated && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Mise à jour effectuée</AlertTitle></Alert>}
      {sp.photoAdded && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Photo ajoutée</AlertTitle></Alert>}
      {sp.photoDeleted && <Alert className="border-rose-200 bg-rose-50/60 text-rose-900"><CheckCircle2 className="size-4" /><AlertTitle>Photo supprimée</AlertTitle></Alert>}
      {sp.error && <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <User className="size-4 text-primary" />Chauffeur
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {ch ? (
              <>
                <div className="font-medium">{ch.nom} {ch.prenoms}</div>
                {ch.telephone && <div className="text-xs text-muted-foreground">📞 {ch.telephone}</div>}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/chauffeurs/${ch.id}`}>Fiche chauffeur</Link>
                </Button>
              </>
            ) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Truck className="size-4 text-primary" />Matériel roulant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {mr ? (
              <>
                <div className="font-medium">{mrLabel}</div>
                {(mr.marque || mr.modele) && <div className="text-xs text-muted-foreground">{mr.marque ?? ""} {mr.modele ?? ""}</div>}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/flotte/${mr.id}`}>Fiche matériel</Link>
                </Button>
              </>
            ) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>

      {eq && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: eq.couleur ?? "#3b82f6" }}>
                {eq.code}
              </span>
              Équipe : {eq.nom}
            </CardTitle>
            <CardDescription className="text-xs">
              Horaires : {eq.heure_debut && eq.heure_fin ? `${eq.heure_debut.slice(0, 5)} – ${eq.heure_fin.slice(0, 5)}` : "non précisés"}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Édition des items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items de la check-list</CardTitle>
          <CardDescription>Modifie l&apos;état d&apos;un item ou la remarque puis enregistre.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChecklistForm
            mode="update"
            checklistId={cl.id}
            defaults={defaults}
            defaultRemarque={cl.remarque ?? ""}
          />
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ImageIcon className="size-4 text-primary" />
            Photos d&apos;anomalie
            {photos && photos.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {photos.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>JPG/PNG/WebP/HEIC, 10 Mo max.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <form
            action={addChecklistPhotoAction.bind(null, cl.id, cl.tenant_id)}
            encType="multipart/form-data"
            className="flex flex-wrap items-center gap-2"
          >
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              required
              className="block w-full max-w-xs cursor-pointer rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
            />
            <Button type="submit" size="sm" variant="outline">
              <Upload className="mr-2 size-3.5" />Ajouter
            </Button>
          </form>

          {photos && photos.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {photos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
                  <div className="flex min-w-0 items-center gap-2">
                    <ImageIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{p.photo_nom ?? "photo"}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <form action={downloadChecklistPhotoAction.bind(null, p.id)}>
                      <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs">Voir</Button>
                    </form>
                    <form action={deleteChecklistPhotoAction.bind(null, p.id, cl.id)}>
                      <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-rose-600 hover:bg-rose-50">
                        <Trash2 className="size-3.5" />
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Aucune photo pour l&apos;instant.</p>
          )}
        </CardContent>
      </Card>

      {/* Résumé items (lecture rapide) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Résumé</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {CHECKLIST_ITEMS.map((item) => {
              const etat = defaults[item.key];
              const ok = etat === "OK";
              return (
                <li key={item.key} className="flex items-center gap-2">
                  {ok
                    ? <CheckCircle2 className="size-3.5 text-emerald-600" />
                    : <AlertTriangle className="size-3.5 text-amber-600" />}
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className={ok ? "ml-auto text-emerald-700" : "ml-auto text-amber-700"}>
                    {ok ? "OK" : "Anomalie"}
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <DeleteChecklistButton checklistId={cl.id} label="Supprimer cette check-list" />
      </div>
    </div>
  );
}
