import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Gavel,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChauffeurForm } from "../_components/chauffeur-form";
import { DeleteChauffeurButton } from "../_components/delete-chauffeur-button";
import { DocumentsSection } from "../../_documents/documents-section";

export default async function EditChauffeurPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ updated?: string; error?: string; docError?: string }>;
}) {
  const { locale, id } = await params;
  const { updated, error, docError } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Charge le chauffeur — la RLS bloque si pas le droit
  const { data: chauffeur } = await supabase
    .from("chauffeurs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!chauffeur) {
    // Soit l'id n'existe pas, soit la RLS filtre → 404 dans les 2 cas
    notFound();
  }

  // 2. Charge le profil pour décider de l'affichage (rôle)
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canDelete = isSuperAdmin || profile?.role === "MANAGER";

  // Accidents + infractions liés à ce chauffeur
  const [{ count: accidentsTotal }, { data: accidentsRecents }, infractionsAgg] = await Promise.all([
    supabase
      .from("accidents")
      .select("*", { count: "exact", head: true })
      .eq("chauffeur_id", chauffeur.id),
    supabase
      .from("accidents")
      .select("id, date_accident, circonstances, statut")
      .eq("chauffeur_id", chauffeur.id)
      .order("date_accident", { ascending: false })
      .limit(3),
    supabase
      .from("infractions")
      .select("id, montant_fcfa, statut, date_infraction, type_infraction")
      .eq("chauffeur_id", chauffeur.id)
      .order("date_infraction", { ascending: false }),
  ]);
  const infractionsTotal = infractionsAgg.data?.length ?? 0;
  const infractionsRecentes = (infractionsAgg.data ?? []).slice(0, 3);
  const montantDu = (infractionsAgg.data ?? [])
    .filter((i) => i.statut === "NON_PAYEE")
    .reduce((acc, i) => acc + Number(i.montant_fcfa ?? 0), 0);

  // Équipes pour le sélecteur « Équipe par défaut »
  const { data: equipesRaw } = await supabase
    .from("equipes")
    .select("id, nom, code")
    .eq("actif", true)
    .order("ordre", { ascending: true });
  const equipes = equipesRaw ?? [];

  // 3. Si SUPER_ADMIN, charge la liste des tenants (utile pour le nom affiché)
  let tenantName: string | null = null;
  if (chauffeur.tenant_id) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nom_entreprise")
      .eq("id", chauffeur.tenant_id)
      .maybeSingle();
    tenantName = tenant?.nom_entreprise ?? null;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb + titre */}
      <div className="space-y-1">
        <Link
          href="/chauffeurs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {chauffeur.prenoms} {chauffeur.nom}
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenantName ? <>Entreprise : <strong>{tenantName}</strong> · </> : null}
          Édite les informations puis enregistre. Les modifications de dates
          mettent à jour les alertes du dashboard.
        </p>
      </div>

      {/* Flash de confirmation après update */}
      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Les informations de <strong>{updated}</strong> ont été mises à jour.
          </AlertDescription>
        </Alert>
      )}

      {/* Erreur de suppression remontée par l'URL */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Formulaire d'édition */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations chauffeur</CardTitle>
          <CardDescription>
            Le tenant est verrouillé en édition. Pour réaffecter le chauffeur,
            supprime-le et recrée-le sous l'autre entreprise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChauffeurForm
            mode="update"
            chauffeurId={chauffeur.id}
            isSuperAdmin={isSuperAdmin}
            tenants={[]}
            defaultTenantId={chauffeur.tenant_id}
            equipes={equipes}
            defaultValues={chauffeur}
          />
        </CardContent>
      </Card>

      {/* Section Documents (uploads scans PDF) */}
      {chauffeur.tenant_id && (
        <DocumentsSection
          ownerType="CHAUFFEUR"
          ownerId={chauffeur.id}
          tenantId={chauffeur.tenant_id}
          redirectPath={`/chauffeurs/${chauffeur.id}`}
          errorMessage={docError}
        />
      )}

      {/* Section Accidents + Infractions */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-rose-600" />
              Accidents
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-900">
                {accidentsTotal ?? 0}
              </span>
            </CardTitle>
            <CardDescription>
              Historique des accidents impliquant ce chauffeur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accidentsRecents && accidentsRecents.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {accidentsRecents.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="flex-1 truncate">{a.circonstances}</span>
                    <span className="text-xs text-muted-foreground">
                      {a.date_accident ? new Date(a.date_accident).toLocaleDateString("fr-FR") : ""}
                    </span>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/accidents/${a.id}`}>Voir</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun accident enregistré.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="size-4 text-amber-700" />
              Infractions
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
                {infractionsTotal}
              </span>
              {montantDu > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-900">
                  {montantDu.toLocaleString("fr-FR")} FCFA dûs
                </span>
              )}
            </CardTitle>
            <CardDescription>
              PV et amendes liés à ce chauffeur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {infractionsRecentes.length > 0 ? (
              <ul className="divide-y rounded-md border">
                {infractionsRecentes.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="flex-1 truncate">{i.type_infraction}</span>
                    <span className="text-xs text-muted-foreground">
                      {Number(i.montant_fcfa).toLocaleString("fr-FR")} FCFA
                    </span>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/infractions/${i.id}`}>Voir</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Aucune infraction enregistrée.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/infractions/new?chauffeur=${chauffeur.id}`}>
                  <Gavel className="mr-2 size-4" />
                  Enregistrer une infraction
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone de danger — visible seulement si le user peut supprimer */}
      {canDelete && (
        <Card className="border-rose-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <ShieldAlert className="size-4" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              La suppression est définitive. Les affectations passées et les
              documents associés à ce chauffeur perdront leur référence
              (champ owner_id orphelin dans documents).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteChauffeurButton
              chauffeurId={chauffeur.id}
              chauffeurName={`${chauffeur.prenoms} ${chauffeur.nom}`}
            />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/chauffeurs">
            <ArrowLeft className="mr-2 size-4" />
            Revenir à la liste
          </Link>
        </Button>
      </div>
    </div>
  );
}
