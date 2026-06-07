import Link from "next/link";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Undo2, MapPin, AlertTriangle, Truck, Info } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { confirmDriverRecuperationAction } from "./actions";

const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };
const MODE_LABEL: Record<string, string> = {
  REMORQUE_COUPEE: "Remorque coupée",
  CLIENT_DECHARGE: "Client a déchargé",
  AUTO_CHARGEUR: "Auto-chargeur",
};

/**
 * Écran chauffeur : confirmer une récupération (vide rendu à destination).
 *
 * Briefing enrichi pour aider le chauffeur sur place :
 *   - lieu de livraison précis (où aller)
 *   - mode de livraison (ce qu'il va trouver)
 *   - remorque coupée sur place (REMORQUE_COUPEE) → immat
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
    .select(`id, statut, destination_type, destination_lieu, tracteur_immat, conteneur_id,
      conteneur:conteneurs ( numero, client, destination_libre )`)
    .eq("id", id!)
    .maybeSingle();

  // RLS limite déjà au chauffeur ; si introuvable ou déjà confirmée → retour.
  if (!recup || recup.statut !== "PLANIFIEE") redirect(`/${locale}/chauffeur`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (recup as any).conteneur;
  const dest = recup!.destination_lieu || DEST_LABEL[recup!.destination_type ?? ""] || "destination";

  // Contexte de la livraison : mode + lieu figé + remorque coupée le cas échéant
  const { data: eirRow } = await supabase
    .from("eir_archives")
    .select("mode_livraison, lieu_livraison, remorque_immat, date_livraison")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq("conteneur_id", (recup as any).conteneur_id)
    .order("date_livraison", { ascending: false })
    .limit(1)
    .maybeSingle();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eir = eirRow as any;
  const modeLivraison = (eir?.mode_livraison ?? null) as string | null;
  const lieuRecup = eir?.lieu_livraison || c?.destination_libre || null;

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

      {/* Briefing : qu'est-ce qui t'attend ? */}
      {modeLivraison && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <Info className="size-4" />
              Livraison « {MODE_LABEL[modeLivraison] ?? modeLivraison} »
            </div>
            <p className="text-sm text-amber-900">
              {modeLivraison === "REMORQUE_COUPEE" && (
                <>
                  La remorque{eir?.remorque_immat ? <> <strong>{eir.remorque_immat}</strong></> : ""} est sur place avec le conteneur vide.
                  Branche-la et ramène-la.
                </>
              )}
              {modeLivraison === "CLIENT_DECHARGE" && (
                <>Le conteneur vide est par terre ou sur les moyens du client. Charge-le sur ta remorque.</>
              )}
              {modeLivraison === "AUTO_CHARGEUR" && (
                <>Le conteneur vide est par terre chez le client. Reprends-le avec ton auto-chargeuse.</>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Détail conteneur + lieux */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{c?.numero}</span>
            {modeLivraison === "REMORQUE_COUPEE" && eir?.remorque_immat && (
              <Badge variant="outline" className="text-[10px]">
                <Truck className="mr-1 size-3" />Remorque {eir.remorque_immat}
              </Badge>
            )}
          </div>
          {c?.client && <div className="text-sm text-muted-foreground">📦 {c.client}</div>}

          {lieuRecup && (
            <div className="rounded-md border border-rose-200 bg-rose-50/40 px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-rose-900/70">Aller récupérer à</div>
              <div className="mt-0.5 flex items-center gap-1 text-sm font-medium text-rose-900">
                <MapPin className="size-3.5" />{lieuRecup}
              </div>
            </div>
          )}

          <div className="rounded-md bg-muted/50 px-3 py-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">À déposer à</div>
            <div className="mt-0.5 text-sm font-medium">{dest}</div>
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
