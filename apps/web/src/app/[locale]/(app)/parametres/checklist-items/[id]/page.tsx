import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, ClipboardCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChecklistItemForm } from "../_components/checklist-item-form";

export default async function EditChecklistItemPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const canEdit = profile?.role === "SUPER_ADMIN" || profile?.role === "MANAGER";

  const { data: item } = await supabase
    .from("checklist_items_config")
    .select("id, code, label, ordre, actif")
    .eq("id", id)
    .maybeSingle();

  if (!item) notFound();

  if (!canEdit) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Accès refusé</AlertTitle>
        <AlertDescription>Seuls les managers peuvent éditer les items.</AlertDescription>
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
          <ClipboardCheck className="size-6 text-primary" />Éditer l&apos;item
        </h1>
        <p className="text-sm text-muted-foreground">Code stable, libellé éditable.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails</CardTitle>
          <CardDescription>Le code (slug) n&apos;est plus modifiable une fois l&apos;item créé.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChecklistItemForm
            mode="update"
            itemId={item.id}
            defaults={{ code: item.code, label: item.label, ordre: item.ordre, actif: item.actif }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
