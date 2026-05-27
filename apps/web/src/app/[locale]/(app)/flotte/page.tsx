import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Truck, Plus, Gauge, Calendar, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  classifyExpiry,
  EXPIRY_BADGE_VARIANT,
  formatDateFR,
  formatExpiryLabel,
} from "@/lib/utils/dates";
import type { Database } from "@porttrack/shared";

type Materiel = Database["public"]["Tables"]["materiel_roulant"]["Row"];
type MaterielType = Database["public"]["Enums"]["materiel_type"];
type MaterielEtat = Database["public"]["Enums"]["materiel_etat"];

// Libellés FR courts pour les types de matériel
const TYPE_LABEL: Record<MaterielType, string> = {
  TRACTEUR:              "Tracteur",
  REMORQUE:              "Remorque",
  SEMI_REMORQUE:         "Semi-remorque",
  PORTE_CONTENEUR_20:    "Porte-conteneur 20'",
  PORTE_CONTENEUR_40:    "Porte-conteneur 40'",
  PORTE_CONTENEUR_MIXTE: "Porte-conteneur mixte",
};

// Couleurs des badges d'état
const ETAT_VARIANT: Record<
  MaterielEtat,
  "success" | "warning" | "danger" | "secondary"
> = {
  EN_SERVICE:    "success",
  EN_REPARATION: "warning",
  EN_PANNE:      "danger",
  HORS_SERVICE:  "secondary",
  VENDU:         "secondary",
};

const ETAT_LABEL: Record<MaterielEtat, string> = {
  EN_SERVICE:    "En service",
  EN_REPARATION: "En réparation",
  EN_PANNE:      "En panne",
  HORS_SERVICE:  "Hors service",
  VENDU:         "Vendu",
};

// Configuration des 5 documents à afficher (label court + clé dans la row)
const DOCS: Array<{ key: keyof Materiel; label: string }> = [
  { key: "assurance_fin",          label: "Assurance" },
  { key: "visite_technique_fin",   label: "VT" },
  { key: "vignette_fin",           label: "Vignette" },
  { key: "patente_fin",            label: "Patente" },
  { key: "autorisation_dgttc_fin", label: "DGTTC" },
];

export default async function FlottePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { locale } = await params;
  const { created } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  const { data: materiels, error } = await supabase
    .from("materiel_roulant")
    .select("*")
    .order("immatriculation", { ascending: true });

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-rose-700">
            Erreur de chargement : {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  const total = materiels?.length ?? 0;
  const enService = materiels?.filter((m) => m.etat === "EN_SERVICE").length ?? 0;
  const alertes = materiels?.filter((m) =>
    DOCS.some((d) => {
      const status = classifyExpiry(m[d.key] as string | null);
      return status === "expired" || status === "soon";
    }),
  ).length ?? 0;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Flotte</h1>
          <p className="text-sm text-muted-foreground">
            {total} véhicule{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""} —{" "}
            {enService} en service, {alertes} avec alerte{alertes > 1 ? "s" : ""}.
          </p>
        </div>
        <Button asChild>
          <Link href="/flotte/new">
            <Plus className="mr-2 size-4" />
            Nouveau véhicule
          </Link>
        </Button>
      </div>

      {/* Flash de confirmation après création */}
      {created && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Véhicule créé</AlertTitle>
          <AlertDescription>
            <strong className="font-mono">{created}</strong> a été ajouté à la flotte.
          </AlertDescription>
        </Alert>
      )}

      {/* Liste */}
      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Truck className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucun matériel enregistré</CardTitle>
            <CardDescription>
              Ajoutez vos premiers tracteurs, remorques ou porte-conteneurs.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {materiels!.map((m) => (
            <MaterielCard key={m.id} materiel={m} />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function MaterielCard({ materiel: m }: { materiel: Materiel }) {
  const formatKm = (km: number | string | null) =>
    km == null ? "—" : `${Number(km).toLocaleString("fr-FR")} km`;

  const formatTonnes = (t: number | string | null) =>
    t == null ? "—" : `${Number(t).toFixed(1)} t`;

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="space-y-3 p-4">
        {/* Ligne 1 : icône + immat + identification + état */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Truck className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-base font-semibold">
                {m.immatriculation}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {TYPE_LABEL[m.type]}
              </Badge>
              <Badge variant={ETAT_VARIANT[m.etat]} className="text-[10px]">
                {ETAT_LABEL[m.etat]}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {(m.marque || m.modele) && (
                <span>
                  {m.marque ?? ""} {m.modele ?? ""}
                  {m.annee ? ` (${m.annee})` : ""}
                </span>
              )}
              {m.capacite_tonnes != null && (
                <span>Capacité {formatTonnes(m.capacite_tonnes)}</span>
              )}
              {m.kilometrage_actuel != null && (
                <span className="flex items-center gap-1">
                  <Gauge className="size-3" />
                  {formatKm(m.kilometrage_actuel)}
                </span>
              )}
            </div>
          </div>

          <Button variant="outline" size="sm" disabled title="Page détail bientôt disponible">
            Voir
          </Button>
        </div>

        {/* Ligne 2 : 5 documents en grille */}
        <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:grid-cols-3 lg:grid-cols-5">
          {DOCS.map((d) => {
            const dateIso = m[d.key] as string | null;
            const status = classifyExpiry(dateIso);
            return (
              <div key={d.key as string} className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Calendar className="size-3" />
                  {d.label}
                </div>
                <div className="text-xs">{formatDateFR(dateIso)}</div>
                <Badge variant={EXPIRY_BADGE_VARIANT[status]} className="text-[10px]">
                  {formatExpiryLabel(dateIso)}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
