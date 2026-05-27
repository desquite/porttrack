import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Users, Plus, Phone, Mail, IdCard } from "lucide-react";

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
import {
  classifyExpiry,
  EXPIRY_BADGE_VARIANT,
  formatDateFR,
  formatExpiryLabel,
} from "@/lib/utils/dates";
import type { Database } from "@porttrack/shared";

type Chauffeur = Database["public"]["Tables"]["chauffeurs"]["Row"];
type ChauffeurStatut = Database["public"]["Enums"]["chauffeur_statut"];

const STATUT_VARIANT: Record<ChauffeurStatut, "success" | "info" | "warning" | "secondary"> = {
  ACTIF:    "success",
  EN_CONGE: "info",
  SUSPENDU: "warning",
  INACTIF:  "secondary",
};

const STATUT_LABEL: Record<ChauffeurStatut, string> = {
  ACTIF:    "Actif",
  EN_CONGE: "En congé",
  SUSPENDU: "Suspendu",
  INACTIF:  "Inactif",
};

export default async function ChauffeursPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();

  const { data: chauffeurs, error } = await supabase
    .from("chauffeurs")
    .select("*")
    .order("nom", { ascending: true });

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

  const total = chauffeurs?.length ?? 0;
  const actifs = chauffeurs?.filter((c) => c.statut === "ACTIF").length ?? 0;
  const alertes = chauffeurs?.filter(
    (c) =>
      classifyExpiry(c.permis_expiration) !== "ok" ||
      classifyExpiry(c.visite_medicale_expiration) !== "ok",
  ).length ?? 0;

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chauffeurs</h1>
          <p className="text-sm text-muted-foreground">
            {total} chauffeur{total > 1 ? "s" : ""} enregistré{total > 1 ? "s" : ""} —{" "}
            {actifs} actif{actifs > 1 ? "s" : ""}, {alertes} avec alerte
            {alertes > 1 ? "s" : ""}.
          </p>
        </div>
        <Button disabled title="Bientôt disponible">
          <Plus className="mr-2 size-4" />
          Nouveau chauffeur
        </Button>
      </div>

      {/* Liste */}
      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucun chauffeur</CardTitle>
            <CardDescription>
              Commencez par créer un chauffeur pour le voir apparaître ici.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {chauffeurs!.map((c) => (
            <ChauffeurCard key={c.id} chauffeur={c} />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function ChauffeurCard({ chauffeur: c }: { chauffeur: Chauffeur }) {
  const permisStatus = classifyExpiry(c.permis_expiration);
  const visiteStatus = classifyExpiry(c.visite_medicale_expiration);

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        {/* Avatar + nom */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {c.prenoms.charAt(0)}
            {c.nom.charAt(0)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium truncate">
                {c.prenoms} {c.nom}
              </span>
              <Badge variant={STATUT_VARIANT[c.statut]} className="text-[10px]">
                {STATUT_LABEL[c.statut]}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="size-3" />
                {c.telephone}
              </span>
              {c.email && (
                <span className="flex items-center gap-1">
                  <Mail className="size-3" />
                  {c.email}
                </span>
              )}
              {c.numero_cni && (
                <span className="flex items-center gap-1">
                  <IdCard className="size-3" />
                  {c.numero_cni}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Permis */}
        <DocCell
          label="Permis"
          dateIso={c.permis_expiration}
          status={permisStatus}
          extra={c.categories_permis?.join(" + ") ?? "—"}
        />

        {/* Visite médicale */}
        <DocCell
          label="Visite méd."
          dateIso={c.visite_medicale_expiration}
          status={visiteStatus}
        />

        {/* Lien voir (placeholder) */}
        <div className="ml-auto">
          <Button variant="outline" size="sm" disabled title="Page détail bientôt disponible">
            Voir
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DocCell({
  label,
  dateIso,
  status,
  extra,
}: {
  label: string;
  dateIso: string | null;
  status: ReturnType<typeof classifyExpiry>;
  extra?: string;
}) {
  return (
    <div className="min-w-[140px]">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label} {extra && <span className="text-foreground/70">({extra})</span>}
      </div>
      <div className="mt-0.5 text-xs">{formatDateFR(dateIso)}</div>
      <Badge variant={EXPIRY_BADGE_VARIANT[status]} className="mt-1 text-[10px]">
        {formatExpiryLabel(dateIso)}
      </Badge>
    </div>
  );
}
