import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TenantCreateForm } from "../_components/tenant-create-form";

export default async function NewTenantPage({
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
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/parametres"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Toutes les entreprises
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle entreprise</h1>
        <p className="text-sm text-muted-foreground">
          Crée un nouveau tenant (entreprise de transport) et invite optionnellement
          son premier manager.
        </p>
      </div>

      {!isSuperAdmin ? (
        <Alert variant="destructive">
          <AlertTitle>Accès refusé</AlertTitle>
          <AlertDescription>
            Seul un SUPER_ADMIN peut créer une entreprise.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations de l'entreprise</CardTitle>
            <CardDescription>
              Les champs marqués d'une <span className="text-rose-600">*</span> sont obligatoires.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TenantCreateForm />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
