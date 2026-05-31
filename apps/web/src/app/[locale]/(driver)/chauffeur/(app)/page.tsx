import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Truck, ClipboardCheck, AlertTriangle, CheckCircle2, Package, MapPin, MinusCircle, ChevronRight,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadDriverContext, firstName } from "./_components/load-driver";

const FR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export default async function DriverHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checklist?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const { chauffeur, designation } = await loadDriverContext();
  if (!chauffeur) return null; // le layout redirige déjà

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = designation as any;
  const mr = d?.materiel;
  const eq = d?.equipe;
  const mrLabel = mr ? (mr.chrono ? `${mr.chrono} (${mr.immatriculation})` : mr.immatriculation) : null;

  // Check-list du jour faite ?
  let checklistFaite = false;
  let checklistId: string | null = null;
  if (d?.id) {
    const { data: cl } = await supabase
      .from("checklists_depart")
      .select("id, statut_global")
      .eq("designation_id", d.id)
      .maybeSingle();
    checklistFaite = !!cl;
    checklistId = cl?.id ?? null;
  }

  // Conteneurs à livrer (affectés au chauffeur, non livrés)
  const { data: affectations } = await supabase
    .from("affectations")
    .select(`statut, conteneur:conteneurs ( id, numero, client, destination_libre, date_badt, statut )`)
    .eq("chauffeur_id", chauffeur.id)
    .in("statut", ["PLANIFIEE", "EN_COURS"]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conteneurs = (affectations ?? []).map((a: any) => a.conteneur).filter(Boolean);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm capitalize text-muted-foreground">{FR_LONG.format(new Date(today + "T12:00:00"))}</p>
        <h1 className="text-2xl font-bold tracking-tight">Bonjour {firstName(chauffeur.prenoms)}</h1>
      </div>

      {sp.checklist === "ok" && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
          <CheckCircle2 className="size-4" />Check-list enregistrée. Bonne route !
        </div>
      )}

      {/* Désignation du jour */}
      {d ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              <span className="text-lg font-semibold">{mrLabel}</span>
            </div>
            {eq && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: eq.couleur ?? "#3b82f6" }}>
                  {eq.code}
                </span>
                Équipe {eq.nom}
                {eq.heure_debut && eq.heure_fin && <span>· {eq.heure_debut.slice(0, 5)} – {eq.heure_fin.slice(0, 5)}</span>}
              </div>
            )}

            {/* Statut check-list */}
            {checklistFaite ? (
              <Link href={checklistId ? `/chauffeur/checklist?id=${checklistId}` : "#"} className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                <CheckCircle2 className="size-4" />Check-list faite
              </Link>
            ) : (
              <Link href={`/chauffeur/checklist?designation=${d.id}`} className="flex items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                <span className="flex items-center gap-2"><ClipboardCheck className="size-4" />Faire ma check-list de départ</span>
                <ChevronRight className="size-4" />
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-center gap-3 p-4 text-sm text-muted-foreground">
            <MinusCircle className="size-5" />
            Tu n&apos;es pas encore désigné aujourd&apos;hui. Le bureau va t&apos;attribuer un camion.
          </CardContent>
        </Card>
      )}

      {/* Conteneurs à livrer */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Package className="size-4" />Mes conteneurs à livrer
        </h2>
        {conteneurs.length === 0 ? (
          <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">Aucun conteneur à livrer pour le moment.</p>
        ) : (
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {conteneurs.map((c: any) => (
              <Card key={c.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{c.numero}</span>
                      <Badge variant="secondary" className="text-[10px]">{c.statut === "EN_COURS" ? "En cours" : "Planifié"}</Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {c.client && <span>{c.client}</span>}
                      {c.destination_libre && <span className="flex items-center gap-1"><MapPin className="size-3" />{c.destination_libre}</span>}
                      {c.date_badt && <span className="flex items-center gap-1 text-amber-700"><AlertTriangle className="size-3" />BADT {new Date(c.date_badt).toLocaleDateString("fr-FR")}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
