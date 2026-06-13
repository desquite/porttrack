import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { History, ArrowRight, FileText, Lock, XCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { downloadJustificatifAction } from "./actions";

const TABLE_LABELS: Record<string, string> = {
  conteneurs: "Conteneur",
  affectations: "Affectation",
};

const TABLE_ROUTE: Record<string, string> = {
  conteneurs: "/conteneurs",
  affectations: "/affectations",
};

export default async function HistoriquePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ table?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  let query = supabase
    .from("modifications_historique")
    .select("id, table_cible, enregistrement_id, champ_label, valeur_avant, valeur_apres, motif, user_nom, user_email, created_at, justificatif_nom")
    .order("created_at", { ascending: false })
    .limit(200);
  if (sp.table && TABLE_LABELS[sp.table]) query = query.eq("table_cible", sp.table);

  const { data: rows } = await query;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <History className="size-6 text-primary" />
          Traçabilité
        </h1>
        <p className="text-sm text-muted-foreground">
          Journal des modifications de données sensibles.
        </p>
      </div>

      <Alert className="border-slate-300 bg-slate-50/60">
        <Lock className="size-4" />
        <AlertTitle>Historique immuable</AlertTitle>
        <AlertDescription>
          Ces entrées sont en lecture seule pour tous les rôles, sans exception — aucune ne peut être modifiée ou supprimée, pas même par un administrateur.
        </AlertDescription>
      </Alert>

      {sp.error && (
        <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>
      )}

      {/* Filtres par table */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={!sp.table} href="/historique" label="Tout" />
        {Object.entries(TABLE_LABELS).map(([key, label]) => (
          <FilterChip key={key} active={sp.table === key} href={`/historique?table=${key}`} label={label} />
        ))}
      </div>

      {!rows || rows.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <History className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucune modification tracée</CardTitle>
            <CardDescription>
              Les modifications de champs sensibles (lieu de livraison, BADT, etc.) apparaîtront ici.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {rows.map((r) => {
                const route = TABLE_ROUTE[r.table_cible];
                return (
                  <li key={r.id} className="flex flex-wrap items-start gap-3 p-4 text-sm">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {TABLE_LABELS[r.table_cible] ?? r.table_cible}
                        </span>
                        <span className="font-medium">{r.champ_label}</span>
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground line-through">{r.valeur_avant ?? "(vide)"}</span>
                          <ArrowRight className="size-3 text-muted-foreground" />
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-800">{r.valeur_apres ?? "(vide)"}</span>
                        </span>
                      </div>
                      <p className="text-xs italic text-muted-foreground">« {r.motif} »</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          {r.user_nom ? (
                            <>
                              <span className="font-medium text-foreground/80">{r.user_nom}</span>
                              {r.user_email && <span> · {r.user_email}</span>}
                            </>
                          ) : (
                            r.user_email ?? "utilisateur inconnu"
                          )}
                        </span>
                        <span>{new Date(r.created_at).toLocaleString("fr-FR")}</span>
                        <form action={downloadJustificatifAction.bind(null, r.id)}>
                          <Button type="submit" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]">
                            <FileText className="size-3" />{r.justificatif_nom ?? "justificatif"}
                          </Button>
                        </form>
                      </div>
                    </div>
                    {route && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`${route}/${r.enregistrement_id}`}>Voir la fiche</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FilterChip({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Button asChild variant={active ? "default" : "outline"} size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}
