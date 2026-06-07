import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { canAccess, parsePermissions, normalizeForSearch, type Role } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };

/**
 * Export Excel du sous-menu Récupération.
 *   ?onglet=a_recuperer → conteneurs livrés, vide non encore rendu
 *   ?onglet=recuperes   → cycle fermé (récupération confirmée)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { data: me } = await supabase.from("users").select("role, permissions").eq("id", user.id).maybeSingle();
  const role = (me?.role ?? "CUSTOM") as Role;
  if (!canAccess(role, parsePermissions(me?.permissions), "operations.recuperations")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const onglet = request.nextUrl.searchParams.get("onglet") === "recuperes" ? "recuperes" : "a_recuperer";
  const qRaw = request.nextUrl.searchParams.get("q") ?? "";
  const qNorm = qRaw ? normalizeForSearch(qRaw).replace(/[%_]/g, "").trim() : "";

  const { data: recupRows } = await supabase
    .from("recuperations")
    .select("conteneur_id, statut, chauffeur_nom, tracteur_immat, remorque_immat, destination_type, destination_lieu, date_planifiee, date_recuperation")
    .neq("statut", "ANNULEE");
  const recupByConteneur = new Map((recupRows ?? []).map((r) => [r.conteneur_id, r]));
  const confirmedIds = new Set((recupRows ?? []).filter((r) => r.statut === "CONFIRMEE").map((r) => r.conteneur_id));

  const selectCols = `id, numero, client, transitaire, numero_bl, aconier, poids_kg, marchandise,
    date_badt, navire_voyage, date_livraison_reelle, destination_libre,
    types_conteneur ( code_trade ),
    destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu )`;

  let conteneurs: Array<Record<string, unknown> & {
    id: string; destination_libre: string | null;
    types_conteneur: { code_trade: string } | null; destination: { nom_lieu: string } | null;
  }> = [];

  if (onglet === "recuperes") {
    if (confirmedIds.size > 0) {
      let q = supabase.from("conteneurs").select(selectCols).in("id", Array.from(confirmedIds));
      if (qNorm) q = q.ilike("search_text", `%${qNorm}%`);
      const { data } = await q.limit(5000);
      conteneurs = (data ?? []) as typeof conteneurs;
    }
  } else {
    let q = supabase.from("conteneurs").select(selectCols).eq("statut", "LIVRE")
      .order("date_livraison_reelle", { ascending: true, nullsFirst: false });
    if (qNorm) q = q.ilike("search_text", `%${qNorm}%`);
    const { data } = await q.limit(5000);
    conteneurs = ((data ?? []) as typeof conteneurs).filter((c) => !confirmedIds.has(c.id));
  }

  const baseHeader = [
    "N° conteneur", "Type", "Client", "Transitaire", "N° BL", "Aconier", "Poids (kg)",
    "Marchandise", "BADT", "Navire/Voyage", "Lieu de livraison", "Date livraison",
  ];
  const recHeader = onglet === "recuperes"
    ? ["Date récupération", "Chauffeur", "Tracteur", "Remorque", "Destination", "Lieu destination"]
    : ["État récup.", "Chauffeur (planif)", "Tracteur (planif)", "Destination prévue", "Lieu prévu"];
  const header = [...baseHeader, ...recHeader];

  const data = conteneurs.map((c) => {
    const r = recupByConteneur.get(c.id);
    const base = [
      c.numero, c.types_conteneur?.code_trade ?? "", c.client ?? "", c.transitaire ?? "",
      c.numero_bl ?? "", c.aconier ?? "", c.poids_kg ?? "", c.marchandise ?? "",
      c.date_badt ?? "", c.navire_voyage ?? "",
      c.destination_libre || c.destination?.nom_lieu || "", (c.date_livraison_reelle as string) ?? "",
    ];
    if (onglet === "recuperes") {
      return [
        ...base,
        r?.date_recuperation ?? "", r?.chauffeur_nom ?? "", r?.tracteur_immat ?? "",
        r?.remorque_immat ?? "", r?.destination_type ? (DEST_LABEL[r.destination_type] ?? r.destination_type) : "",
        r?.destination_lieu ?? "",
      ];
    }
    return [
      ...base,
      r ? "Planifiée" : "À planifier", r?.chauffeur_nom ?? "", r?.tracteur_immat ?? "",
      r?.destination_type ? (DEST_LABEL[r.destination_type] ?? r.destination_type) : "", r?.destination_lieu ?? "",
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, String(h).length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, onglet === "recuperes" ? "Récupérés" : "À récupérer");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fileName = `PORTTRACK_Recuperations_${onglet === "recuperes" ? "Recuperes" : "A-recuperer"}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
