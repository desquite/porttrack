import { setRequestLocale } from "next-intl/server";
import { Building2, IdCard, Mail } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

export default async function DebugPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const claims = decodeJwtPayload(session?.access_token);

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Debug session</h1>
        <p className="text-sm text-muted-foreground">
          Inspection du user, du profil métier et des claims JWT — outil de
          vérification de la chaîne d'authentification multi-tenant.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
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
            <KV label="user.id" value={user!.id} mono />
            <KV label="user.email" value={user!.email ?? "—"} />
            <KV
              label="last_sign_in_at"
              value={user!.last_sign_in_at ?? "—"}
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
              <code>public.users</code> via RLS (lecture propre fiche).
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
              </>
            ) : (
              <p className="text-muted-foreground">
                Aucune ligne dans <code>public.users</code>.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Claims du JWT */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Claims du JWT
            </CardTitle>
            <CardDescription>
              Injectés par <code>custom_access_token_hook</code>.
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
              </>
            ) : (
              <p className="text-muted-foreground">JWT illisible.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payload JWT complet */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Payload JWT complet (debug)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-md bg-muted/40 p-3 text-[11px] leading-snug">
            {JSON.stringify(claims, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
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
    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
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
            (mono ? "font-mono text-xs break-all " : "") +
            (highlight ? "font-semibold text-primary " : "")
          }
        >
          {value}
        </span>
      )}
    </div>
  );
}
