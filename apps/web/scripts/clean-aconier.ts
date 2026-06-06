/**
 * NETTOYAGE de conteneurs.aconier — corrige UNIQUEMENT les valeurs polluées
 * (horodatages ISO) issues d'un mauvais mapping d'import.
 *
 * Stratégie :
 *  - cible = aconier ressemblant à une date ISO (^AAAA-MM-JJ)
 *  - nouvelle valeur = libellé canonique déduit de flux.aconier
 *    (MEDLOG -> "Medlog Transport", pour rejoindre la valeur propre dominante)
 *  - NE TOUCHE PAS : les valeurs propres, la casse, les vides.
 *
 * Sécurité : sauvegarde JSON (id + ancienne valeur) AVANT toute écriture.
 * Réversible via restore (cf. script restore-aconier.ts si besoin).
 *
 * Usage :
 *   pnpm --filter web exec tsx scripts/clean-aconier.ts          (dry-run, n'écrit rien)
 *   pnpm --filter web exec tsx scripts/clean-aconier.ts --apply  (applique réellement)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
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

const isTimestampLike = (s: string | null) =>
  !!s && /^\d{4}-\d{2}-\d{2}([T ]|$)/.test(s.trim());

// Libellé canonique par aconier de flux (rejoint la valeur propre déjà présente).
const FLUX_TO_LABEL: Record<string, string> = {
  MEDLOG: "Medlog Transport",
};
// Repli : title-case d'un nom inconnu (aucun cas actuellement, mais robuste).
function fallbackLabel(fluxAconier: string): string {
  return fluxAconier
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const apply = process.argv.includes("--apply");
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) throw new Error("URL ou SERVICE_ROLE_KEY manquant dans .env.local");

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n=== NETTOYAGE aconier ${apply ? "(APPLY)" : "(DRY-RUN)"} ===\n`);

  // 1. Charger tous les conteneurs
  const all: Array<{ id: string; aconier: string | null; flux_id: string | null }> = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("conteneurs")
      .select("id, aconier, flux_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }

  // 2. Flux : id -> aconier
  const { data: fluxRows, error: fErr } = await admin.from("flux").select("id, aconier");
  if (fErr) throw new Error(fErr.message);
  const fluxAconier = new Map((fluxRows ?? []).map((f) => [f.id, f.aconier]));

  // 3. Déterminer les corrections (uniquement les pollués)
  type Fix = { id: string; old: string; next: string };
  const fixes: Fix[] = [];
  const unresolved: Array<{ id: string; old: string }> = [];

  for (const c of all) {
    if (!isTimestampLike(c.aconier)) continue; // on ne touche que les pollués
    const fa = c.flux_id ? fluxAconier.get(c.flux_id) ?? null : null;
    let next: string | null = null;
    if (fa) next = FLUX_TO_LABEL[fa.toUpperCase()] ?? fallbackLabel(fa);
    if (!next) { unresolved.push({ id: c.id, old: c.aconier! }); continue; }
    fixes.push({ id: c.id, old: c.aconier!, next });
  }

  // Récap par valeur cible
  const byTarget = new Map<string, number>();
  for (const f of fixes) byTarget.set(f.next, (byTarget.get(f.next) ?? 0) + 1);

  console.log(`Conteneurs pollués détectés : ${fixes.length + unresolved.length}`);
  console.log(`  -> corrigeables           : ${fixes.length}`);
  for (const [v, n] of byTarget) console.log(`       ${n.toString().padStart(4)}  → "${v}"`);
  console.log(`  -> non résolus (sans flux): ${unresolved.length}`);

  if (fixes.length === 0) {
    console.log("\nRien à corriger.\n");
    return;
  }

  // 4. Sauvegarde JSON (toujours, même en dry-run, pour traçabilité)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = resolve(process.cwd(), `scripts/backup-aconier-${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ when: stamp, fixes, unresolved }, null, 2), "utf8");
  console.log(`\nSauvegarde : ${backupPath}`);

  if (!apply) {
    console.log("\n(DRY-RUN — aucune écriture. Relancer avec --apply pour appliquer.)\n");
    return;
  }

  // 5. Application : on groupe par valeur cible, update batché par lots d'ids
  let updated = 0;
  for (const [target] of byTarget) {
    const ids = fixes.filter((f) => f.next === target).map((f) => f.id);
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await admin
        .from("conteneurs")
        .update({ aconier: target })
        .in("id", chunk);
      if (error) throw new Error(`Update échoué (${target}) : ${error.message}`);
      updated += chunk.length;
      process.stdout.write(`\r  Mises à jour : ${updated}/${fixes.length}`);
    }
  }
  console.log(`\n\n✅ ${updated} conteneurs corrigés.\n`);
}

main().catch((e) => {
  console.error("\n❌", e.message);
  process.exit(1);
});
