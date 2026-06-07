import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";

import { canAccess, parsePermissions, normalizeForSearch, type Role } from "@porttrack/shared";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODE_LABEL: Record<string, string> = {
  REMORQUE_COUPEE: "Remorque coupée",
  CLIENT_DECHARGE: "Client décharge",
  AUTO_CHARGEUR: "Auto-chargeur",
};

/**
 * Export Excel du sous-menu Livraison.
 *   ?onglet=a_livrer → conteneurs à livrer
 *   ?onglet=livres   → conteneurs livrés (+ infos de livraison via EIR)
 * Jeu de colonnes fixe (toutes les infos conteneur) + colonnes opérationnelles
 * pour l'onglet « Livrés ».
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // -------- Garde (operations.livraisons) --------
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { data: me } = await supabase
    .from("users").select("role, permissions").eq("id", user.id).maybeSingle();
  const role = (me?.role ?? "CUSTOM") as Role;
  if (!canAccess(role, parsePermissions(me?.permissions), "operations.livraisons")) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const onglet = request.nextUrl.searchParams.get("onglet") === "livres" ? "livres" : "a_livrer";
  const qRaw = request.nextUrl.searchParams.get("q") ?? "";
  const qNorm = qRaw ? normalizeForSearch(qRaw).replace(/[%_]/g, "").trim() : "";

  const selectCols = `id, numero, client, transitaire, numero_bl, aconier, poids_kg, marchandise,
    mode_livraison, date_do, date_badt, navire_voyage, num_declaration, type_visite, statut,
    date_livraison_reelle, destination_libre,
    types_conteneur ( code_trade ),
    destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu )`;

  let query = supabase.from("conteneurs").select(selectCols);
  if (onglet === "a_livrer") {
    query = query.in("statut", ["EN_ATTENTE", "EN_COURS"]).order("date_badt", { ascending: true, nullsFirst: false });
  } else {
    query = query.eq("statut", "LIVRE").order("date_livraison_reelle", { ascending: false, nullsFirst: false });
  }
  if (qNorm) query = query.ilike("search_text", `%${qNorm}%`);
  const { data: rows } = await query.limit(5000);
  const conteneurs = (rows ?? []) as Array<Record<string, unknown> & {
    id: string; destination_libre: string | null;
    types_conteneur: { code_trade: string } | null;
    destination: { nom_lieu: string } | null;
  }>;

  // EIR pour l'onglet livrés
  const eirByConteneur = new Map<string, Record<string, unknown>>();
  if (onglet === "livres" && conteneurs.length > 0) {
    const { data: eirs } = await supabase
      .from("eir_archives")
      .select("conteneur_id, chauffeur_nom, tracteur_immat, remorque_immat, mode_livraison, lieu_livraison, date_livraison")
      .in("conteneur_id", conteneurs.map((c) => c.id))
      .order("date_livraison", { ascending: false });
    for (const e of eirs ?? []) {
      if (!eirByConteneur.has(e.conteneur_id as string)) eirByConteneur.set(e.conteneur_id as string, e);
    }
  }

  const baseHeader = [
    "N° conteneur", "Type", "Client", "Transitaire", "N° BL", "Aconier",
    "Lieu de livraison", "Poids (kg)", "Marchandise", "Mode (conteneur)",
    "Date DO", "BADT", "Navire/Voyage", "N° déclaration", "Type visite", "Statut",
  ];
  const livreHeader = ["Date livraison", "Chauffeur", "Tracteur", "Remorque", "Mode (EIR)", "Lieu (EIR)"];
  const header = onglet === "livres" ? [...baseHeader, ...livreHeader] : baseHeader;

  const data = conteneurs.map((c) => {
    const base = [
      c.numero, c.types_conteneur?.code_trade ?? "", c.client ?? "", c.transitaire ?? "",
      c.numero_bl ?? "", c.aconier ?? "",
      c.destination_libre || c.destination?.nom_lieu || "",
      c.poids_kg ?? "", c.marchandise ?? "", c.mode_livraison ?? "",
      c.date_do ?? "", c.date_badt ?? "", c.navire_voyage ?? "", c.num_declaration ?? "",
      c.type_visite ?? "", c.statut ?? "",
    ];
    if (onglet !== "livres") return base;
    const e = eirByConteneur.get(c.id);
    return [
      ...base,
      (c.date_livraison_reelle as string) ?? "",
      (e?.chauffeur_nom as string) ?? "",
      (e?.tracteur_immat as string) ?? "",
      (e?.remorque_immat as string) ?? "",
      e?.mode_livraison ? (MODE_LABEL[e.mode_livraison as string] ?? e.mode_livraison) : "",
      (e?.lieu_livraison as string) ?? "",
    ];
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws["!cols"] = header.map((h) => ({ wch: Math.max(12, String(h).length + 2) }));
  XLSX.utils.book_append_sheet(wb, ws, onglet === "livres" ? "Livrés" : "À livrer");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const fileName = `PORTTRACK_Livraisons_${onglet === "livres" ? "Livres" : "A-livrer"}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
