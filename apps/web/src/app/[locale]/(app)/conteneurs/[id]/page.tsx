import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert, History, Lock, PackageCheck, FileArchive, FileText } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TRACKED_FIELDS, MATERIEL_TYPES } from "@porttrack/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils/dates";
import { ConteneurForm } from "../_components/conteneur-form";
import { DeleteConteneurButton } from "../_components/delete-conteneur-button";
import { loadConteneurRefs } from "../_components/load-refs";
import { TrackedModificationForm, type TrackedFieldOption } from "../../historique/_components/tracked-modification-form";
import { ModificationsHistory } from "../../historique/_components/modifications-history";
import { ConfirmDeliveryForm } from "../../eir/_components/confirm-delivery-form";
import { downloadEirAction } from "../../eir/actions";

const EIR_MODE_LABEL: Record<string, string> = {
  REMORQUE_COUPEE: "Remorque coupée",
  CLIENT_DECHARGE: "Client a déchargé",
  AUTO_CHARGEUR: "Auto-chargeur",
};

/** Convertit une valeur DB en valeur d'input + valeur d'affichage pour un champ tracé. */
function buildTrackedFields(conteneur: Record<string, unknown>): TrackedFieldOption[] {
  return TRACKED_FIELDS.conteneurs.map((f) => {
    const raw = conteneur[f.champ];
    if (f.type === "datetime") {
      const iso = raw ? new Date(String(raw)) : null;
      const valid = iso && !Number.isNaN(iso.getTime());
      return {
        champ: f.champ,
        label: f.label,
        type: f.type,
        currentInput: valid ? iso!.toISOString().slice(0, 16) : "",
        currentDisplay: valid ? iso!.toLocaleString("fr-FR") : "",
      };
    }
    const str = raw === null || raw === undefined ? "" : String(raw);
    return { champ: f.champ, label: f.label, type: f.type, currentInput: str, currentDisplay: str };
  });
}

export default async function EditConteneurPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ updated?: string; error?: string; modtracee?: string; livree?: string }>;
}) {
  const { locale, id } = await params;
  const { updated, error, modtracee, livree } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: conteneur } = await supabase
    .from("conteneurs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!conteneur) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canDelete = isSuperAdmin || profile?.role === "MANAGER";

  const refs = await loadConteneurRefs();

  // EIR : affectation active pour pré-remplir chauffeur/camion +
  // EIR déjà archivés pour ce conteneur.
  const dejaLivre = conteneur.statut === "LIVRE" || conteneur.statut === "ANNULE";
  const [{ data: activeAff }, { data: eirArchives }] = await Promise.all([
    supabase
      .from("affectations")
      .select(`id, remorque_id, chauffeur:chauffeurs ( nom, prenoms ), tracteur:materiel_roulant ( immatriculation )`)
      .eq("conteneur_id", conteneur.id)
      .in("statut", ["PLANIFIEE", "EN_COURS"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("eir_archives")
      .select("id, date_livraison, fichier_nom, chauffeur_nom, tracteur_immat, remorque_immat, mode_livraison, uploaded_by_email")
      .eq("conteneur_id", conteneur.id)
      .order("date_livraison", { ascending: false }),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aff = activeAff as any;
  const affChauffeurNom = aff?.chauffeur ? `${aff.chauffeur.nom} ${aff.chauffeur.prenoms}`.trim() : null;
  const affTracteurImmat = aff?.tracteur?.immatriculation ?? null;

  // Remorques / châssis en service (pour le sélecteur de livraison)
  const remorqueTypes = MATERIEL_TYPES.filter((t) => t !== "TRACTEUR");
  const { data: remorquesData } = dejaLivre
    ? { data: [] }
    : await supabase
        .from("materiel_roulant")
        .select("id, immatriculation, chrono, type, etat")
        .eq("etat", "EN_SERVICE")
        .in("type", remorqueTypes)
        .order("immatriculation", { ascending: true });
  const remorques = (remorquesData ?? []).map((m) => ({
    id: m.id,
    label: m.chrono ? `${m.chrono} (${m.immatriculation})` : m.immatriculation,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/conteneurs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <h1 className="font-mono text-2xl font-bold tracking-tight">
          {conteneur.numero}
        </h1>
        <p className="text-sm text-muted-foreground">
          Édite le suivi du conteneur. Les changements de statut et de dates
          alimentent le tableau de bord.
        </p>
      </div>

      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Le conteneur <strong className="font-mono">{updated}</strong> a été mis à jour.
          </AlertDescription>
        </Alert>
      )}
      {modtracee && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modification tracée enregistrée</AlertTitle>
          <AlertDescription>
            Le changement a été journalisé et un email envoyé au(x) manager(s).
          </AlertDescription>
        </Alert>
      )}
      {livree && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <PackageCheck className="size-4" />
          <AlertTitle>Livraison confirmée</AlertTitle>
          <AlertDescription>L&apos;EIR a été archivé et le conteneur passé en « Livré ».</AlertDescription>
        </Alert>
      )}

      {/* Confirmation de livraison avec EIR */}
      {!dejaLivre && (
        <Card className="border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PackageCheck className="size-4 text-emerald-700" />
              Confirmer la livraison
            </CardTitle>
            <CardDescription>
              L&apos;upload de l&apos;EIR est obligatoire avant de clôturer. Le conteneur passera alors en « Livré ».
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfirmDeliveryForm
              tenantId={conteneur.tenant_id}
              conteneurId={conteneur.id}
              affectationId={aff?.id ?? null}
              chauffeurNom={affChauffeurNom}
              tracteurImmat={affTracteurImmat}
              remorques={remorques}
              defaultRemorqueId={aff?.remorque_id ?? null}
            />
          </CardContent>
        </Card>
      )}

      {/* EIR archivés pour ce conteneur */}
      {eirArchives && eirArchives.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileArchive className="size-4 text-primary" />
              EIR archivés
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {eirArchives.length}
              </span>
            </CardTitle>
            <CardDescription>Conservation 5 ans — suppression réservée au Super Admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {eirArchives.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <FileArchive className="size-4 text-muted-foreground" />
                  <span className="font-medium">Livré le {formatDateFR(e.date_livraison)}</span>
                  {e.chauffeur_nom && <span className="text-xs text-muted-foreground">{e.chauffeur_nom}</span>}
                  {e.tracteur_immat && <span className="text-xs text-muted-foreground">{e.tracteur_immat}</span>}
                  {e.mode_livraison && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{EIR_MODE_LABEL[e.mode_livraison] ?? e.mode_livraison}</span>}
                  {e.remorque_immat && <span className="text-xs text-muted-foreground">+ {e.remorque_immat}</span>}
                  <form action={downloadEirAction.bind(null, e.id)} className="ml-auto">
                    <Button type="submit" variant="outline" size="sm">
                      <FileText className="mr-2 size-3.5" />{e.fichier_nom ?? "EIR"}
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations conteneur</CardTitle>
          <CardDescription>Le tenant est verrouillé en édition.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConteneurForm
            mode="update"
            conteneurId={conteneur.id}
            isSuperAdmin={isSuperAdmin}
            tenants={[]}
            defaultTenantId={conteneur.tenant_id}
            defaultValues={conteneur}
            shippingLines={refs.shippingLines}
            typesConteneur={refs.typesConteneur}
            ports={refs.ports}
          />
        </CardContent>
      </Card>

      {/* Modification tracée — champs sensibles */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4 text-amber-700" />
            Modification d&apos;un champ sensible
          </CardTitle>
          <CardDescription>
            Lieu de livraison, type de visite, mode de livraison et date BADT ne se modifient
            qu&apos;avec un motif et un justificatif. Chaque changement est journalisé de façon immuable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrackedModificationForm
            tenantId={conteneur.tenant_id}
            tableCible="conteneurs"
            recordId={conteneur.id}
            fields={buildTrackedFields(conteneur as Record<string, unknown>)}
          />
        </CardContent>
      </Card>

      {/* Historique des modifications de ce conteneur */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" />
            Historique des modifications
          </CardTitle>
          <CardDescription>Journal immuable — lecture seule pour tous les rôles.</CardDescription>
        </CardHeader>
        <CardContent>
          <ModificationsHistory tableCible="conteneurs" recordId={conteneur.id} />
        </CardContent>
      </Card>

      {canDelete && (
        <Card className="border-rose-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <ShieldAlert className="size-4" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              La suppression est définitive et retire ce conteneur du suivi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteConteneurButton conteneurId={conteneur.id} numero={conteneur.numero} />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/conteneurs">
            <ArrowLeft className="mr-2 size-4" />
            Revenir à la liste
          </Link>
        </Button>
      </div>
    </div>
  );
}
