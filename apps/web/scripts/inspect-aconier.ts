/**
 * INSPECTION (lecture seule) de la colonne conteneurs.aconier.
 *
 * Objectif : mesurer la pollution (valeurs ressemblant à des horodatages),
 * et voir, pour chaque conteneur pollué, quel est l'aconier du flux d'origine
 * (flux.aconier) — qui servira de bonne valeur au nettoyage.
 *
 * Ne modifie RIEN. Usage :
 *   pnpm --filter web exec tsx scripts/inspect-aconier.ts
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Database } from "@porttrack/shared";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

// Une valeur "polluée" = ressemble à une date ISO (commence par AAAA-MM-JJ)
const isTimestampLike = (s: string | null) =>
  !!s && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(s.trim());

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("URL ou SERVICE_ROLE_KEY manquant dans .env.local");

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // On tire tous les conteneurs (id, aconier, flux_id, tenant_id, statut)
  const all: Array<{ id: string; aconier: string | null; flux_id: string | null; tenant_id: string; statut: string }> = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("conteneurs")
      .select("id, aconier, flux_id, tenant_id, statut")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }

  // Flux : id -> aconier
  const { data: fluxRows, error: fErr } = await admin.from("flux").select("id, aconier, tenant_id");
  if (fErr) throw new Error(fErr.message);
  const fluxAconier = new Map((fluxRows ?? []).map((f) => [f.id, f.aconier]));

  // Stats globales
  const total = all.length;
  const polluted = all.filter((c) => isTimestampLike(c.aconier));
  const empty = all.filter((c) => !c.aconier || c.aconier.trim() === "");
  const clean = all.filter((c) => c.aconier && !isTimestampLike(c.aconier) && c.aconier.trim() !== "");

  console.log("\n=== INSPECTION conteneurs.aconier ===");
  console.log(`Total conteneurs        : ${total}`);
  console.log(`  - aconier propre      : ${clean.length}`);
  console.log(`  - aconier = horodatage: ${polluted.length}`);
  console.log(`  - aconier vide/null   : ${empty.length}`);

  // Distinct des valeurs propres (les vrais aconiers)
  const cleanCounts = new Map<string, number>();
  for (const c of clean) cleanCounts.set(c.aconier!.trim(), (cleanCounts.get(c.aconier!.trim()) ?? 0) + 1);
  console.log("\n--- Aconiers PROPRES (valeurs distinctes) ---");
  for (const [v, n] of [...cleanCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(4)}  ${v}`);
  }

  // Pour les pollués : quel flux.aconier ? (source de nettoyage)
  console.log("\n--- Conteneurs POLLUÉS → aconier du flux d'origine ---");
  const fixMap = new Map<string, number>(); // flux.aconier -> count
  let noFlux = 0;
  for (const c of polluted) {
    const fa = c.flux_id ? fluxAconier.get(c.flux_id) ?? null : null;
    if (!fa) { noFlux++; continue; }
    fixMap.set(fa, (fixMap.get(fa) ?? 0) + 1);
  }
  for (const [v, n] of [...fixMap.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(4)}  flux.aconier = "${v}"`);
  }
  if (noFlux > 0) console.log(`  ${noFlux.toString().padStart(4)}  (aucun flux rattaché → à traiter à part)`);

  // Échantillon de valeurs polluées
  console.log("\n--- Échantillon de valeurs polluées (10 premières) ---");
  for (const c of polluted.slice(0, 10)) {
    const fa = c.flux_id ? fluxAconier.get(c.flux_id) ?? "—" : "—";
    console.log(`  aconier="${c.aconier}"  statut=${c.statut}  flux.aconier="${fa}"`);
  }

  console.log("\n(LECTURE SEULE — aucune donnée modifiée.)\n");
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
