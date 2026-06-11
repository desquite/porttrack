import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { type Role } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";
import {
  makePeriod, previousYearPeriod, monthsOfYear, type PeriodKind,
} from "@/lib/bilan/periods";
import {
  aggregateByAconier, aggregateByZone, inRange,
  type ConteneurLivre,
} from "@/lib/bilan/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export Excel du bilan d'activité par aconier (Manager uniquement).
 *
 * 4 feuilles : Synthèse, Récap par aconier, Détail mensuel (matrice mois×aconier),
 * Zones de livraison. Reprend exactement les mêmes données que la page
 * /bilan-aconiers (mêmes filtres : statut LIVRE, date_livraison_reelle).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // -------- Garde Manager / Super Admin --------
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  const { data: me } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const role = (me?.role ?? "CUSTOM") as Role;
  if (role !== "MANAGER" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // -------- Paramètres --------
  const params = request.nextUrl.searchParams;
  const kind: PeriodKind =
    params.get("periode") === "trimestre" || params.get("periode") === "semestre" || params.get("periode") === "annee"
      ? (params.get("periode") as PeriodKind)
      : "mois";
  const now = new Date();
  const year = /^\d{4}$/.test(params.get("annee") ?? "")
    ? parseInt(params.get("annee")!)
    : now.getFullYear();
  const index = /^\d{1,2}$/.test(params.get("index") ?? "")
    ? parseInt(params.get("index")!)
    : 1;
  const aconierFilter = params.get("aconier")?.trim() || null;

  const period = makePeriod(kind, year, index);
  const prevPeriod = previousYearPeriod(period);

  // -------- Fetch (2 années pleines) --------
  const baseSelect = "id, aconier, type_conteneur_id, destination_libre, poids_kg, date_livraison_reelle";

  let qCurr = supabase
    .from("conteneurs")
    .select(baseSelect)
    .eq("statut", "LIVRE")
    .gte("date_livraison_reelle", `${year}-01-01`)
    .lt("date_livraison_reelle", `${year + 1}-01-01`);
  let qPrev = supabase
    .from("conteneurs")
    .select(baseSelect)
    .eq("statut", "LIVRE")
    .gte("date_livraison_reelle", `${year - 1}-01-01`)
    .lt("date_livraison_reelle", `${year}-01-01`);
  if (aconierFilter) {
    // ilike sans joker = égalité insensible à la casse (cohérent avec la page).
    const pattern = aconierFilter.replace(/[%_]/g, "\\$&");
    qCurr = qCurr.ilike("aconier", pattern);
    qPrev = qPrev.ilike("aconier", pattern);
  }

  const [currRes, prevRes, typesRes] = await Promise.all([
    qCurr,
    qPrev,
    supabase.from("types_conteneur").select("id, taille_pieds"),
  ]);

  const currAll = (currRes.data ?? []) as ConteneurLivre[];
  const prevAll = (prevRes.data ?? []) as ConteneurLivre[];
  const types = (typesRes.data ?? []) as Array<{ id: string; taille_pieds: number }>;
  const typeSizeById = new Map(types.map((t) => [t.id, t.taille_pieds] as const));

  const currPeriod = currAll.filter((c) =>
    inRange(c.date_livraison_reelle, period.startISO, period.endExclusiveISO),
  );
  const prevPeriodArr = prevAll.filter((c) =>
    inRange(c.date_livraison_reelle, prevPeriod.startISO, prevPeriod.endExclusiveISO),
  );

  const byAconier = aggregateByAconier(currPeriod, prevPeriodArr, typeSizeById);
  const byZone = aggregateByZone(currPeriod);
  const hasPrev = prevPeriodArr.length > 0;
  const total = currPeriod.length;
  const totalTonnage = currPeriod.reduce((s, c) => s + (c.poids_kg ?? 0) / 1000, 0);

  // -------- Construction du classeur --------
  const wb = XLSX.utils.book_new();

  // Feuille 1 : Synthèse
  const synthese: (string | number)[][] = [
    ["PORTTRACK — Bilan d'activité par aconier"],
    [],
    ["Période analysée", period.label],
    ["Aconier", aconierFilter ?? "Tous"],
    ["Statut compté", "Livré (EIR archivé)"],
    ["Date de référence", "Date de livraison réelle"],
    [],
    ["Conteneurs livrés", total],
    ["Tonnage transporté (t)", round1(totalTonnage)],
    hasPrev
      ? ["Comparaison " + prevPeriod.label, prevPeriodArr.length]
      : ["Comparaison N-1", "Pas d'historique"],
    [],
    ["Généré le", new Date().toLocaleString("fr-FR")],
  ];
  const wsSynthese = XLSX.utils.aoa_to_sheet(synthese);
  wsSynthese["!cols"] = [{ wch: 28 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsSynthese, "Synthèse");

  // Feuille 2 : Récap par aconier
  const recapHeader = [
    "Aconier", "Conteneurs livrés", "Part (%)", "20'", "40'", "Autres tailles",
    "Tonnage (t)",
    ...(hasPrev ? [`${prevPeriod.label} (N-1)`, "Variation (%)"] : []),
  ];
  const recapRows = byAconier.map((r) => [
    r.aconier,
    r.livres,
    round1(r.partPct),
    r.taille20,
    r.taille40,
    r.tailleAutre,
    round1(r.tonnage),
    ...(hasPrev ? [r.prevLivres, r.variationPct == null ? "—" : round1(r.variationPct)] : []),
  ]);
  // Ligne total
  const totalRow = [
    "TOTAL",
    total,
    100,
    byAconier.reduce((s, r) => s + r.taille20, 0),
    byAconier.reduce((s, r) => s + r.taille40, 0),
    byAconier.reduce((s, r) => s + r.tailleAutre, 0),
    round1(totalTonnage),
    ...(hasPrev ? [prevPeriodArr.length, ""] : []),
  ];
  const wsRecap = XLSX.utils.aoa_to_sheet([recapHeader, ...recapRows, [], totalRow]);
  wsRecap["!cols"] = recapHeader.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsRecap, "Récap par aconier");

  // Feuille 3 : Détail mensuel (matrice mois × aconier) pour l'année N
  const aconiersList = byAconier.map((r) => r.aconier);
  const months = monthsOfYear(year);
  const detailHeader = ["Mois", ...aconiersList, "Total mois"];
  const detailRows = months.map((m) => {
    const cells = aconiersList.map((ac) =>
      currAll.filter(
        (c) =>
          ((c.aconier ?? "").trim() || "(non renseigné)") === ac &&
          inRange(c.date_livraison_reelle, m.startISO, m.endExclusiveISO),
      ).length,
    );
    const totalMois = cells.reduce((s, n) => s + n, 0);
    return [m.label, ...cells, totalMois];
  });
  // Ligne total par aconier
  const detailTotal = [
    "Total année",
    ...aconiersList.map((ac) =>
      currAll.filter((c) => ((c.aconier ?? "").trim() || "(non renseigné)") === ac).length,
    ),
    currAll.length,
  ];
  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows, [], detailTotal]);
  wsDetail["!cols"] = detailHeader.map((h) => ({ wch: Math.max(10, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wsDetail, "Détail mensuel");

  // Feuille 4 : Zones de livraison
  const zoneHeader = ["Zone de livraison", "Conteneurs livrés", "Part (%)"];
  const zoneRows = byZone.map((z) => [
    z.zone,
    z.count,
    total > 0 ? round1((z.count / total) * 100) : 0,
  ]);
  const wsZones = XLSX.utils.aoa_to_sheet([zoneHeader, ...zoneRows]);
  wsZones["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsZones, "Zones de livraison");

  // -------- Sérialisation --------
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const safeLabel = period.label.replace(/[^a-zA-Z0-9]+/g, "-");
  const fileName = `PORTTRACK_Bilan_Aconiers_${safeLabel}.xlsx`;

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
