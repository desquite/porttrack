import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, CalendarClock, CheckCircle2, XCircle, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EquipeForm } from "../_components/equipe-form";
import { DeleteEquipeButton } from "../_components/delete-equipe-button";

export default async function EquipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: equipe } = await supabase.from("equipes").select("*").eq("id", id).maybeSingle();
  if (!equipe) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("users").select("role").eq("id", user!.id).maybeSingle();
  const isManager = profile?.role === "MANAGER" || profile?.role === "SUPER_ADMIN";

  const { data: chauffeurs, count: chauffeursCount } = await supabase
    .from("chauffeurs")
    .select("id, nom, prenoms", { count: "exact" })
    .eq("equipe_id_defaut", equipe.id)
    .order("nom", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/equipes" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux équipes
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white"
               style={{ backgroundColor: equipe.couleur ?? "#3b82f6" }}>
            {equipe.code}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{equipe.nom}</h1>
        </div>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Équipe créée</AlertTitle></Alert>}
      {sp.updated && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Modifications enregistrées</AlertTitle></Alert>}
      {sp.error && <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>}

      {/* Chauffeurs rattachés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            Chauffeurs rattachés
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {chauffeursCount ?? 0}
            </span>
          </CardTitle>
          <CardDescription>Chauffeurs ayant cette équipe par défaut.</CardDescription>
        </CardHeader>
        <CardContent>
          {chauffeurs && chauffeurs.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {chauffeurs.map((c) => (
                <Button key={c.id} asChild variant="outline" size="sm">
                  <Link href={`/chauffeurs/${c.id}`}>{c.nom} {c.prenoms}</Link>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun chauffeur rattaché.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="size-4 text-primary" />Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <EquipeForm
            mode="update"
            equipeId={equipe.id}
            tenantId={equipe.tenant_id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            defaultValues={equipe as any}
          />
        </CardContent>
      </Card>

      {isManager && (
        <div className="flex justify-end">
          <DeleteEquipeButton equipeId={equipe.id} />
        </div>
      )}
    </div>
  );
}
