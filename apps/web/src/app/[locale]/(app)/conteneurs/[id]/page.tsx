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
import { ConteneurForm } from "../_components/conteneur-form";
import { DeleteConteneurButton } from "../_components/delete-conteneur-button";
import { loadConteneurRefs } from "../_components/load-refs";

export default async function EditConteneurPage({
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

  const { data: conteneur } = await supabase
    .from("conteneurs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!conteneur) notFound();

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user!.id)
    .maybeSingle();

  const isSuperAdmin = profile?.role === "SUPER_ADMIN";
  const canDelete = isSuperAdmin || profile?.role === "MANAGER";

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
        <h1 className="font-mono text-2xl font-bold tracking-tight">
          {conteneur.numero}
        </h1>
        <p className="text-sm text-muted-foreground">
          Édite le suivi du conteneur. Les changements de statut et de dates
          alimentent le tableau de bord.
        </p>
      </div>

      {updated && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Modifications enregistrées</AlertTitle>
          <AlertDescription>
            Le conteneur <strong className="font-mono">{updated}</strong> a été mis à jour.
          </AlertDescription>
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
          <CardTitle className="text-base">Informations conteneur</CardTitle>
          <CardDescription>Le tenant est verrouillé en édition.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConteneurForm
            mode="update"
            conteneurId={conteneur.id}
            isSuperAdmin={isSuperAdmin}
            tenants={[]}
            defaultTenantId={conteneur.tenant_id}
            defaultValues={conteneur}
            shippingLines={refs.shippingLines}
            typesConteneur={refs.typesConteneur}
            ports={refs.ports}
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
              La suppression est définitive et retire ce conteneur du suivi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteConteneurButton conteneurId={conteneur.id} numero={conteneur.numero} />
          </CardContent>
        </Card>
      )}

      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/conteneurs">
            <ArrowLeft className="mr-2 size-4" />
            Revenir à la liste
          </Link>
        </Button>
      </div>
    </div>
  );
}
