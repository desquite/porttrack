import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, PackageCheck, MapPin, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { MATERIEL_TYPES } from "@porttrack/shared";
import { loadDriverContext } from "../_components/load-driver";
import { ConfirmDeliveryForm, type RemorqueOption } from "./_components/confirm-delivery-form";

// Types « porteur de conteneur » = remorques / châssis (tout sauf le tracteur)
const REMORQUE_TYPES = MATERIEL_TYPES.filter((t) => t !== "TRACTEUR");

export default async function DriverDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ conteneur?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const { chauffeur } = await loadDriverContext();
  if (!chauffeur) return null;
  const conteneurId = sp.conteneur;
  if (!conteneurId) redirect("/chauffeur");

  const supabase = await createClient();

  // Conteneur (RLS : seulement s'il lui est affecté)
  const { data: cont } = await supabase
    .from("conteneurs")
    .select("id, numero, client, destination_libre, statut")
    .eq("id", conteneurId)
    .maybeSingle();
  if (!cont) notFound();

  // Déjà livré ?
  if (cont.statut === "LIVRE") {
    return (
      <div className="space-y-5">
        <Header numero={cont.numero} />
        <Card className="border-emerald-300 bg-emerald-50/50">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="size-6 text-emerald-600" />
            <div className="text-sm font-medium">Ce conteneur est déjà livré.</div>
          </CardContent>
        </Card>
        <Link href="/chauffeur" className="block text-center text-sm text-primary">← Retour à ma journée</Link>
      </div>
    );
  }

  // Affectation pour pré-remplir la remorque planifiée
  const { data: aff } = await supabase
    .from("affectations")
    .select("remorque_id")
    .eq("conteneur_id", conteneurId)
    .eq("chauffeur_id", chauffeur.id)
    .maybeSingle();

  // Remorques / châssis en service du tenant
  const { data: materiels } = await supabase
    .from("materiel_roulant")
    .select("id, immatriculation, chrono, type, etat")
    .eq("etat", "EN_SERVICE")
    .in("type", REMORQUE_TYPES)
    .order("immatriculation", { ascending: true });

  const remorques: RemorqueOption[] = (materiels ?? []).map((m) => ({
    id: m.id,
    label: m.chrono ? `${m.chrono} (${m.immatriculation})` : m.immatriculation,
  }));

  return (
    <div className="space-y-5">
      <Header numero={cont.numero} />
      <div className="rounded-lg border bg-background p-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {cont.client && <span>{cont.client}</span>}
          {cont.destination_libre && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{cont.destination_libre}</span>}
        </div>
      </div>

      <ConfirmDeliveryForm
        conteneurId={cont.id}
        remorques={remorques}
        defaultRemorqueId={aff?.remorque_id ?? null}
      />
    </div>
  );
}

function Header({ numero }: { numero: string }) {
  return (
    <div className="space-y-1">
      <Link href="/chauffeur" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" />Ma journée
      </Link>
      <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
        <PackageCheck className="size-5 text-primary" />Confirmer la livraison
      </h1>
      <p className="font-mono text-sm text-muted-foreground">📦 {numero}</p>
    </div>
  );
}
