import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Trace d'un chauffeur sur une journée (points ordonnés). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const chauffeurId = searchParams.get("chauffeur");
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!chauffeurId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "paramètres invalides" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const startIso = new Date(date + "T00:00:00").toISOString();
  const endIso = new Date(date + "T23:59:59.999").toISOString();

  const { data, error } = await supabase
    .from("chauffeur_positions")
    .select("latitude, longitude, captured_at")
    .eq("chauffeur_id", chauffeurId)
    .gte("captured_at", startIso)
    .lte("captured_at", endIso)
    .order("captured_at", { ascending: true })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const points = (data ?? []).map((p) => ({ lat: p.latitude, lng: p.longitude, t: p.captured_at }));
  return NextResponse.json({ points });
}
