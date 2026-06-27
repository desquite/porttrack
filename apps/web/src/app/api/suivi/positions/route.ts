import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { POSITION_LIVE_WINDOW_MIN } from "@porttrack/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Dernière position de chaque chauffeur « en ligne » (ping récent) du tenant. */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const sinceIso = new Date(Date.now() - POSITION_LIVE_WINDOW_MIN * 60_000).toISOString();

  const { data, error } = await supabase
    .from("chauffeur_positions")
    .select(`
      chauffeur_id, latitude, longitude, accuracy_m, captured_at,
      chauffeur:chauffeurs ( nom, prenoms ),
      materiel:materiel_roulant ( immatriculation, chrono )
    `)
    .gte("captured_at", sinceIso)
    .order("captured_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Dédoublonne par chauffeur en gardant le point le plus récent (déjà trié desc).
  const seen = new Set<string>();
  const positions = [];
  for (const row of data ?? []) {
    if (seen.has(row.chauffeur_id)) continue;
    seen.add(row.chauffeur_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    const truck = r.materiel ? (r.materiel.chrono ? `${r.materiel.chrono} (${r.materiel.immatriculation})` : r.materiel.immatriculation) : null;
    positions.push({
      chauffeurId: row.chauffeur_id,
      nom: r.chauffeur ? `${r.chauffeur.nom} ${r.chauffeur.prenoms}`.trim() : "Chauffeur",
      truck,
      lat: row.latitude,
      lng: row.longitude,
      accuracy: row.accuracy_m,
      capturedAt: row.captured_at,
    });
  }

  return NextResponse.json({ positions });
}
