import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Truck, MapPin, FileArchive, CheckCircle2, PackageCheck, Undo2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { loadDriverContext } from "../_components/load-driver";

const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };
type Filtre = "tout" | "livraisons" | "recuperations";
const ROW_LIMIT = 100;

type Mouvement =
  | {
      type: "livraison";
      id: string;
      date: string | null;
      numero: string | null;
      client: string | null;
      lieu: string | null;
    }
  | {
      type: "recuperation";
      id: string;
      date: string | null;
      numero: string | null;
      client: string | null;
      lieu: string | null;
      destination: string | null;
    };

/**
 * Historique unifié des mouvements (livraisons + récupérations) du chauffeur.
 * Filtre par type via le query param ?filtre=tout|livraisons|recuperations.
 * Tri par date décroissante, limité aux ROW_LIMIT plus récents.
 */
export default async function DriverMouvementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filtre?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const { chauffeur } = await loadDriverContext();
  if (!chauffeur) return null;

  const filtre: Filtre =
    sp.filtre === "livraisons" || sp.filtre === "recuperations" ? sp.filtre : "tout";

  const supabase = await createClient();

  // Livraisons confirmées = ses EIR archivés (RLS limite déjà à lui)
  const livraisonsPromise =
    filtre === "recuperations"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("eir_archives")
          .select(`id, date_livraison,
                   conteneur:conteneurs ( numero, client, destination_libre )`)
          .order("date_livraison", { ascending: false })
          .limit(ROW_LIMIT);

  const recupsPromise =
    filtre === "livraisons"
      ? Promise.resolve({ data: [] })
      : supabase
          .from("recuperations")
          .select(`id, date_recuperation, destination_type, destination_lieu,
                   conteneur:conteneurs ( numero, client, destination_libre )`)
          .eq("chauffeur_id", chauffeur.id)
          .eq("statut", "CONFIRMEE")
          .order("date_recuperation", { ascending: false, nullsFirst: false })
          .limit(ROW_LIMIT);

  const [{ data: eirs }, { data: recups }] = await Promise.all([livraisonsPromise, recupsPromise]);

  const mouvements: Mouvement[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (eirs ?? []) as any[]) {
    mouvements.push({
      type: "livraison",
      id: e.id,
      date: e.date_livraison ?? null,
      numero: e.conteneur?.numero ?? null,
      client: e.conteneur?.client ?? null,
      lieu: e.conteneur?.destination_libre ?? null,
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (recups ?? []) as any[]) {
    mouvements.push({
      type: "recuperation",
      id: r.id,
      date: r.date_recuperation ?? null,
      numero: r.conteneur?.numero ?? null,
      client: r.conteneur?.client ?? null,
      lieu: r.conteneur?.destination_libre ?? null,
      destination: r.destination_lieu || DEST_LABEL[r.destination_type ?? ""] || null,
    });
  }

  // Tri par date desc (lignes sans date en dernier)
  mouvements.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });
  const rows = mouvements.slice(0, ROW_LIMIT);

  const totalLiv = (eirs ?? []).length;
  const totalRec = (recups ?? []).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Truck className="size-5 text-primary" />Mes mouvements
        </h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} opération{rows.length > 1 ? "s" : ""} enregistrée{rows.length > 1 ? "s" : ""}
        </p>
      </div>

      {/* Filtres */}
      <div className="inline-flex rounded-md border bg-background p-0.5">
        <TabLink href="/chauffeur/mouvements" active={filtre === "tout"} label="Tout" count={totalLiv + totalRec} />
        <TabLink href="/chauffeur/mouvements?filtre=livraisons" active={filtre === "livraisons"} label="Livraisons" count={totalLiv} />
        <TabLink href="/chauffeur/mouvements?filtre=recuperations" active={filtre === "recuperations"} label="Récup." count={totalRec} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border bg-background px-3 py-4 text-sm text-muted-foreground">
          {filtre === "livraisons"
            ? "Aucune livraison enregistrée pour l'instant."
            : filtre === "recuperations"
              ? "Aucune récupération confirmée pour l'instant."
              : "Aucun mouvement enregistré pour l'instant."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((m) => {
            const isLivraison = m.type === "livraison";
            return (
              <Card key={`${m.type}-${m.id}`}>
                <CardContent className="flex items-center gap-3 p-3">
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-md",
                      isLivraison ? "bg-emerald-100 text-emerald-700" : "bg-sky-100 text-sky-700",
                    )}
                  >
                    {isLivraison ? <FileArchive className="size-5" /> : <CheckCircle2 className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{m.numero ?? "—"}</span>
                      <Badge variant={isLivraison ? "secondary" : "info"} className="text-[10px]">
                        {isLivraison ? (
                          <><PackageCheck className="mr-1 size-3" />Livraison</>
                        ) : (
                          <><Undo2 className="mr-1 size-3" />Récupération</>
                        )}
                      </Badge>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                      {m.date && (
                        <span>
                          {isLivraison ? "Livré le " : "Récupéré le "}
                          {new Date(m.date + "T12:00:00").toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {m.client && <span>{m.client}</span>}
                      {m.lieu && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3" />{m.lieu}
                        </span>
                      )}
                      {!isLivraison && m.destination && <span>→ {m.destination}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
