import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { PackageCheck, MapPin, CalendarClock, Truck, ChevronRight, Download } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateFR, classifyExpiry } from "@/lib/utils/dates";

type Onglet = "a_livrer" | "livres";
const LIST_LIMIT = 200;

const MODE_LABEL: Record<string, string> = {
  REMORQUE_COUPEE: "Remorque coupée",
  CLIENT_DECHARGE: "Client décharge",
  AUTO_CHARGEUR: "Auto-chargeur",
};

/**
 * Sous-menu « Livraison » (cycle import, 1er temps).
 * Onglet « À livrer » : conteneurs pas encore livrés (à planifier).
 * Onglet « Livrés »   : conteneurs livrés (avec infos de livraison via EIR).
 */
export default async function LivraisonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const onglet: Onglet = sp.onglet === "livres" ? "livres" : "a_livrer";
  const supabase = await createClient();

  const [{ count: aLivrerCount }, { count: livresCount }] = await Promise.all([
    supabase.from("conteneurs").select("*", { count: "exact", head: true }).in("statut", ["EN_ATTENTE", "EN_COURS"]),
    supabase.from("conteneurs").select("*", { count: "exact", head: true }).eq("statut", "LIVRE"),
  ]);

  const selectCols = `id, numero, client, aconier, date_badt, date_livraison_reelle, destination_libre,
    types_conteneur ( code_trade ),
    destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu )`;

  let query = supabase.from("conteneurs").select(selectCols);
  if (onglet === "a_livrer") {
    query = query.in("statut", ["EN_ATTENTE", "EN_COURS"]).order("date_badt", { ascending: true, nullsFirst: false });
  } else {
    query = query.eq("statut", "LIVRE").order("date_livraison_reelle", { ascending: false, nullsFirst: false });
  }
  const { data: rows } = await query.limit(LIST_LIMIT);
  const conteneurs = rows ?? [];

  // Pour l'onglet « Livrés » : on récupère les infos de livraison depuis l'EIR.
  const eirByConteneur = new Map<string, {
    chauffeur_nom: string | null; tracteur_immat: string | null; remorque_immat: string | null;
    mode_livraison: string | null; lieu_livraison: string | null; date_livraison: string | null;
  }>();
  if (onglet === "livres" && conteneurs.length > 0) {
    const ids = conteneurs.map((c) => c.id);
    const { data: eirs } = await supabase
      .from("eir_archives")
      .select("conteneur_id, chauffeur_nom, tracteur_immat, remorque_immat, mode_livraison, lieu_livraison, date_livraison")
      .in("conteneur_id", ids)
      .order("date_livraison", { ascending: false });
    for (const e of eirs ?? []) {
      if (!eirByConteneur.has(e.conteneur_id)) eirByConteneur.set(e.conteneur_id, e);
    }
  }

  const lieuOf = (c: { destination_libre: string | null; destination: { nom_lieu: string } | null }) =>
    c.destination_libre || c.destination?.nom_lieu || "—";
  const typeOf = (c: { types_conteneur: { code_trade: string } | null }) => c.types_conteneur?.code_trade ?? null;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <PackageCheck className="size-6 text-primary" />
            Livraison
          </h1>
          <p className="text-sm text-muted-foreground">
            Conteneurs à livrer puis livrés — 1er temps du cycle import.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/livraisons/export?onglet=${onglet}`}>
            <Download className="mr-2 size-4" />
            Exporter en Excel
          </a>
        </Button>
      </header>

      {/* Onglets */}
      <div className="inline-flex rounded-md border bg-background p-0.5">
        <TabLink href="/livraisons?onglet=a_livrer" active={onglet === "a_livrer"} label="À livrer" count={aLivrerCount ?? 0} />
        <TabLink href="/livraisons?onglet=livres" active={onglet === "livres"} label="Livrés" count={livresCount ?? 0} />
      </div>

      {/* Liste */}
      {conteneurs.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Aucun conteneur dans cet onglet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {conteneurs.map((c) => {
            const lieu = lieuOf(c);
            const type = typeOf(c);
            const eir = eirByConteneur.get(c.id);
            const badt = onglet === "a_livrer" && c.date_badt ? classifyExpiry(c.date_badt) : null;
            return (
              <Link key={c.id} href={`/conteneurs/${c.id}`} className="block">
                <Card className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tracking-tight">{c.numero}</span>
                        {type && <Badge variant="secondary" className="text-[10px]">{type}</Badge>}
                        {onglet === "livres" && eir?.mode_livraison && (
                          <Badge variant="outline" className="text-[10px]">{MODE_LABEL[eir.mode_livraison] ?? eir.mode_livraison}</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {c.client && <span>📦 {c.client}</span>}
                        <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{lieu}</span>
                        {onglet === "a_livrer" && c.date_badt && (
                          <span className={cn(
                            "inline-flex items-center gap-1",
                            badt === "expired" && "text-rose-600 font-medium",
                            badt === "soon" && "text-amber-600",
                          )}>
                            <CalendarClock className="size-3" />BADT {formatDateFR(c.date_badt)}
                          </span>
                        )}
                        {onglet === "livres" && (
                          <>
                            <span className="inline-flex items-center gap-1 text-emerald-700">✅ Livré le {formatDateFR(c.date_livraison_reelle)}</span>
                            {eir?.chauffeur_nom && <span>👤 {eir.chauffeur_nom}</span>}
                            {eir?.tracteur_immat && <span className="inline-flex items-center gap-1"><Truck className="size-3" />{eir.tracteur_immat}{eir.remorque_immat ? ` + ${eir.remorque_immat}` : ""}</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {onglet === "a_livrer" && <span className="hidden text-xs font-medium text-primary sm:inline">Planifier la livraison</span>}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {conteneurs.length === LIST_LIMIT && (
            <p className="pt-2 text-center text-xs text-muted-foreground">
              {LIST_LIMIT} premiers affichés. Utilise l&apos;export Excel pour la liste complète.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TabLink({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded px-3 py-1.5 text-sm transition-colors",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label} <span className={cn("ml-1 text-xs", active ? "opacity-80" : "opacity-60")}>({count})</span>
    </Link>
  );
}
