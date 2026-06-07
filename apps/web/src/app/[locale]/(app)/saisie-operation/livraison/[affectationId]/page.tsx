import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, MapPin, Building2, Package } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { loadAffectationRefs } from "../../../affectations/_components/load-refs";
import { SaisieLivraisonForm } from "../../_components/saisie-livraison-form";

/**
 * Saisie d'une livraison à partir de l'EIR papier (chauffeur n'ayant pas validé
 * dans la PWA). On part d'une AFFECTATION active. Les infos auto-remplies
 * (client, lieu, aconier) sont en lecture seule ; l'opérateur complète chauffeur
 * / tracteur / remorque / date + upload le scan EIR.
 */
export default async function SaisieLivraisonPage({
  params,
}: {
  params: Promise<{ locale: string; affectationId: string }>;
}) {
  const { locale, affectationId } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  const { data: aff } = await supabase
    .from("affectations")
    .select(`id, statut, conteneur_id, chauffeur_id, tracteur_id,
             conteneurs!affectations_conteneur_id_fkey (
               id, numero, client, aconier, statut, destination_libre,
               destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu ),
               types_conteneur ( code_trade )
             )`)
    .eq("id", affectationId)
    .maybeSingle();

  if (!aff || !["PLANIFIEE", "EN_COURS"].includes(aff.statut)) {
    redirect(`/${locale}/saisie-operation`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conteneur = aff!.conteneurs as any;
  if (!conteneur || conteneur.statut === "LIVRE") {
    redirect(`/${locale}/saisie-operation`);
  }

  const refs = await loadAffectationRefs({
    conteneurId: conteneur.id,
    chauffeurId: aff!.chauffeur_id,
    tracteurId: aff!.tracteur_id,
  });

  const lieu = conteneur.destination_libre || conteneur.destination?.nom_lieu || "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/saisie-operation?onglet=livraisons"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour aux saisies
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Saisir la livraison</h1>
        <p className="text-sm text-muted-foreground">
          À partir de l&apos;EIR rapporté par le chauffeur.
        </p>
      </div>

      {/* Carte conteneur (en-tête) */}
      <Alert>
        <AlertTitle className="flex items-center gap-2 font-semibold">
          <Package className="size-4" />
          {conteneur.numero}
          {conteneur.types_conteneur?.code_trade && (
            <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              {conteneur.types_conteneur.code_trade}
            </span>
          )}
        </AlertTitle>
        <AlertDescription>
          {conteneur.aconier && (
            <span className="mr-3 inline-flex items-center gap-1">
              <Building2 className="size-3" />
              {conteneur.aconier}
            </span>
          )}
          {conteneur.client && (
            <span className="mr-3">📦 {conteneur.client}</span>
          )}
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {lieu}
          </span>
        </AlertDescription>
      </Alert>

      {/* Infos auto-remplies (lecture seule, fond gris) */}
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Infos connues du conteneur</CardTitle>
          <CardDescription>Pré-remplies depuis la fiche conteneur — non modifiables ici.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <ReadOnly label="Client" value={conteneur.client} />
          <ReadOnly label="Lieu de livraison" value={lieu} />
          <ReadOnly label="Aconier" value={conteneur.aconier} />
        </CardContent>
      </Card>

      {/* Formulaire de saisie */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">À compléter depuis l&apos;EIR</CardTitle>
          <CardDescription>
            Renseigne le chauffeur, le matériel, la date et joins le scan / la photo de l&apos;EIR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaisieLivraisonForm
            affectationId={affectationId}
            defaultChauffeurId={aff!.chauffeur_id}
            defaultTracteurId={aff!.tracteur_id}
            chauffeurs={refs.chauffeurs}
            tracteurs={refs.tracteurs}
            remorques={refs.remorques}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value && value.trim() ? value : <span className="text-muted-foreground">—</span>}</p>
    </div>
  );
}
