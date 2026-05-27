import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { LogOut, Shield, Building2, IdCard, Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signOutAction } from "./actions";

type JwtClaims = {
  sub?: string;
  email?: string;
  tenant_id?: string;
  user_role?: string;
  iat?: number;
  exp?: number;
  [k: string]: unknown;
};

/**
 * Décodage minimal du payload JWT (base64url) — sans vérification de
 * signature, qui est déjà faite par Supabase côté serveur via getUser().
 * On l'utilise UNIQUEMENT pour inspecter les claims custom (preuve que
 * le auth hook a bien injecté tenant_id et user_role).
 */
function decodeJwtPayload(token: string | undefined): JwtClaims | null {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const padded = payload.padEnd(
      payload.length + ((4 - (payload.length % 4)) % 4),
      "=",
    );
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // Récupère la session pour avoir accès au JWT et inspecter les claims
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claims = decodeJwtPayload(session?.access_token);

  // Récupère le profil métier (RLS laisse passer "select own row")
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">
              PORTTRACK — Tableau de bord
            </h1>
          </div>
          <form action={signOutAction}>
            <Button type="submit" variant="outline" size="sm">
              <LogOut className="mr-2 size-4" />
              Déconnexion
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        {/* Bandeau de bienvenue */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight">
            Bienvenue, {profile?.prenoms ?? user.email}
          </h2>
          <p className="text-muted-foreground">
            Session active. Cette page est une démo de la chaîne d'authentification multi-tenant.
          </p>
        </section>

        {/* Identité du user */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="size-4 text-primary" />
              Identité Supabase Auth
            </CardTitle>
            <CardDescription>
              Issu de <code>auth.users</code>, validé par <code>getUser()</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <KV label="user.id" value={user.id} mono />
            <KV label="user.email" value={user.email ?? "—"} />
            <KV
              label="last_sign_in_at"
              value={user.last_sign_in_at ?? "—"}
            />
          </CardContent>
        </Card>

        {/* Profil métier */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <IdCard className="size-4 text-primary" />
              Profil métier
            </CardTitle>
            <CardDescription>
              Issu de <code>public.users</code> via RLS (lecture de sa propre fiche).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {profile ? (
              <>
                <KV label="role" value={profile.role} pill />
                <KV
                  label="tenant_id"
                  value={profile.tenant_id ?? "NULL (non assigné)"}
                  mono
                />
                <KV label="actif" value={String(profile.actif)} />
                <KV label="created_at" value={profile.created_at} />
              </>
            ) : (
              <p className="text-muted-foreground">
                Aucune ligne dans <code>public.users</code> pour ce user — le trigger <code>handle_new_user</code> a-t-il bien fonctionné ?
              </p>
            )}
          </CardContent>
        </Card>

        {/* Claims du JWT — c'est LA preuve que le auth hook marche */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Claims du JWT (custom_access_token_hook)
            </CardTitle>
            <CardDescription>
              Si <code>tenant_id</code> et <code>user_role</code> apparaissent ci-dessous, c'est que le hook fonctionne.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {claims ? (
              <>
                <KV
                  label="tenant_id (claim)"
                  value={claims.tenant_id || "vide"}
                  mono
                  highlight={Boolean(claims.tenant_id)}
                />
                <KV
                  label="user_role (claim)"
                  value={String(claims.user_role ?? "—")}
                  pill
                  highlight={Boolean(claims.user_role)}
                />
                <details className="mt-3 rounded-md border bg-muted/40 p-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                    Payload JWT complet (debug)
                  </summary>
                  <pre className="mt-2 overflow-x-auto text-[11px] leading-snug">
                    {JSON.stringify(claims, null, 2)}
                  </pre>
                </details>
              </>
            ) : (
              <p className="text-muted-foreground">
                Impossible de lire le JWT — la session est peut-être expirée.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function KV({
  label,
  value,
  mono,
  pill,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  pill?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {pill ? (
        <span
          className={
            "inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
            (highlight
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-border bg-muted text-foreground")
          }
        >
          {value}
        </span>
      ) : (
        <span
          className={
            (mono ? "font-mono text-xs " : "") +
            (highlight ? "font-semibold text-primary " : "")
          }
        >
          {value}
        </span>
      )}
    </div>
  );
}
