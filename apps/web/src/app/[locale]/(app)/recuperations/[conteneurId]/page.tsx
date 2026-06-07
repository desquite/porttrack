import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, MapPin, CalendarClock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils/dates";
import { loadAffectationRefs } from "../../affectations/_components/load-refs";
import { loadDesignationsDuJour } from "../../affectations/_components/load-designations";
import { PlanifierForm } from "../_components/planifier-form";

type ModeLivraison = "REMORQUE_COUPEE" | "CLIENT_DECHARGE" | "AUTO_CHARGEUR";

/**
 * Planification de la récupération d'un conteneur livré : on affecte le camion
 * + chauffeur qui iront récupérer le vide, et la destination (parc / terminal).
 */
export default async function PlanifierRecuperationPage({
  params,
}: {
  params: Promise<{ locale: string; conteneurId: string }>;
}) {
  const { locale, conteneurId } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  const { data: conteneur } = await supabase
    .from("conteneurs")
    .select(`id, numero, client, statut, date_livraison_reelle, destination_libre,
      destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu )`)
    .eq("id", conteneurId)
    .maybeSingle();

  if (!conteneur || conteneur.statut !== "LIVRE") {
    redirect(`/${locale}/recuperations`);
  }

  // Déjà une récupération active ? → retour à la liste (pas de double planif).
  const { data: existing } = await supabase
    .from("recuperations")
    .select("id, statut")
    .eq("conteneur_id", conteneurId)
    .neq("statut", "ANNULEE")
    .maybeSingle();
  if (existing) {
    redirect(`/${locale}/recuperations`);
  }

  const refs = await loadAffectationRefs();
  const designationsJour = await loadDesignationsDuJour();

  // Contexte de la livraison initiale (mode + remorque éventuellement coupée)
  // → conditionne les champs du formulaire de planification.
  const { data: eirRow } = await supabase
    .from("eir_archives")
    .select("mode_livraison, remorque_id, remorque_immat, date_livraison")
    .eq("conteneur_id", conteneurId)
    .order("date_livraison", { ascending: false })
    .limit(1)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eir = eirRow as any;
  const modeLivraison: ModeLivraison | null = (eir?.mode_livraison ?? null) as ModeLivraison | null;

  const lieu = conteneur!.destination_libre || conteneur!.destination?.nom_lieu || "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-1">
        <Link href="/recuperations" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux récupérations
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Planifier la récupération</h1>
      </div>

      <Alert>
        <AlertTitle className="font-semibold">{conteneur!.numero}{conteneur!.client ? ` — ${conteneur!.client}` : ""}</AlertTitle>
        <AlertDescription>
          <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{lieu}</span>
          {"  ·  "}
          <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" />Livré le {formatDateFR(conteneur!.date_livraison_reelle)}</span>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Affectation de la mission</CardTitle>
          <CardDescription>Le chauffeur partira récupérer le vide et le ramènera à la destination choisie.</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanifierForm
            conteneurId={conteneurId}
            chauffeurs={refs.chauffeurs}
            tracteurs={refs.tracteurs}
            remorques={refs.remorques}
            designationsJour={designationsJour}
            modeLivraison={modeLivraison}
            livraisonRemorqueId={eir?.remorque_id ?? null}
            livraisonRemorqueImmat={eir?.remorque_immat ?? null}
            livraisonDate={eir?.date_livraison ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
