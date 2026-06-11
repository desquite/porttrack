import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { BarChart3, Trophy, TrendingUp, Package } from "lucide-react";

import { firstAllowedHref, parsePermissions, type Role } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import {
  makePeriod, previousYearPeriod, monthsOfYear,
  variationPct, type PeriodKind,
} from "@/lib/bilan/periods";
import {
  aggregateByAconier, aggregateByZone, inRange, canonLabel, dedupeLabels,
  type ConteneurLivre,
} from "@/lib/bilan/aggregate";

import { PeriodSelector } from "./_components/period-selector";
import { AconierFilter } from "./_components/aconier-filter";
import { MonthlyBars } from "./_components/monthly-bars";
import { AconierDonut } from "./_components/aconier-donut";
import { EvolutionLines } from "./_components/evolution-lines";
import { SummaryTable } from "./_components/summary-table";
import { TopZones } from "./_components/top-zones";
import { ExportButton } from "./_components/export-button";

type TypeMeta = { id: string; taille_pieds: number };

/** Indice par défaut selon le kind et la date courante. */
function defaultIndex(kind: PeriodKind, now = new Date()): number {
  const m = now.getMonth() + 1;
  if (kind === "mois") return m;
  if (kind === "trimestre") return Math.ceil(m / 3);
  if (kind === "semestre") return m <= 6 ? 1 : 2;
  return 1;
}

/**
 * Bilan d'activité par aconier (Manager uniquement).
 *
 * Compte uniquement les conteneurs livrés (statut = LIVRE) sur la base de
 * `date_livraison_reelle`. La comparaison N-1 = même période un an plus tôt
 * (juin 2026 vs juin 2025), masquée si l'historique est vide.
 */
export default async function BilanAconiersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    periode?: string;
    annee?: string;
    index?: string;
    aconier?: string;
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  // ---------- Garde Manager / Super Admin uniquement ----------
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);
  const { data: me } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user.id)
    .maybeSingle();
  const role = (me?.role ?? "CUSTOM") as Role;
  if (role !== "MANAGER" && role !== "SUPER_ADMIN") {
    redirect(`/${locale}${firstAllowedHref(role, parsePermissions(me?.permissions))}`);
  }

  // ---------- Lecture des paramètres URL ----------
  const kind: PeriodKind =
    sp.periode === "trimestre" || sp.periode === "semestre" || sp.periode === "annee"
      ? sp.periode
      : "mois";

  const now = new Date();
  const year = sp.annee && /^\d{4}$/.test(sp.annee) ? parseInt(sp.annee) : now.getFullYear();
  const index = sp.index && /^\d{1,2}$/.test(sp.index)
    ? parseInt(sp.index)
    : defaultIndex(kind, now);

  const period = makePeriod(kind, year, index);
  const prevPeriod = previousYearPeriod(period);
  const aconierFilter = sp.aconier?.trim() || null;

  // ---------- Fetch en parallèle ----------
  // On tire 2 années pleines (N et N-1) — borne d'analyse pour l'histogramme YoY.
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;
  const prevYearStart = `${year - 1}-01-01`;
  const prevYearEnd = `${year}-01-01`;

  const baseSelect = "id, aconier, type_conteneur_id, destination_libre, poids_kg, date_livraison_reelle";

  let qCurr = supabase
    .from("conteneurs")
    .select(baseSelect)
    .eq("statut", "LIVRE")
    .gte("date_livraison_reelle", yearStart)
    .lt("date_livraison_reelle", yearEnd);
  let qPrev = supabase
    .from("conteneurs")
    .select(baseSelect)
    .eq("statut", "LIVRE")
    .gte("date_livraison_reelle", prevYearStart)
    .lt("date_livraison_reelle", prevYearEnd);

  if (aconierFilter) {
    // ilike sans joker = égalité insensible à la casse → attrape « Medlog
    // Transport » ET « MEDLOG TRANSPORT » (on échappe les jokers SQL).
    const pattern = aconierFilter.replace(/[%_]/g, "\\$&");
    qCurr = qCurr.ilike("aconier", pattern);
    qPrev = qPrev.ilike("aconier", pattern);
  }

  const [currRes, prevRes, typesRes, aconiersRes] = await Promise.all([
    qCurr,
    qPrev,
    supabase.from("types_conteneur").select("id, taille_pieds"),
    // Liste des aconiers connus du tenant (pour le dropdown) — tous statuts, toutes périodes
    supabase
      .from("conteneurs")
      .select("aconier")
      .not("aconier", "is", null)
      .limit(5000),
  ]);

  const currAll = (currRes.data ?? []) as ConteneurLivre[];
  const prevAll = (prevRes.data ?? []) as ConteneurLivre[];
  const types = (typesRes.data ?? []) as TypeMeta[];
  const aconiersRaw = (aconiersRes.data ?? []) as Array<{ aconier: string | null }>;

  const typeSizeById = new Map(types.map((t) => [t.id, t.taille_pieds] as const));
  // Dédupliqué par clé canonique : une seule entrée par aconier quelle que
  // soit la casse saisie à l'import.
  const distinctAconiers = dedupeLabels(aconiersRaw.map((r) => r.aconier));

  // ---------- Filtre par PÉRIODE COURANTE / PRÉCÉDENTE (sous-ensemble de l'année) ----------
  const currPeriod = currAll.filter((c) =>
    inRange(c.date_livraison_reelle, period.startISO, period.endExclusiveISO),
  );
  const prevPeriodArr = prevAll.filter((c) =>
    inRange(c.date_livraison_reelle, prevPeriod.startISO, prevPeriod.endExclusiveISO),
  );

  // ---------- Agrégations ----------

  // 1) KPI globaux
  const totalCurr = currPeriod.length;
  const totalPrev = prevPeriodArr.length;
  const variation = variationPct(totalCurr, totalPrev);

  // 2) Répartition par aconier (période courante)
  const byAconier = aggregateByAconier(currPeriod, prevPeriodArr, typeSizeById);
  const topAconier = byAconier[0] ?? null;

  // 3) Histogramme mensuel YoY (12 mois année N vs N-1)
  const months = monthsOfYear(year);
  const monthlyData = months.map((m) => {
    const cntN = currAll.filter((c) =>
      inRange(c.date_livraison_reelle, m.startISO, m.endExclusiveISO),
    ).length;
    const sameMonthPrev = `${year - 1}-${String(m.month).padStart(2, "0")}-01`;
    const sameMonthPrevEnd = `${m.month === 12 ? year : year - 1}-${String(m.month === 12 ? 1 : m.month + 1).padStart(2, "0")}-01`;
    const cntPrev = prevAll.filter((c) =>
      inRange(c.date_livraison_reelle, sameMonthPrev, sameMonthPrevEnd),
    ).length;
    return { mois: m.label, [`${year}`]: cntN, [`${year - 1}`]: cntPrev };
  });
  const hasPrevYearData = prevAll.length > 0;

  // 4) Évolution mensuelle par aconier (top 5 sur la période courante).
  // Comparaison canonique : toutes les graphies d'un même aconier comptent.
  const top5 = byAconier.slice(0, 5).map((a) => a.aconier);
  const top5Canon = top5.map((ac) => canonLabel(ac));
  const evolutionData = months.map((m) => {
    const slot: Record<string, string | number> = { mois: m.label };
    top5.forEach((ac, i) => {
      slot[ac] = currAll.filter(
        (c) =>
          canonLabel(c.aconier) === top5Canon[i] &&
          inRange(c.date_livraison_reelle, m.startISO, m.endExclusiveISO),
      ).length;
    });
    return slot;
  });

  // 5) Top zones (top 10 sur la période courante)
  const topZones = aggregateByZone(currPeriod).slice(0, 10);

  // 6) Donut data (aconier + part)
  const donutData = byAconier.map((a) => ({
    aconier: a.aconier,
    livres: a.livres,
  }));

  // ---------- Rendu ----------
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            Bilan d&apos;activité par aconier
          </h1>
          <p className="text-sm text-muted-foreground">
            Livraisons confirmées (EIR archivé) — période sélectionnée :{" "}
            <span className="font-medium text-foreground">{period.label}</span>
          </p>
        </div>
        <ExportButton
          periode={kind}
          annee={year}
          index={index}
          aconier={aconierFilter}
        />
      </header>

      {/* Sélecteurs */}
      <Card>
        <CardContent className="pt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <PeriodSelector kind={kind} year={year} index={index} />
          <AconierFilter aconiers={distinctAconiers} selected={aconierFilter} />
        </CardContent>
      </Card>

      {/* KPI */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          icon={<Package className="size-5" />}
          label="Conteneurs livrés"
          value={totalCurr.toLocaleString("fr-FR")}
          hint={`sur ${period.label}`}
        />
        <KpiCard
          icon={<TrendingUp className="size-5" />}
          label="vs même période N-1"
          value={
            variation == null
              ? "—"
              : `${variation > 0 ? "+" : ""}${variation.toFixed(1)}%`
          }
          hint={
            variation == null
              ? "Pas d'historique"
              : `${totalPrev} en ${prevPeriod.label}`
          }
          tone={variation == null ? "muted" : variation >= 0 ? "ok" : "warn"}
        />
        <KpiCard
          icon={<Trophy className="size-5" />}
          label="Aconier n°1"
          value={topAconier?.aconier ?? "—"}
          hint={
            topAconier
              ? `${topAconier.livres} conteneur(s) · ${topAconier.partPct.toFixed(0)}%`
              : "Aucune livraison"
          }
        />
      </section>

      {/* Histogramme YoY */}
      <Card>
        <CardHeader>
          <CardTitle>Livraisons par mois — {year}{hasPrevYearData ? ` vs ${year - 1}` : ""}</CardTitle>
          <CardDescription>
            {hasPrevYearData
              ? "Comparaison année courante vs année précédente."
              : "L'historique de l'année précédente sera affiché dès qu'il y aura des données."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBars
            data={monthlyData}
            currentYearKey={String(year)}
            previousYearKey={hasPrevYearData ? String(year - 1) : null}
          />
        </CardContent>
      </Card>

      {/* Donut + Évolution lignes côte à côte */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Répartition par aconier</CardTitle>
            <CardDescription>{period.label}</CardDescription>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <EmptyChart />
            ) : (
              <AconierDonut data={donutData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Évolution mensuelle — top 5 aconiers ({year})</CardTitle>
            <CardDescription>
              Nombre de conteneurs livrés par mois pour chaque aconier.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {top5.length === 0 ? (
              <EmptyChart />
            ) : (
              <EvolutionLines data={evolutionData} aconiers={top5} />
            )}
          </CardContent>
        </Card>
      </section>

      {/* Tableau récap */}
      <Card>
        <CardHeader>
          <CardTitle>Détail par aconier — {period.label}</CardTitle>
          <CardDescription>
            Triable. La variation N-1 compare avec {prevPeriod.label}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SummaryTable
            rows={byAconier}
            totalCurr={totalCurr}
            hasPrev={prevPeriodArr.length > 0}
          />
        </CardContent>
      </Card>

      {/* Top zones */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 zones de livraison — {period.label}</CardTitle>
        </CardHeader>
        <CardContent>
          {topZones.length === 0 ? (
            <EmptyChart />
          ) : (
            <TopZones data={topZones} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Helpers de rendu
// ============================================================================

function KpiCard({
  icon, label, value, hint, tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "muted";
}) {
  const toneClass =
    tone === "ok" ? "text-emerald-600"
    : tone === "warn" ? "text-rose-600"
    : tone === "muted" ? "text-muted-foreground"
    : "text-foreground";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
      Aucune donnée sur la période.
    </div>
  );
}
