import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, MapPin, Building2, Package, CalendarClock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils/dates";
import { loadAffectationRefs } from "../../../affectations/_components/load-refs";
import { SaisieRecuperationForm } from "../../_components/saisie-recuperation-form";

const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };

/**
 * Saisie d'une récupération à partir de l'EIR papier (chauffeur n'ayant pas
 * validé dans la PWA). On part d'une récupération PLANIFIEE.
 */
export default async function SaisieRecuperationPage({
  params,
}: {
  params: Promise<{ locale: string; recuperationId: string }>;
}) {
  const { locale, recuperationId } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  const { data: recup } = await supabase
    .from("recuperations")
    .select(`id, statut, chauffeur_id, tracteur_id, remorque_id, date_planifiee,
             destination_type, destination_lieu,
             conteneur:conteneurs!recuperations_conteneur_id_fkey (
               id, numero, client, aconier, date_livraison_reelle, destination_libre,
               destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu ),
               types_conteneur ( code_trade )
             )`)
    .eq("id", recuperationId)
    .maybeSingle();

  if (!recup || recup.statut !== "PLANIFIEE") {
    redirect(`/${locale}/saisie-operation?onglet=recuperations`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conteneur = recup!.conteneur as any;
  if (!conteneur) {
    redirect(`/${locale}/saisie-operation?onglet=recuperations`);
  }

  const refs = await loadAffectationRefs({
    conteneurId: conteneur.id,
    chauffeurId: recup!.chauffeur_id,
    tracteurId: recup!.tracteur_id,
    remorqueId: recup!.remorque_id,
  });

  const lieuRecup = conteneur.destination_libre || conteneur.destination?.nom_lieu || "—";
  const destinationLabel =
    recup!.destination_lieu ||
    (recup!.destination_type ? DEST_LABEL[recup!.destination_type] ?? recup!.destination_type : "—");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link
          href="/saisie-operation?onglet=recuperations"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour aux saisies
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Saisir la récupération</h1>
        <p className="text-sm text-muted-foreground">
          À partir de l&apos;EIR rapporté par le chauffeur.
        </p>
      </div>

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
          {conteneur.client && <span className="mr-3">📦 {conteneur.client}</span>}
          <span className="mr-3 inline-flex items-center gap-1">
            <MapPin className="size-3" />
            {lieuRecup}
          </span>
          {conteneur.date_livraison_reelle && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" />
              Livré le {formatDateFR(conteneur.date_livraison_reelle)}
            </span>
          )}
        </AlertDescription>
      </Alert>

      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Infos connues</CardTitle>
          <CardDescription>Pré-remplies depuis la fiche / la planification — non modifiables ici.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <ReadOnly label="Client (lieu de récupération)" value={conteneur.client} />
          <ReadOnly label="Aconier" value={conteneur.aconier} />
          <ReadOnly label="Destination planifiée" value={destinationLabel} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">À compléter depuis l&apos;EIR</CardTitle>
          <CardDescription>
            Renseigne le chauffeur, le matériel, la date et joins le scan / la photo de l&apos;EIR.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SaisieRecuperationForm
            recuperationId={recuperationId}
            defaultChauffeurId={recup!.chauffeur_id}
            defaultTracteurId={recup!.tracteur_id}
            defaultRemorqueId={recup!.remorque_id}
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
