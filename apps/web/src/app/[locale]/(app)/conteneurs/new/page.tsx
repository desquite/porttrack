import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ConteneurForm } from "../_components/conteneur-form";
import { loadConteneurRefs } from "../_components/load-refs";

export default async function NewConteneurPage({
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

  const { data: profile } = await supabase
    .from("users")
    .select("role, tenant_id")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  let tenants: { id: string; nom_entreprise: string }[] = [];
  const defaultTenantId: string | null = profile?.tenant_id ?? null;
  let blockerMessage: string | null = null;

  if (isSuperAdmin) {
    const { data } = await supabase
      .from("tenants")
      .select("id, nom_entreprise")
      .order("nom_entreprise", { ascending: true });
    tenants = data ?? [];
    if (tenants.length === 0) {
      blockerMessage = "Aucun tenant n'existe encore en base.";
    }
  } else if (!defaultTenantId) {
    blockerMessage =
      "Ton compte n'est rattaché à aucune entreprise. Contacte ton manager.";
  }

  const refs = await loadConteneurRefs();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/conteneurs"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nouveau conteneur</h1>
        <p className="text-sm text-muted-foreground">
          Enregistre un conteneur à suivre. Les champs marqués d'une{" "}
          <span className="text-rose-600">*</span> sont obligatoires.
        </p>
      </div>

      {blockerMessage ? (
        <Alert variant="destructive">
          <AlertTitle>Création impossible</AlertTitle>
          <AlertDescription>{blockerMessage}</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations conteneur</CardTitle>
            <CardDescription>
              Les compagnies, types et ports proviennent des catalogues partagés.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConteneurForm
              mode="create"
              isSuperAdmin={isSuperAdmin}
              tenants={tenants}
              defaultTenantId={defaultTenantId}
              shippingLines={refs.shippingLines}
              typesConteneur={refs.typesConteneur}
              ports={refs.ports}
            />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/conteneurs">
            <ArrowLeft className="mr-2 size-4" />
            Annuler et revenir
          </Link>
        </Button>
      </div>
    </div>
  );
}
