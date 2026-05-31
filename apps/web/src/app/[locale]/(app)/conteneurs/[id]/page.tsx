import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert, History, Lock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { TRACKED_FIELDS } from "@porttrack/shared";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConteneurForm } from "../_components/conteneur-form";
import { DeleteConteneurButton } from "../_components/delete-conteneur-button";
import { loadConteneurRefs } from "../_components/load-refs";
import { TrackedModificationForm, type TrackedFieldOption } from "../../historique/_components/tracked-modification-form";
import { ModificationsHistory } from "../../historique/_components/modifications-history";

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
  searchParams: Promise<{ updated?: string; error?: string; modtracee?: string }>;
}) {
  const { locale, id } = await params;
  const { updated, error, modtracee } = await searchParams;
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

      {/* Modification tracée — champs sensibles (cahier §9) */}
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
