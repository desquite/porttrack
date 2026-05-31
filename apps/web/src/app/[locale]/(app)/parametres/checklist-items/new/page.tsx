import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChecklistItemForm } from "../_components/checklist-item-form";

export default async function NewChecklistItemPage({
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

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canEdit = isSuperAdmin || profile?.role === "MANAGER";
  const tenantId = profile?.tenant_id ?? null;

  if (!canEdit) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Accès refusé</AlertTitle>
        <AlertDescription>Seuls les managers peuvent ajouter des items.</AlertDescription>
      </Alert>
    );
  }
  if (!tenantId) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Aucune entreprise rattachée</AlertTitle>
        <AlertDescription>Ton compte n&apos;est rattaché à aucune entreprise.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link href="/parametres/checklist-items" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" />Retour à la liste
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ClipboardCheck className="size-6 text-primary" />Nouvel item de check-list
        </h1>
        <p className="text-sm text-muted-foreground">
          Le code est l&apos;identifiant interne stable, le libellé est ce que verra l&apos;utilisateur.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails</CardTitle>
          <CardDescription>Champs <span className="text-rose-600">*</span> obligatoires.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChecklistItemForm mode="create" tenantId={tenantId} />
        </CardContent>
      </Card>
    </div>
  );
}
