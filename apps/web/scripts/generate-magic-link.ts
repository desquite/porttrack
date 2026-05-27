/**
 * Génère un magic link / OTP pour un user, SANS envoyer d'email.
 * Permet de contourner la rate limit SMTP de Supabase pendant les tests.
 *
 * Usage :
 *   pnpm --filter @porttrack/web exec tsx scripts/generate-magic-link.ts <email>
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
}

async function main() {
  loadEnv();

  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/generate-magic-link.ts <email>");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:3000/api/auth/callback" },
  });

  if (error) {
    console.error("Erreur:", error.message);
    process.exit(1);
  }

  console.log("\n=== Magic link généré (aucun email envoyé) ===\n");
  console.log("Clique sur ce lien dans ton navigateur :\n");
  console.log(data.properties?.action_link);
  console.log("\nOU utilise ce code 6-chiffres (OTP) dans le formulaire :\n");
  console.log("Code :", data.properties?.email_otp);
  console.log("\nLe code expire dans ~1h.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
