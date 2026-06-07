import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Undo2, MapPin, AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { confirmDriverRecuperationAction } from "./actions";

const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };

/**
 * Écran chauffeur : confirmer une récupération (vide rendu à destination).
 */
export default async function DriverRecuperationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const id = sp.id;
  if (!id) redirect(`/${locale}/chauffeur`);

  const supabase = await createClient();
  const { data: recup } = await supabase
    .from("recuperations")
    .select(`id, statut, destination_type, destination_lieu, tracteur_immat,
      conteneur:conteneurs ( numero, client, destination_libre )`)
    .eq("id", id!)
    .maybeSingle();

  // RLS limite déjà au chauffeur ; si introuvable ou déjà confirmée → retour.
  if (!recup || recup.statut !== "PLANIFIEE") redirect(`/${locale}/chauffeur`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (recup as any).conteneur;
  const dest = recup!.destination_lieu || DEST_LABEL[recup!.destination_type ?? ""] || "destination";

  return (
    <div className="space-y-5">
      <Link href="/chauffeur" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />Retour
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Undo2 className="size-6 text-primary" />Récupération
        </h1>
        <p className="text-sm text-muted-foreground">Confirme que tu as récupéré le vide et déposé à destination.</p>
      </div>

      {sp.error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-3 py-2.5 text-sm text-rose-900">
          <AlertTriangle className="size-4" />Impossible de confirmer. Réessaie.
        </div>
      )}

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="text-lg font-semibold">{c?.numero}</div>
          {c?.client && <div className="text-sm text-muted-foreground">{c.client}</div>}
          {c?.destination_libre && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3" />Récupéré à : {c.destination_libre}
            </div>
          )}
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">À déposer à : </span>
            <span className="font-medium">{dest}</span>
          </div>
        </CardContent>
      </Card>

      <form action={confirmDriverRecuperationAction.bind(null, recup!.id)}>
        <Button type="submit" className="h-12 w-full text-base">
          <Undo2 className="mr-2 size-5" />Confirmer la récupération
        </Button>
      </form>
    </div>
  );
}
