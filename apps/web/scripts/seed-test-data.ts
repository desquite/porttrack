/**
 * Seed de test : crée un tenant fictif réaliste pour développer l'UI
 * sans avoir à attendre les premiers vrais clients.
 *
 * Idempotent : on identifie le tenant par son RCCM (unique) et on
 * skip ce qui existe déjà.
 *
 * Crée :
 *   - 1 tenant "TRANSPORT TEST PORTTRACK"
 *   - 5 chauffeurs (noms ivoiriens, dates de docs variées pour
 *     tester les alertes : certains OK, certains qui expirent bientôt,
 *     certains déjà expirés)
 *   - 4 matériels (2 tracteurs + 2 porte-conteneurs)
 *
 * Le tenant est invisible aux MANAGER existants — il n'apparaît
 * que pour le SUPER_ADMIN tant qu'on n'a pas créé un user MANAGER
 * pour ce tenant. C'est volontaire (l'UI verra les données quand on
 * lira via le compte SUPER_ADMIN nnolen019@gmail.com).
 *
 * Usage :
 *   pnpm --filter @porttrack/web exec tsx scripts/seed-test-data.ts
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

const TENANT_RCCM = "CI-ABJ-TEST-001"; // Identifiant unique pour l'idempotence

// =============================================================================
// Données de seed — réalistes Côte d'Ivoire
// =============================================================================

const TENANT_DATA = {
  nom_entreprise: "TRANSPORT TEST PORTTRACK",
  rccm: TENANT_RCCM,
  email_manager: "manager.test@porttrack.local",
  telephone: "+225 27 21 24 56 78",
  adresse: "Zone industrielle de Vridi, Abidjan",
  plan: "STARTER" as const,
  statut: "TRIAL" as const,
};

// 30 jours en millisecondes, utile pour générer des dates relatives
const DAYS = 24 * 60 * 60 * 1000;
const today = new Date();
const dateIn = (days: number) =>
  new Date(today.getTime() + days * DAYS).toISOString().slice(0, 10);

const CHAUFFEURS = [
  {
    prenoms: "Kouassi Bernard",
    nom: "Adou",
    date_naissance: "1978-05-12",
    sexe: "M" as const,
    numero_cni: "CI001234567",
    telephone: "+225 07 11 22 33 44",
    email: "kouassi.adou@example.ci",
    adresse: "Cocody, Abidjan",
    numero_permis: "ABJ-2015-001234",
    categories_permis: ["C", "CE"],
    permis_obtention: "2015-03-10",
    permis_expiration: dateIn(180), // OK pendant 6 mois
    visite_medicale_expiration: dateIn(45), // OK
    numero_cnps: "CNPS-789456123",
    date_embauche: "2019-01-15",
    statut: "ACTIF" as const,
  },
  {
    prenoms: "Ahmadou",
    nom: "Coulibaly",
    date_naissance: "1985-11-03",
    sexe: "M" as const,
    numero_cni: "CI002345678",
    telephone: "+225 05 22 33 44 55",
    email: null,
    adresse: "Yopougon, Abidjan",
    numero_permis: "ABJ-2018-002345",
    categories_permis: ["C", "CE", "D"],
    permis_obtention: "2018-07-22",
    permis_expiration: dateIn(15), // ⚠️ Expire bientôt — alimente l'alerte
    visite_medicale_expiration: dateIn(120), // OK
    numero_cnps: "CNPS-890567234",
    date_embauche: "2020-06-01",
    statut: "ACTIF" as const,
  },
  {
    prenoms: "Mariam",
    nom: "Touré",
    date_naissance: "1990-02-28",
    sexe: "F" as const,
    numero_cni: "CI003456789",
    telephone: "+225 01 33 44 55 66",
    email: "mariam.toure@example.ci",
    adresse: "Marcory, Abidjan",
    numero_permis: "ABJ-2021-003456",
    categories_permis: ["C"],
    permis_obtention: "2021-09-15",
    permis_expiration: dateIn(365), // OK
    visite_medicale_expiration: dateIn(-10), // ❌ EXPIRÉ — alerte rouge
    numero_cnps: "CNPS-901678345",
    date_embauche: "2022-03-10",
    statut: "ACTIF" as const,
  },
  {
    prenoms: "Issouf",
    nom: "Bamba",
    date_naissance: "1982-08-17",
    sexe: "M" as const,
    numero_cni: "CI004567890",
    telephone: "+225 07 44 55 66 77",
    email: null,
    adresse: "Treichville, Abidjan",
    numero_permis: "ABJ-2017-004567",
    categories_permis: ["C", "CE"],
    permis_obtention: "2017-11-05",
    permis_expiration: dateIn(90),
    visite_medicale_expiration: dateIn(200),
    numero_cnps: "CNPS-012789456",
    date_embauche: "2018-09-20",
    statut: "EN_CONGE" as const, // Pas dans les listes ACTIVES
  },
  {
    prenoms: "Ibrahim",
    nom: "Ouattara",
    date_naissance: "1995-04-09",
    sexe: "M" as const,
    numero_cni: "CI005678901",
    telephone: "+225 05 55 66 77 88",
    email: "ibrahim.ouattara@example.ci",
    adresse: "Abobo, Abidjan",
    numero_permis: "ABJ-2022-005678",
    categories_permis: ["C"],
    permis_obtention: "2022-04-18",
    permis_expiration: dateIn(450),
    visite_medicale_expiration: dateIn(25), // ⚠️ Expire dans 25j
    numero_cnps: "CNPS-123890567",
    date_embauche: "2023-02-01",
    statut: "ACTIF" as const,
  },
];

const MATERIEL = [
  {
    type: "TRACTEUR" as const,
    immatriculation: "2654 BD 01",
    marque: "Renault Trucks",
    modele: "T 380",
    annee: 2019,
    capacite_tonnes: 19.0,
    kilometrage_actuel: 287_450,
    assurance_fin: dateIn(120), // OK
    visite_technique_fin: dateIn(45), // OK
    vignette_fin: dateIn(20), // ⚠️ Bientôt
    patente_fin: dateIn(300),
    autorisation_dgttc_fin: dateIn(180),
    etat: "EN_SERVICE" as const,
    date_acquisition: "2019-08-15",
    prix_acquisition_fcfa: 45_000_000,
  },
  {
    type: "TRACTEUR" as const,
    immatriculation: "1907 AE 01",
    marque: "DAF",
    modele: "XF 480",
    annee: 2021,
    capacite_tonnes: 19.0,
    kilometrage_actuel: 156_890,
    assurance_fin: dateIn(-5), // ❌ EXPIRÉE — alerte rouge
    visite_technique_fin: dateIn(90),
    vignette_fin: dateIn(45),
    patente_fin: dateIn(200),
    autorisation_dgttc_fin: dateIn(150),
    etat: "EN_SERVICE" as const,
    date_acquisition: "2021-11-02",
    prix_acquisition_fcfa: 58_500_000,
  },
  {
    type: "PORTE_CONTENEUR_40" as const,
    immatriculation: "3421 CF 01",
    marque: "Schmitz Cargobull",
    modele: "SCF 40",
    annee: 2020,
    capacite_tonnes: 32.0,
    kilometrage_actuel: 198_320,
    assurance_fin: dateIn(60),
    visite_technique_fin: dateIn(15), // ⚠️ Bientôt
    vignette_fin: dateIn(180),
    patente_fin: dateIn(220),
    autorisation_dgttc_fin: dateIn(90),
    etat: "EN_SERVICE" as const,
    date_acquisition: "2020-04-22",
    prix_acquisition_fcfa: 22_000_000,
  },
  {
    type: "PORTE_CONTENEUR_MIXTE" as const,
    immatriculation: "5872 BG 01",
    marque: "Krone",
    modele: "Box Liner",
    annee: 2018,
    capacite_tonnes: 30.5,
    kilometrage_actuel: 412_580,
    assurance_fin: dateIn(200),
    visite_technique_fin: dateIn(80),
    vignette_fin: dateIn(110),
    patente_fin: dateIn(50),
    autorisation_dgttc_fin: dateIn(140),
    etat: "EN_REPARATION" as const, // Pas dans les alertes EN_SERVICE
    date_acquisition: "2018-06-10",
    prix_acquisition_fcfa: 18_000_000,
  },
];

// =============================================================================
// Main
// =============================================================================

async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !serviceKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("\n🌱 Seed de test PORTTRACK\n");

  // ---------------------------------------------------------------------------
  // 1. Tenant
  // ---------------------------------------------------------------------------
  const { data: existingTenant } = await admin
    .from("tenants")
    .select("id, nom_entreprise")
    .eq("rccm", TENANT_RCCM)
    .maybeSingle();

  let tenantId: string;
  if (existingTenant) {
    tenantId = existingTenant.id;
    console.log(`✓ Tenant déjà existant : ${existingTenant.nom_entreprise} (${tenantId})`);
  } else {
    const { data: newTenant, error } = await admin
      .from("tenants")
      .insert(TENANT_DATA)
      .select("id, nom_entreprise")
      .single();
    if (error || !newTenant) throw new Error(`Échec création tenant : ${error?.message}`);
    tenantId = newTenant.id;
    console.log(`+ Tenant créé : ${newTenant.nom_entreprise} (${tenantId})`);
  }

  // ---------------------------------------------------------------------------
  // 2. Chauffeurs (idempotence par numero_cni dans ce tenant)
  // ---------------------------------------------------------------------------
  console.log("\n--- Chauffeurs ---");
  let chauffeursCreated = 0;
  let chauffeursSkipped = 0;
  for (const c of CHAUFFEURS) {
    const { data: existing } = await admin
      .from("chauffeurs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("numero_cni", c.numero_cni!)
      .maybeSingle();

    if (existing) {
      chauffeursSkipped++;
      console.log(`  · ${c.prenoms} ${c.nom} (déjà présent)`);
      continue;
    }

    const { error } = await admin
      .from("chauffeurs")
      .insert({ ...c, tenant_id: tenantId });
    if (error) throw new Error(`Échec création chauffeur ${c.nom} : ${error.message}`);
    chauffeursCreated++;
    console.log(`  + ${c.prenoms} ${c.nom}`);
  }

  // ---------------------------------------------------------------------------
  // 3. Matériel roulant (idempotence par immatriculation dans ce tenant)
  // ---------------------------------------------------------------------------
  console.log("\n--- Matériel roulant ---");
  let materielCreated = 0;
  let materielSkipped = 0;
  for (const m of MATERIEL) {
    const { data: existing } = await admin
      .from("materiel_roulant")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("immatriculation", m.immatriculation)
      .maybeSingle();

    if (existing) {
      materielSkipped++;
      console.log(`  · ${m.immatriculation} — ${m.marque} ${m.modele} (déjà présent)`);
      continue;
    }

    const { error } = await admin
      .from("materiel_roulant")
      .insert({ ...m, tenant_id: tenantId });
    if (error) throw new Error(`Échec création matériel ${m.immatriculation} : ${error.message}`);
    materielCreated++;
    console.log(`  + ${m.immatriculation} — ${m.marque} ${m.modele}`);
  }

  // ---------------------------------------------------------------------------
  // Récap
  // ---------------------------------------------------------------------------
  console.log("\n=== Récapitulatif ===");
  console.log(`  Tenant      : ${TENANT_DATA.nom_entreprise}`);
  console.log(`  Tenant ID   : ${tenantId}`);
  console.log(`  Chauffeurs  : ${chauffeursCreated} créés, ${chauffeursSkipped} déjà présents`);
  console.log(`  Matériel    : ${materielCreated} créés, ${materielSkipped} déjà présents`);
  console.log("\nDonnées visibles dans Supabase Table Editor → tables chauffeurs / materiel_roulant.\n");
}

main().catch((e) => {
  console.error("\n❌ Erreur de seed :", e.message);
  process.exit(1);
});
