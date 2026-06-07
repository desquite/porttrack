import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Undo2, MapPin, CalendarClock, Truck, Lock, Download, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/utils/dates";
import { normalizeForSearch } from "@porttrack/shared";
import { confirmerRecuperationAction, annulerRecuperationAction } from "./actions";
import { RecuperationsSearch } from "./_components/recuperations-search";

type Onglet = "a_recuperer" | "recuperes";
const LIST_LIMIT = 300;

const MODE_LABEL: Record<string, string> = {
  REMORQUE_COUPEE: "Remorque coupée",
  CLIENT_DECHARGE: "Client décharge",
  AUTO_CHARGEUR: "Auto-chargeur",
};
const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/**
 * Sous-menu « Récupération » (cycle import, 2e temps).
 * À récupérer : conteneurs livrés dont le vide n'est pas encore rendu (à planifier
 * ou planifié). Récupérés : cycle fermé (verrouillé).
 */
export default async function RecuperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onglet?: string; q?: string; planifie?: string; confirme?: string; annule?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const onglet: Onglet = sp.onglet === "recuperes" ? "recuperes" : "a_recuperer";
  const qNorm = sp.q ? normalizeForSearch(sp.q).replace(/[%_]/g, "").trim() : "";
  const qParam = sp.q?.trim() ? `&q=${encodeURIComponent(sp.q.trim())}` : "";

  const supabase = await createClient();

  // Récupérations actives (non annulées) → map par conteneur
  const { data: recupRows } = await supabase
    .from("recuperations")
    .select("id, conteneur_id, statut, chauffeur_nom, tracteur_immat, remorque_immat, destination_type, destination_lieu, date_planifiee, date_recuperation")
    .neq("statut", "ANNULEE");
  const recupByConteneur = new Map((recupRows ?? []).map((r) => [r.conteneur_id, r]));
  const confirmedIds = new Set((recupRows ?? []).filter((r) => r.statut === "CONFIRMEE").map((r) => r.conteneur_id));
  const confirmedArr = Array.from(confirmedIds);

  // Compteurs (tiennent compte de la recherche). Les conteneurs LIVRE incluent
  // les récupérés (le statut conteneur ne change pas) → on soustrait les confirmés.
  let livreCountQ = supabase.from("conteneurs").select("*", { count: "exact", head: true }).eq("statut", "LIVRE");
  if (qNorm) livreCountQ = livreCountQ.ilike("search_text", `%${qNorm}%`);
  const { count: livreMatching } = await livreCountQ;

  let confirmedMatching = 0;
  if (confirmedArr.length > 0) {
    let cq = supabase.from("conteneurs").select("*", { count: "exact", head: true }).in("id", confirmedArr);
    if (qNorm) cq = cq.ilike("search_text", `%${qNorm}%`);
    confirmedMatching = (await cq).count ?? 0;
  }
  const recuperesCount = confirmedMatching;
  const aRecupererCount = Math.max(0, (livreMatching ?? 0) - confirmedMatching);

  // Conteneurs livrés (avec lieu/type), puis on partitionne selon l'onglet
  const selectCols = `id, numero, client, date_livraison_reelle, destination_libre,
    types_conteneur ( code_trade ),
    destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu )`;

  let conteneurs: Array<{
    id: string; numero: string; client: string | null; date_livraison_reelle: string | null;
    destination_libre: string | null; types_conteneur: { code_trade: string } | null;
    destination: { nom_lieu: string } | null;
  }> = [];

  if (onglet === "recuperes") {
    if (confirmedArr.length > 0) {
      let q = supabase.from("conteneurs").select(selectCols).in("id", confirmedArr);
      if (qNorm) q = q.ilike("search_text", `%${qNorm}%`);
      const { data } = await q.limit(LIST_LIMIT);
      conteneurs = (data ?? []) as typeof conteneurs;
    }
  } else {
    let q = supabase.from("conteneurs").select(selectCols)
      .eq("statut", "LIVRE")
      .order("date_livraison_reelle", { ascending: true, nullsFirst: false });
    if (qNorm) q = q.ilike("search_text", `%${qNorm}%`);
    const { data } = await q.limit(LIST_LIMIT);
    conteneurs = ((data ?? []) as typeof conteneurs).filter((c) => !confirmedIds.has(c.id));
  }

  // EIR pour le mode + lieu de livraison
  const eirByConteneur = new Map<string, { mode_livraison: string | null; lieu_livraison: string | null }>();
  if (conteneurs.length > 0) {
    const { data: eirs } = await supabase
      .from("eir_archives").select("conteneur_id, mode_livraison, lieu_livraison, date_livraison")
      .in("conteneur_id", conteneurs.map((c) => c.id))
      .order("date_livraison", { ascending: false });
    for (const e of eirs ?? []) if (!eirByConteneur.has(e.conteneur_id)) eirByConteneur.set(e.conteneur_id, e);
  }

  const lieuOf = (c: typeof conteneurs[number]) => c.destination_libre || c.destination?.nom_lieu || "—";

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Undo2 className="size-6 text-primary" />
            Récupération
          </h1>
          <p className="text-sm text-muted-foreground">
            Récupérer le vide après livraison et le ramener au parc aconier ou au terminal — fermeture du cycle import.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/recuperations/export?onglet=${onglet}${qParam}`}><Download className="mr-2 size-4" />Exporter en Excel</a>
        </Button>
      </header>

      {sp.planifie && <Flash ok>Récupération planifiée. Le chauffeur peut partir récupérer le vide.</Flash>}
      {sp.confirme && <Flash ok>Récupération confirmée — cycle import fermé.</Flash>}
      {sp.annule && <Flash>Planification annulée. Le conteneur est de nouveau à planifier.</Flash>}
      {sp.error && <Flash error>{sp.error}</Flash>}

      <div className="space-y-3">
        <div className="inline-flex rounded-md border bg-background p-0.5">
          <TabLink href={`/recuperations?onglet=a_recuperer${qParam}`} active={onglet === "a_recuperer"} label="À récupérer" count={aRecupererCount} />
          <TabLink href={`/recuperations?onglet=recuperes${qParam}`} active={onglet === "recuperes"} label="Récupérés" count={recuperesCount} />
        </div>
        <RecuperationsSearch />
      </div>

      {conteneurs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          {onglet === "a_recuperer" ? "Aucun vide à récupérer. 🎉" : "Aucune récupération confirmée pour l'instant."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {conteneurs.map((c) => {
            const recup = recupByConteneur.get(c.id);
            const eir = eirByConteneur.get(c.id);
            const since = daysSince(c.date_livraison_reelle);
            const type = c.types_conteneur?.code_trade;

            if (onglet === "recuperes") {
              return (
                <Card key={c.id} className="bg-muted/20">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-tight">{c.numero}</span>
                        {type && <Badge variant="secondary" className="text-[10px]">{type}</Badge>}
                        <Badge variant="outline" className="text-[10px]"><Lock className="mr-1 size-3" />Cycle terminé</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Récupéré le {formatDateFR(recup?.date_recuperation ?? null)}
                        {recup?.chauffeur_nom ? ` · ${recup.chauffeur_nom}` : ""}
                        {recup?.destination_lieu || recup?.destination_type
                          ? ` → ${recup?.destination_lieu || ""}${recup?.destination_type ? ` (${DEST_LABEL[recup.destination_type] ?? recup.destination_type})` : ""}`
                          : ""}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Onglet « À récupérer »
            const planifiee = recup?.statut === "PLANIFIEE";
            return (
              <Card key={c.id} className={cn(planifiee && "border-primary/30 bg-primary/5")}>
                <CardContent className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold tracking-tight">{c.numero}</span>
                      {type && <Badge variant="secondary" className="text-[10px]">{type}</Badge>}
                      {eir?.mode_livraison && <Badge variant="outline" className="text-[10px]">{MODE_LABEL[eir.mode_livraison] ?? eir.mode_livraison}</Badge>}
                      {planifiee && <Badge variant="info" className="text-[10px]">Récupération planifiée</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {c.client && <span>📦 {c.client}</span>}
                      <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{lieuOf(c)}</span>
                      <span className={cn("inline-flex items-center gap-1", since !== null && since >= 7 && "text-amber-600 font-medium")}>
                        <CalendarClock className="size-3" />Livré le {formatDateFR(c.date_livraison_reelle)}
                        {since !== null && ` · il y a ${since} j`}
                      </span>
                      {planifiee && recup && (
                        <span className="inline-flex items-center gap-1 text-foreground">
                          <Truck className="size-3" />{recup.chauffeur_nom}{recup.tracteur_immat ? ` · ${recup.tracteur_immat}` : ""}
                          {recup.destination_lieu || recup.destination_type ? ` → ${recup.destination_lieu || ""}${recup.destination_type ? ` (${DEST_LABEL[recup.destination_type] ?? recup.destination_type})` : ""}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {planifiee && recup ? (
                      <>
                        <form action={confirmerRecuperationAction.bind(null, recup.id)}>
                          <Button type="submit" size="sm"><CheckCircle2 className="mr-1 size-4" />Confirmer</Button>
                        </form>
                        <form action={annulerRecuperationAction.bind(null, recup.id)}>
                          <Button type="submit" size="sm" variant="ghost">Annuler</Button>
                        </form>
                      </>
                    ) : (
                      <Button asChild size="sm">
                        <Link href={`/recuperations/${c.id}`}>Planifier la récupération</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {conteneurs.length === LIST_LIMIT && (
            <p className="pt-2 text-center text-xs text-muted-foreground">{LIST_LIMIT} premiers affichés. Utilise l&apos;export Excel pour la liste complète.</p>
          )}
        </div>
      )}
    </div>
  );
}

function TabLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link href={href} className={cn("rounded px-3 py-1.5 text-sm transition-colors", active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
      {label} <span className={cn("ml-1 text-xs", active ? "opacity-80" : "opacity-60")}>({count})</span>
    </Link>
  );
}

function Flash({ children, ok, error }: { children: React.ReactNode; ok?: boolean; error?: boolean }) {
  return (
    <Alert className={cn(ok && "border-emerald-300 bg-emerald-50/60 text-emerald-900", error && "border-rose-300 bg-rose-50/60 text-rose-900")}>
      {ok && <CheckCircle2 className="size-4" />}
      <AlertTitle>{ok ? "C'est fait" : error ? "Erreur" : "Info"}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
