import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { FileArchive, FileText, Search, XCircle, User, Truck, Package } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatDateFR } from "@/lib/utils/dates";
import { downloadEirAction } from "./actions";

export default async function EirPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; from?: string; to?: string; error?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const supabase = await createClient();

  // On joint le conteneur pour pouvoir filtrer/afficher numéro, BL, client.
  let query = supabase
    .from("eir_archives")
    .select(`
      id, date_livraison, fichier_nom, chauffeur_nom, tracteur_immat, uploaded_by_email, created_at,
      conteneur:conteneurs ( id, numero, numero_bl, client, transporteur )
    `)
    .order("date_livraison", { ascending: false })
    .limit(300);

  if (sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)) query = query.gte("date_livraison", sp.from);
  if (sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to)) query = query.lte("date_livraison", sp.to);

  const { data: rowsRaw } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (rowsRaw ?? []) as any[];

  // Recherche texte (numéro conteneur / BL / client / chauffeur) côté serveur
  const q = (sp.q ?? "").trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) => {
      const c = r.conteneur ?? {};
      return [c.numero, c.numero_bl, c.client, c.transporteur, r.chauffeur_nom]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(q));
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <FileArchive className="size-6 text-primary" />
          Archives EIR
        </h1>
        <p className="text-sm text-muted-foreground">
          Equipment Interchange Receipt — preuve de prise en charge / restitution (cahier §10). Conservation 5 ans.
        </p>
      </div>

      {sp.error && (
        <Alert variant="destructive"><XCircle className="size-4" /><AlertTitle>Erreur</AlertTitle><AlertDescription>{sp.error}</AlertDescription></Alert>
      )}

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <form action="/eir" className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <div className="space-y-1">
              <label htmlFor="q" className="text-[11px] text-muted-foreground">N° conteneur / BL / client / chauffeur</label>
              <Input id="q" name="q" defaultValue={sp.q ?? ""} placeholder="Rechercher…" className="h-9" />
            </div>
            <div className="space-y-1">
              <label htmlFor="from" className="text-[11px] text-muted-foreground">Du</label>
              <Input id="from" name="from" type="date" defaultValue={sp.from ?? ""} className="h-9" />
            </div>
            <div className="space-y-1">
              <label htmlFor="to" className="text-[11px] text-muted-foreground">Au</label>
              <Input id="to" name="to" type="date" defaultValue={sp.to ?? ""} className="h-9" />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm"><Search className="mr-2 size-4" />Filtrer</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <FileArchive className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucun EIR archivé</CardTitle>
            <CardDescription>
              Les EIR apparaissent ici dès qu&apos;une livraison est confirmée depuis la fiche conteneur.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {rows.map((r) => {
                const c = r.conteneur ?? {};
                return (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileArchive className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex items-center gap-1 font-mono font-medium">
                          <Package className="size-3.5 text-muted-foreground" />{c.numero ?? "—"}
                        </span>
                        {c.client && <span className="text-xs text-muted-foreground">{c.client}</span>}
                        {c.numero_bl && <span className="text-[11px] text-muted-foreground">BL {c.numero_bl}</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span>Livré le {formatDateFR(r.date_livraison)}</span>
                        {r.chauffeur_nom && <span className="flex items-center gap-1"><User className="size-3" />{r.chauffeur_nom}</span>}
                        {r.tracteur_immat && <span className="flex items-center gap-1"><Truck className="size-3" />{r.tracteur_immat}</span>}
                        {r.uploaded_by_email && <span>par {r.uploaded_by_email}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.id && (
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/conteneurs/${c.id}`}>Conteneur</Link>
                        </Button>
                      )}
                      <form action={downloadEirAction.bind(null, r.id)}>
                        <Button type="submit" variant="outline" size="sm">
                          <FileText className="mr-2 size-3.5" />{r.fichier_nom ?? "EIR"}
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
