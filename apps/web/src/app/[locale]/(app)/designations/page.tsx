import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import {
  Megaphone, Plus, CheckCircle2, ChevronLeft, ChevronRight, RotateCcw,
  Truck, MessageSquare, MessageSquareWarning, MessageSquareOff, User,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import type { Database } from "@porttrack/shared";

type WhatsappStatut = Database["public"]["Enums"]["designation_whatsapp_statut"];

const WA_LABEL: Record<WhatsappStatut, string> = {
  PENDING: "En attente",
  SENT:    "Envoyé",
  FAILED:  "Échec",
  SKIPPED: "Non envoyé",
};
const WA_VARIANT: Record<WhatsappStatut, "secondary" | "success" | "danger" | "warning"> = {
  PENDING: "warning",
  SENT:    "success",
  FAILED:  "danger",
  SKIPPED: "secondary",
};
const WA_ICON: Record<WhatsappStatut, typeof MessageSquare> = {
  PENDING: MessageSquare,
  SENT:    MessageSquare,
  FAILED:  MessageSquareWarning,
  SKIPPED: MessageSquareOff,
};

const FR_LONG = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export default async function DesignationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; created?: string; deleted?: string; resent?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);

  const today = isoDate(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const dateLabel = FR_LONG.format(new Date(date + "T12:00:00"));

  const supabase = await createClient();
  const { data: designations } = await supabase
    .from("designations")
    .select(`
      id, date_designation, whatsapp_statut, whatsapp_sent_at, whatsapp_error, notes,
      chauffeur:chauffeurs ( id, nom, prenoms, telephone ),
      materiel:materiel_roulant ( id, immatriculation, chrono, marque ),
      equipe:equipes ( nom, code, couleur )
    `)
    .eq("date_designation", date)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Megaphone className="size-6 text-primary" />
            Désignations du jour
          </h1>
          <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/designations?date=${addDays(date, -1)}`}><ChevronLeft className="size-4" /></Link>
          </Button>
          <form action="/designations" className="flex items-center gap-2">
            <Input type="date" name="date" defaultValue={date} className="h-8 w-44" />
            <Button type="submit" size="sm" variant="outline">OK</Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <Link href={`/designations?date=${today}`}><RotateCcw className="mr-1 size-3.5" />Aujourd&apos;hui</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/designations?date=${addDays(date, 1)}`}><ChevronRight className="size-4" /></Link>
          </Button>
          <Button asChild>
            <Link href={`/designations/new?date=${date}`}><Plus className="mr-2 size-4" />Désigner un chauffeur</Link>
          </Button>
        </div>
      </div>

      {sp.created && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Désignation créée et WhatsApp envoyé (si configuré)</AlertTitle></Alert>}
      {sp.deleted && <Alert className="border-rose-200 bg-rose-50/60 text-rose-900"><CheckCircle2 className="size-4" /><AlertTitle>Désignation supprimée</AlertTitle></Alert>}
      {sp.resent && <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>WhatsApp renvoyé</AlertTitle></Alert>}

      {!designations || designations.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Megaphone className="mx-auto size-8 text-muted-foreground" />
            <CardTitle className="text-base">Aucune désignation</CardTitle>
            <CardDescription>Personne n&apos;est désigné pour cette date. Tu peux commencer.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(designations as any[]).map((d) => <DesignationCard key={d.id} d={d} />)}
        </div>
      )}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function DesignationCard({ d }: { d: any }) {
  const ch = d.chauffeur as { id: string; nom: string; prenoms: string; telephone: string | null } | null;
  const mr = d.materiel as { id: string; immatriculation: string; chrono: string | null; marque: string | null } | null;
  const equipe = d.equipe as { nom: string; code: string; couleur: string | null } | null;
  const wa = d.whatsapp_statut as WhatsappStatut;
  const WaIcon = WA_ICON[wa];

  const mrLabel = mr
    ? mr.chrono
      ? `${mr.chrono} (${mr.immatriculation})`
      : mr.immatriculation
    : "—";

  return (
    <Card className="transition-colors hover:border-primary/30">
      <CardContent className="flex flex-wrap items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Megaphone className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {equipe && (
              <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: equipe.couleur ?? "#3b82f6" }}>
                {equipe.code}
              </span>
            )}
            <span className="font-medium truncate">{ch?.nom ?? "?"} {ch?.prenoms ?? ""}</span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="flex items-center gap-1 text-sm">
              <Truck className="size-3.5 text-muted-foreground" />
              {mrLabel}
            </span>
            {mr?.marque && <span className="text-xs text-muted-foreground">{mr.marque}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Badge variant={WA_VARIANT[wa]} className="gap-1 text-[10px]">
              <WaIcon className="size-3" />
              WhatsApp {WA_LABEL[wa]}
            </Badge>
            {ch?.telephone && <span>{ch.telephone}</span>}
            {equipe && <span>{equipe.nom}</span>}
            {d.notes && <span className="truncate italic">— {d.notes}</span>}
          </div>
          {wa === "FAILED" && d.whatsapp_error && (
            <p className="mt-1 text-[11px] text-rose-700">Erreur : {d.whatsapp_error}</p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {ch && <Button asChild variant="ghost" size="sm"><Link href={`/chauffeurs/${ch.id}`}><User className="size-3.5" /></Link></Button>}
          <Button asChild variant="outline" size="sm"><Link href={`/designations/${d.id}`}>Détails</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}
