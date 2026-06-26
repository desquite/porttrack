import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Megaphone, ChevronLeft, ChevronRight, RotateCcw, Lock, CalendarClock, Sun, Moon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  equipeForPoste,
  isRoulementConfigValide,
  ROULEMENT_POSTE_HORAIRES,
  type RoulementConfig,
  type Database,
} from "@porttrack/shared";
import { DesignationBoard, type BoardPair, type BoardOption } from "./_components/designation-board";

type DesignationPoste = Database["public"]["Enums"]["designation_poste"];

const FR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
function truckLabel(m: { immatriculation: string; chrono: string | null }): string {
  return m.chrono ? `${m.chrono} (${m.immatriculation})` : m.immatriculation;
}

export default async function DesignationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; poste?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const today = isoDate(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const poste: DesignationPoste = sp.poste === "NUIT" ? "NUIT" : "JOUR";
  const dateLabel = FR_LONG.format(new Date(date + "T12:00:00"));

  const locked = date < today;                       // date passée = verrouillée
  const horsDelai = date > addDays(today, 30);        // au-delà de J+30

  const supabase = await createClient();

  // 0) Roulement (pour filtrer les chauffeurs désignables au poste choisi)
  const { data: configRow } = await supabase
    .from("roulement_config")
    .select("date_reference, equipe_jour_id, equipe_nuit_id, equipe_repos_id")
    .maybeSingle();
  const config: RoulementConfig | null = configRow
    ? {
        dateReference: configRow.date_reference,
        equipeJourId: configRow.equipe_jour_id,
        equipeNuitId: configRow.equipe_nuit_id,
        equipeReposId: configRow.equipe_repos_id,
      }
    : null;
  const roulementActif = isRoulementConfigValide(config);
  // Équipe sur le poste choisi ce jour-là (si roulement configuré).
  const equipeDuPoste = roulementActif ? equipeForPoste(config!, poste, date) : null;
  let equipeDuPosteNom: string | null = null;
  if (equipeDuPoste) {
    const { data: eq } = await supabase.from("equipes").select("nom").eq("id", equipeDuPoste).maybeSingle();
    equipeDuPosteNom = eq?.nom ?? null;
  }

  // 1) Paires (désignations) du POSTE choisi — brouillons + validées, NON annulées
  const { data: pairsRaw } = await supabase
    .from("designations")
    .select(`
      id, validee_at, whatsapp_statut,
      chauffeur:chauffeurs ( id, nom, prenoms ),
      materiel:materiel_roulant ( id, immatriculation, chrono, etat ),
      equipe:equipes ( code, couleur )
    `)
    .eq("date_designation", date)
    .eq("poste", poste)
    .is("annulee_at", null)
    .order("created_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pairsArr = (pairsRaw ?? []) as any[];
  const pairedChauffeurIds = new Set(pairsArr.map((p) => p.chauffeur?.id).filter(Boolean));
  const pairedTruckIds = new Set(pairsArr.map((p) => p.materiel?.id).filter(Boolean));

  const pairs: BoardPair[] = pairsArr.map((p) => ({
    id: p.id,
    driverName: `${p.chauffeur?.nom ?? "?"} ${p.chauffeur?.prenoms ?? ""}`.trim(),
    truckLabel: p.materiel ? truckLabel(p.materiel) : "—",
    equipeCode: p.equipe?.code ?? null,
    equipeCouleur: p.equipe?.couleur ?? null,
    validated: !!p.validee_at,
    enPanne: p.materiel?.etat === "EN_PANNE",
    whatsappStatut: p.whatsapp_statut,
  }));

  // 2) Listes disponibles (uniquement si la journée est éditable)
  let trucks: BoardOption[] = [];
  let drivers: BoardOption[] = [];

  if (!locked && !horsDelai) {
    let qDrivers = supabase
      .from("chauffeurs")
      .select("id, nom, prenoms, equipe_id_defaut, equipe:equipes ( code, couleur )")
      .eq("statut", "ACTIF")
      .order("nom", { ascending: true });
    // Roulement actif → on ne propose QUE les chauffeurs de l'équipe en poste ce jour-là.
    if (roulementActif) qDrivers = qDrivers.eq("equipe_id_defaut", equipeDuPoste ?? "00000000-0000-0000-0000-000000000000");

    const [{ data: trucksRaw }, { data: driversRaw }, { data: absences }] = await Promise.all([
      supabase
        .from("materiel_roulant")
        .select("id, immatriculation, chrono")
        .eq("etat", "EN_SERVICE")
        .eq("type", "TRACTEUR")
        .order("immatriculation", { ascending: true }),
      qDrivers,
      supabase
        .from("absences")
        .select("chauffeur_id, date_debut, date_fin")
        .lte("date_debut", date)
        .gte("date_fin", date),
    ]);

    const absentIds = new Set((absences ?? []).map((a) => a.chauffeur_id));

    trucks = (trucksRaw ?? [])
      .filter((m) => !pairedTruckIds.has(m.id))
      .map((m) => ({ id: m.id, label: truckLabel(m) }));

    drivers = (driversRaw ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => !pairedChauffeurIds.has(c.id) && !absentIds.has(c.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        id: c.id,
        label: `${c.nom} ${c.prenoms}`.trim(),
        equipeCode: c.equipe?.code ?? null,
        equipeCouleur: c.equipe?.couleur ?? null,
      }));
  }

  const posteHref = (p: DesignationPoste) => `/designations?date=${date}&poste=${p}`;
  const horaires = ROULEMENT_POSTE_HORAIRES[poste];

  return (
    <div className="space-y-6">
      {/* En-tête + navigation date */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Megaphone className="size-6 text-primary" />
            Désignation du jour
          </h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground capitalize">
            {dateLabel}
            {locked && <Badge variant="secondary" className="gap-1 text-[10px] normal-case"><Lock className="size-3" />Verrouillée</Badge>}
            {horsDelai && <Badge variant="warning" className="gap-1 text-[10px] normal-case"><CalendarClock className="size-3" />Hors délai</Badge>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/designations?date=${addDays(date, -1)}&poste=${poste}`}><ChevronLeft className="size-4" /></Link>
          </Button>
          <form action="/designations" className="flex items-center gap-2">
            <Input type="date" name="date" defaultValue={date} className="h-8 w-44" />
            <input type="hidden" name="poste" value={poste} />
            <Button type="submit" size="sm" variant="outline">OK</Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <Link href={`/designations?date=${today}&poste=${poste}`}><RotateCcw className="mr-1 size-3.5" />Aujourd&apos;hui</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/designations?date=${addDays(date, 1)}&poste=${poste}`}><ChevronRight className="size-4" /></Link>
          </Button>
        </div>
      </div>

      {/* Onglets Jour / Nuit */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border p-0.5">
          <Link
            href={posteHref("JOUR")}
            className={"flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors " + (poste === "JOUR" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50")}
          >
            <Sun className="size-4" />Jour
          </Link>
          <Link
            href={posteHref("NUIT")}
            className={"flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors " + (poste === "NUIT" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50")}
          >
            <Moon className="size-4" />Nuit
          </Link>
        </div>
        <span className="text-xs text-muted-foreground">
          Poste {poste === "JOUR" ? "de jour" : "de nuit"}{horaires ? ` (${horaires})` : ""}
          {roulementActif && (equipeDuPosteNom
            ? ` · équipe en poste : ${equipeDuPosteNom}`
            : " · aucune équipe sur ce poste ce jour-là")}
        </span>
      </div>

      {roulementActif && !equipeDuPoste && !locked && !horsDelai && (
        <Badge variant="secondary" className="text-[11px]">
          D&apos;après le roulement, aucune équipe ne travaille en {poste === "JOUR" ? "jour" : "nuit"} ce jour-là.
        </Badge>
      )}

      <DesignationBoard
        date={date}
        poste={poste}
        locked={locked}
        horsDelai={horsDelai}
        trucks={trucks}
        drivers={drivers}
        pairs={pairs}
      />
    </div>
  );
}
