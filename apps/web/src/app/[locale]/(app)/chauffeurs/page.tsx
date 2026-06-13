import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Users, Plus, Phone, Mail, IdCard, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

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
import { Pagination } from "@/components/ui/pagination";
import {
  classifyExpiry,
  EXPIRY_BADGE_VARIANT,
  formatDateFR,
  formatExpiryLabel,
} from "@/lib/utils/dates";
import type { Database } from "@porttrack/shared";
import { CHAUFFEUR_STATUTS, normalizeForSearch } from "@porttrack/shared";
import { ChauffeursFilters } from "./_components/chauffeurs-filters";

type Chauffeur = Database["public"]["Tables"]["chauffeurs"]["Row"];
type ChauffeurStatut = Database["public"]["Enums"]["chauffeur_statut"];
// Ligne chauffeur enrichie d'un sous-objet equipe (join Supabase)
type ChauffeurAvecEquipe = Chauffeur & {
  equipe: { id: string; nom: string; code: string; couleur: string | null } | null;
};

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

const PAGE_SIZE = 20;

export default async function ChauffeursPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    created?: string;
    deleted?: string;
    q?: string;
    statut?: string;
    alerte?: string;
    page?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  // -----------------------------------------------------------------------
  // 1. Compteurs globaux (sans filtre) — pour le header "X chauffeurs au total"
  // -----------------------------------------------------------------------
  const { count: totalGlobal } = await supabase
    .from("chauffeurs")
    .select("*", { count: "exact", head: true });

  // -----------------------------------------------------------------------
  // 2. Requête filtrée + paginée
  // -----------------------------------------------------------------------
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from("chauffeurs")
    // Join Supabase sur la FK equipe_id_defaut → on récupère le code/nom/couleur
    // de l'équipe pour l'afficher sur la carte.
    .select("*, equipe:equipes(id, nom, code, couleur)", { count: "exact" })
    .order("nom", { ascending: true })
    .range(from, to);

  // Recherche texte tolérante aux accents et à la casse : on cherche dans
  // la colonne générée `search_text` qui contient lower+unaccent de tous les
  // champs cherchables. La requête côté JS est normalisée de la même façon.
  const q = sp.q?.trim();
  if (q) {
    const qNorm = normalizeForSearch(q).replace(/[%_]/g, "");
    if (qNorm) {
      query = query.ilike("search_text", `%${qNorm}%`);
    }
  }

  // Filtre statut (validé contre l'enum)
  const statut = sp.statut?.trim();
  if (statut && (CHAUFFEUR_STATUTS as readonly string[]).includes(statut)) {
    query = query.eq("statut", statut as ChauffeurStatut);
  }

  // Filtre alerte — on calcule des bornes de dates
  const alerte = sp.alerte?.trim();
  if (alerte === "expired") {
    // Au moins un doc expiré (date passée)
    const today = new Date().toISOString().slice(0, 10);
    query = query.or(
      `permis_expiration.lt.${today},visite_medicale_expiration.lt.${today}`,
    );
  } else if (alerte === "soon") {
    // Au moins un doc qui expire dans les 30 prochains jours (mais pas encore expiré)
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const horizonIso = horizon.toISOString().slice(0, 10);
    query = query.or(
      [
        `and(permis_expiration.gte.${today},permis_expiration.lte.${horizonIso})`,
        `and(visite_medicale_expiration.gte.${today},visite_medicale_expiration.lte.${horizonIso})`,
      ].join(","),
    );
  } else if (alerte === "ok") {
    // Les deux dates >= aujourd'hui + 30j
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    const horizonIso = horizon.toISOString().slice(0, 10);
    query = query
      .gte("permis_expiration", horizonIso)
      .gte("visite_medicale_expiration", horizonIso);
  }

  const { data: chauffeurs, count: filteredCount, error } = await query;

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

  const total = filteredCount ?? 0;
  const isFiltered = !!(q || statut || alerte);

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chauffeurs</h1>
          <p className="text-sm text-muted-foreground">
            {isFiltered ? (
              <>
                <strong className="text-foreground">{total}</strong> résultat{total > 1 ? "s" : ""} sur{" "}
                {totalGlobal ?? 0} chauffeur{(totalGlobal ?? 0) > 1 ? "s" : ""} au total
              </>
            ) : (
              <>
                <strong className="text-foreground">{totalGlobal ?? 0}</strong> chauffeur
                {(totalGlobal ?? 0) > 1 ? "s" : ""} enregistré
                {(totalGlobal ?? 0) > 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/chauffeurs/new">
            <Plus className="mr-2 size-4" />
            Nouveau chauffeur
          </Link>
        </Button>
      </div>

      {/* Flashes */}
      {sp.created && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Chauffeur créé</AlertTitle>
          <AlertDescription>
            <strong>{sp.created}</strong> a été ajouté à la liste.
          </AlertDescription>
        </Alert>
      )}
      {sp.deleted && (
        <Alert className="border-rose-200 bg-rose-50/60 text-rose-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Chauffeur supprimé</AlertTitle>
          <AlertDescription>
            <strong>{sp.deleted}</strong> a été supprimé de la liste.
          </AlertDescription>
        </Alert>
      )}

      {/* Filtres */}
      <ChauffeursFilters />

      {/* Liste */}
      {total === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">
              {isFiltered ? "Aucun résultat" : "Aucun chauffeur"}
            </CardTitle>
            <CardDescription>
              {isFiltered
                ? "Aucun chauffeur ne correspond à tes filtres. Essaie de les élargir."
                : "Commence par créer un chauffeur pour le voir apparaître ici."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-3">
            {(chauffeurs as ChauffeurAvecEquipe[]).map((c) => (
              <ChauffeurCard key={c.id} chauffeur={c} />
            ))}
          </div>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            pathname="/chauffeurs"
            itemLabel="chauffeur"
            className="rounded-md border bg-background"
          />
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function ChauffeurCard({ chauffeur: c }: { chauffeur: ChauffeurAvecEquipe }) {
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
              {/* Équipe : pastille couleur + code/nom */}
              {c.equipe ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium text-foreground/80">
                  <span
                    aria-hidden
                    className="inline-block size-2 rounded-full"
                    style={{ backgroundColor: c.equipe.couleur ?? "#94a3b8" }}
                  />
                  {c.equipe.code} — {c.equipe.nom}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md border border-dashed px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Sans équipe
                </span>
              )}
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

        {/* Lien vers la page édition */}
        <div className="ml-auto">
          <Button asChild variant="outline" size="sm">
            <Link href={`/chauffeurs/${c.id}`}>Modifier</Link>
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
