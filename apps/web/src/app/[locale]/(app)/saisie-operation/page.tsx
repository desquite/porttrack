import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ClipboardEdit, MapPin, CalendarClock, Truck, User, ChevronRight, Package, CheckCircle2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { formatDateFR } from "@/lib/utils/dates";
import { normalizeForSearch } from "@porttrack/shared";
import { SaisieSearch } from "./_components/saisie-search";

type Onglet = "livraisons" | "recuperations";
const LIST_LIMIT = 200;

const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };

/**
 * Sous-menu « Saisie opération » — back-office.
 *
 * Pour les chauffeurs qui ne valident pas leurs mouvements dans la PWA :
 * l'opérateur saisit ici le mouvement à partir de l'EIR papier rapporté.
 *
 * Onglet « Livraisons à valider »   : affectations actives sur conteneurs
 *                                      non encore LIVRES.
 * Onglet « Récupérations à valider »: recuperations.statut = PLANIFIEE.
 */
export default async function SaisieOperationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ onglet?: string; q?: string; saisi?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const onglet: Onglet = sp.onglet === "recuperations" ? "recuperations" : "livraisons";
  const qNorm = sp.q ? normalizeForSearch(sp.q).replace(/[%_]/g, "").trim() : "";
  const qParam = sp.q?.trim() ? `&q=${encodeURIComponent(sp.q.trim())}` : "";
  const supabase = await createClient();

  // ===========================================================================
  // Compteurs (tiennent compte de la recherche)
  // ===========================================================================

  // Livraisons à valider = affectations actives (PLANIFIEE ou EN_COURS) dont le
  // conteneur n'est pas LIVRE. On passe par les conteneurs (search_text dessus).
  let livConteneursQ = supabase
    .from("conteneurs")
    .select("id", { count: "exact", head: false })
    .in("statut", ["EN_ATTENTE", "EN_COURS"]);
  if (qNorm) livConteneursQ = livConteneursQ.ilike("search_text", `%${qNorm}%`);
  const { data: livConteneursIds } = await livConteneursQ;
  const livConteneurIdSet = new Set((livConteneursIds ?? []).map((c) => c.id));

  const affectsQ = supabase
    .from("affectations")
    .select("id, conteneur_id, chauffeur_id, tracteur_id, date_affectation, statut")
    .in("statut", ["PLANIFIEE", "EN_COURS"]);
  const { data: affectsRaw } = await affectsQ;
  const affects = (affectsRaw ?? []).filter((a) => livConteneurIdSet.has(a.conteneur_id));

  // On déduplique par conteneur (1 affectation active par conteneur en pratique,
  // mais on sécurise).
  const affectByConteneur = new Map<string, typeof affects[number]>();
  for (const a of affects) if (!affectByConteneur.has(a.conteneur_id)) affectByConteneur.set(a.conteneur_id, a);
  const livraisonsCount = affectByConteneur.size;

  // Récupérations à valider = recuperations.statut = PLANIFIEE
  const { data: recupsPlanifs } = await supabase
    .from("recuperations")
    .select(`id, conteneur_id, chauffeur_nom, tracteur_immat, destination_type, destination_lieu, date_planifiee,
             conteneurs ( id, numero, client, aconier, search_text,
               destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu ),
               destination_libre )`)
    .eq("statut", "PLANIFIEE")
    .order("date_planifiee", { ascending: true, nullsFirst: false });
  const recupsFiltered = (recupsPlanifs ?? []).filter((r) => {
    if (!qNorm) return true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = r.conteneurs as any;
    return c?.search_text?.includes(qNorm);
  });
  const recuperationsCount = recupsFiltered.length;

  // ===========================================================================
  // Données détaillées selon l'onglet courant
  // ===========================================================================

  type LivraisonRow = {
    affectationId: string;
    conteneurId: string;
    numero: string;
    client: string | null;
    aconier: string | null;
    lieu: string;
    chauffeurNom: string | null;
    tracteurImmat: string | null;
    dateAffectation: string | null;
  };
  const livraisonsRows: LivraisonRow[] = [];

  if (onglet === "livraisons" && affectByConteneur.size > 0) {
    const conteneurIds = Array.from(affectByConteneur.keys()).slice(0, LIST_LIMIT);
    const affectationIds = conteneurIds
      .map((cid) => affectByConteneur.get(cid)?.id)
      .filter((x): x is string => !!x);
    const chauffeurIds = conteneurIds
      .map((cid) => affectByConteneur.get(cid)?.chauffeur_id)
      .filter((x): x is string => !!x);
    const tracteurIds = conteneurIds
      .map((cid) => affectByConteneur.get(cid)?.tracteur_id)
      .filter((x): x is string => !!x);

    const [{ data: conts }, { data: chauffeurs }, { data: tracteurs }] = await Promise.all([
      supabase
        .from("conteneurs")
        .select(`id, numero, client, aconier, destination_libre,
                 destination:port_codes!conteneurs_destination_id_fkey ( nom_lieu )`)
        .in("id", conteneurIds),
      chauffeurIds.length > 0
        ? supabase.from("chauffeurs").select("id, prenoms, nom").in("id", chauffeurIds)
        : Promise.resolve({ data: [] }),
      tracteurIds.length > 0
        ? supabase.from("materiel_roulant").select("id, immatriculation").in("id", tracteurIds)
        : Promise.resolve({ data: [] }),
    ]);
    void affectationIds;

    const chauffeurById = new Map((chauffeurs ?? []).map((c) => [c.id, c]));
    const tracteurById = new Map((tracteurs ?? []).map((t) => [t.id, t]));
    const contById = new Map((conts ?? []).map((c) => [c.id, c]));

    for (const cid of conteneurIds) {
      const aff = affectByConteneur.get(cid)!;
      const c = contById.get(cid);
      if (!c) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dest = (c as any).destination as { nom_lieu: string } | null;
      const ch = aff.chauffeur_id ? chauffeurById.get(aff.chauffeur_id) : null;
      const tr = aff.tracteur_id ? tracteurById.get(aff.tracteur_id) : null;
      livraisonsRows.push({
        affectationId: aff.id,
        conteneurId: cid,
        numero: c.numero,
        client: c.client,
        aconier: c.aconier,
        lieu: c.destination_libre || dest?.nom_lieu || "—",
        chauffeurNom: ch ? `${ch.prenoms} ${ch.nom}` : null,
        tracteurImmat: tr?.immatriculation ?? null,
        dateAffectation: aff.date_affectation ?? null,
      });
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <ClipboardEdit className="size-6 text-primary" />
          Saisie opération
        </h1>
        <p className="text-sm text-muted-foreground">
          Saisis depuis l&apos;EIR papier le mouvement effectué par un chauffeur qui n&apos;a pas validé dans la PWA.
        </p>
      </header>

      {sp.saisi && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900">
          <CheckCircle2 className="size-4" />
          <AlertTitle>Mouvement enregistré</AlertTitle>
          <AlertDescription>L&apos;opération a été validée à partir de l&apos;EIR.</AlertDescription>
        </Alert>
      )}

      <div className="space-y-3">
        <div className="inline-flex rounded-md border bg-background p-0.5">
          <TabLink
            href={`/saisie-operation?onglet=livraisons${qParam}`}
            active={onglet === "livraisons"}
            label="Livraisons à valider"
            count={livraisonsCount}
          />
          <TabLink
            href={`/saisie-operation?onglet=recuperations${qParam}`}
            active={onglet === "recuperations"}
            label="Récupérations à valider"
            count={recuperationsCount}
          />
        </div>
        <SaisieSearch />
      </div>

      {onglet === "livraisons" ? (
        livraisonsRows.length === 0 ? (
          <Empty text="Aucune livraison en attente de saisie." />
        ) : (
          <div className="space-y-2">
            {livraisonsRows.map((r) => (
              <Link key={r.affectationId} href={`/saisie-operation/livraison/${r.affectationId}`} className="block">
                <Card className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-semibold tracking-tight">
                          <Package className="size-3.5 text-muted-foreground" />
                          {r.numero}
                        </span>
                        {r.aconier && <Badge variant="secondary" className="text-[10px]">{r.aconier}</Badge>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {r.client && <span>📦 {r.client}</span>}
                        <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{r.lieu}</span>
                        {r.chauffeurNom && (
                          <span className="inline-flex items-center gap-1"><User className="size-3" />{r.chauffeurNom}</span>
                        )}
                        {r.tracteurImmat && (
                          <span className="inline-flex items-center gap-1"><Truck className="size-3" />{r.tracteurImmat}</span>
                        )}
                        {r.dateAffectation && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3" />Affecté le {formatDateFR(r.dateAffectation)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-xs font-medium text-primary sm:inline">Saisir la livraison</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
            {livraisonsRows.length === LIST_LIMIT && (
              <p className="pt-2 text-center text-xs text-muted-foreground">
                {LIST_LIMIT} premiers affichés.
              </p>
            )}
          </div>
        )
      ) : recupsFiltered.length === 0 ? (
        <Empty text="Aucune récupération en attente de saisie." />
      ) : (
        <div className="space-y-2">
          {recupsFiltered.slice(0, LIST_LIMIT).map((r) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const c = r.conteneurs as any;
            const lieu = c?.destination_libre || c?.destination?.nom_lieu || "—";
            const destTxt = r.destination_lieu || (r.destination_type ? DEST_LABEL[r.destination_type] : "");
            return (
              <Link key={r.id} href={`/saisie-operation/recuperation/${r.id}`} className="block">
                <Card className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardContent className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-semibold tracking-tight">
                          <Package className="size-3.5 text-muted-foreground" />
                          {c?.numero ?? "—"}
                        </span>
                        {c?.aconier && <Badge variant="secondary" className="text-[10px]">{c.aconier}</Badge>}
                        <Badge variant="info" className="text-[10px]">Récupération planifiée</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {c?.client && <span>📦 {c.client}</span>}
                        <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{lieu}</span>
                        {r.chauffeur_nom && (
                          <span className="inline-flex items-center gap-1"><User className="size-3" />{r.chauffeur_nom}</span>
                        )}
                        {r.tracteur_immat && (
                          <span className="inline-flex items-center gap-1"><Truck className="size-3" />{r.tracteur_immat}</span>
                        )}
                        {destTxt && <span>→ {destTxt}</span>}
                        {r.date_planifiee && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3" />Prévue le {formatDateFR(r.date_planifiee)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="hidden text-xs font-medium text-primary sm:inline">Saisir la récupération</span>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {recupsFiltered.length > LIST_LIMIT && (
            <p className="pt-2 text-center text-xs text-muted-foreground">
              {LIST_LIMIT} premiers affichés.
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

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
