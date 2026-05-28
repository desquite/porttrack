import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";

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
import { AffectationForm } from "../_components/affectation-form";
import { DeleteAffectationButton } from "../_components/delete-affectation-button";
import { loadAffectationRefs } from "../_components/load-refs";

export default async function EditAffectationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const { locale, id } = await params;
  const { updated, error } = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: affectation } = await supabase
    .from("affectations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!affectation) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canDelete = isSuperAdmin || profile?.role === "MANAGER";

  // On inclut les entités déjà liées même si elles ne matchent plus les filtres
  const refs = await loadAffectationRefs({
    conteneurId: affectation.conteneur_id,
    chauffeurId: affectation.chauffeur_id,
    tracteurId: affectation.tracteur_id,
    remorqueId: affectation.remorque_id,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link
          href="/affectations"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Retour à la liste
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Modifier l'affectation</h1>
        <p className="text-sm text-muted-foreground">
          Mets à jour le statut, les dates et les ressources affectées.
        </p>
      </div>

      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>L'affectation a été mise à jour.</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Erreur</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails de l'affectation</CardTitle>
          <CardDescription>Le tenant est verrouillé en édition.</CardDescription>
        </CardHeader>
        <CardContent>
          <AffectationForm
            mode="update"
            affectationId={affectation.id}
            isSuperAdmin={isSuperAdmin}
            tenants={[]}
            defaultTenantId={affectation.tenant_id}
            defaultValues={affectation}
            conteneurs={refs.conteneurs}
            chauffeurs={refs.chauffeurs}
            tracteurs={refs.tracteurs}
            remorques={refs.remorques}
          />
        </CardContent>
      </Card>

      {canDelete && (
        <Card className="border-rose-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <ShieldAlert className="size-4" />
              Zone de danger
            </CardTitle>
            <CardDescription>
              La suppression retire définitivement cette affectation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAffectationButton affectationId={affectation.id} />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/affectations">
            <ArrowLeft className="mr-2 size-4" />
            Revenir à la liste
          </Link>
        </Button>
      </div>
    </div>
  );
}
