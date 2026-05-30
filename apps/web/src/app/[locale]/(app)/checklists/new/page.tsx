import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ClipboardCheck, User, Truck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChecklistForm } from "../_components/checklist-form";

export default async function NewChecklistPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ designation?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  if (!sp.designation) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Désignation manquante</AlertTitle>
          <AlertDescription>
            Une check-list de départ doit être rattachée à une désignation existante.
            <Link href="/designations" className="ml-1 underline">Voir les désignations.</Link>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  // On charge la désignation cible + on vérifie qu'aucune check-list n'existe déjà.
  const { data: d } = await supabase
    .from("designations")
    .select(`
      id, tenant_id, chauffeur_id, materiel_roulant_id, date_designation,
      chauffeur:chauffeurs ( id, nom, prenoms ),
      materiel:materiel_roulant ( id, immatriculation, chrono, marque ),
      equipe:equipes ( nom, code, couleur )
    `)
    .eq("id", sp.designation)
    .maybeSingle();

  if (!d) notFound();

  const { data: existing } = await supabase
    .from("checklists_depart")
    .select("id")
    .eq("designation_id", d.id)
    .maybeSingle();
  if (existing) {
    redirect(`/checklists/${existing.id}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (d as any).chauffeur as { id: string; nom: string; prenoms: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mr = (d as any).materiel as { id: string; immatriculation: string; chrono: string | null; marque: string | null } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eq = (d as any).equipe as { nom: string; code: string; couleur: string | null } | null;

  const mrLabel = mr ? (mr.chrono ? `${mr.chrono} (${mr.immatriculation})` : mr.immatriculation) : "—";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href={`/checklists?date=${d.date_designation}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour aux check-lists
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ClipboardCheck className="size-6 text-primary" />Saisir la check-list de départ
        </h1>
        <p className="text-sm text-muted-foreground">
          Note l&apos;état de chaque item avant le départ. Une remarque ou une anomalie classera la check-list en « Remarque ».
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Désignation concernée</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" />
            <span className="font-medium">{ch?.nom} {ch?.prenoms}</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-muted-foreground" />
            <span className="font-medium">{mrLabel}</span>
          </div>
          {eq && (
            <div className="flex items-center gap-2">
              <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: eq.couleur ?? "#3b82f6" }}>
                {eq.code}
              </span>
              <span className="text-muted-foreground">{eq.nom}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">État des 6 items</CardTitle>
          <CardDescription>Coche <strong>Anomalie</strong> uniquement si un défaut est constaté.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChecklistForm
            mode="create"
            tenantId={d.tenant_id}
            designationId={d.id}
            chauffeurId={d.chauffeur_id}
            materielId={d.materiel_roulant_id}
            dateDepart={d.date_designation}
          />
        </CardContent>
      </Card>
    </div>
  );
}
