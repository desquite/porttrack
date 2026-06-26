import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, RefreshCw } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RoulementForm, type EquipeOption } from "./_components/roulement-form";

export default async function RoulementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isManager = profile?.role === "MANAGER" || profile?.role === "SUPER_ADMIN";

  const [{ data: equipesRaw }, { data: config }] = await Promise.all([
    supabase
      .from("equipes")
      .select("id, nom, code, couleur, actif, ordre")
      .eq("actif", true)
      .order("ordre", { ascending: true }),
    supabase
      .from("roulement_config")
      .select("date_reference, equipe_jour_id, equipe_nuit_id, equipe_repos_id")
      .maybeSingle(),
  ]);

  const equipes: EquipeOption[] = (equipesRaw ?? []).map((e) => ({
    id: e.id,
    nom: e.nom,
    code: e.code,
    couleur: e.couleur ?? "#3b82f6",
  }));

  const initial = config
    ? {
        dateReference: config.date_reference,
        equipeJourId: config.equipe_jour_id,
        equipeNuitId: config.equipe_nuit_id,
        equipeReposId: config.equipe_repos_id,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/planning"><ArrowLeft className="mr-1 size-4" />Retour au planning</Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <RefreshCw className="size-6 text-primary" />
          Réglage du roulement
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Le planning des chauffeurs est calculé automatiquement : chaque équipe enchaîne
          <strong> 2 jours de jour, 2 jours de nuit, 2 jours de repos</strong>. Indique une date de
          référence et quelle équipe est sur quel poste ce jour-là ; le reste se déroule tout seul,
          indéfiniment. Tu peux revenir ici à tout moment pour recaler.
        </p>
      </div>

      {!isManager ? (
        <Alert variant="destructive">
          <AlertTitle>Accès réservé</AlertTitle>
          <AlertDescription>Seul un manager peut régler le roulement.</AlertDescription>
        </Alert>
      ) : (
        <RoulementForm equipes={equipes} initial={initial} />
      )}
    </div>
  );
}
