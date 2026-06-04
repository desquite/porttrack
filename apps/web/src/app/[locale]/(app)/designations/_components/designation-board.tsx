"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Truck, User, Link2, X, Send, Loader2, CheckCircle2, AlertTriangle, Lock, Wrench,
  MessageSquare, MessageSquareWarning, MessageSquareOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { Database } from "@porttrack/shared";
import { addPaireAction, removePaireAction, validerToutAction, libererDesignationAction } from "../actions";

type WhatsappStatut = Database["public"]["Enums"]["designation_whatsapp_statut"];

export type BoardOption = {
  id: string;
  label: string;
  equipeCode?: string | null;
  equipeCouleur?: string | null;
};
export type BoardPair = {
  id: string;
  driverName: string;
  truckLabel: string;
  equipeCode: string | null;
  equipeCouleur: string | null;
  validated: boolean;
  enPanne: boolean;
  whatsappStatut: WhatsappStatut;
};

const WA_LABEL: Record<WhatsappStatut, string> = {
  PENDING: "En attente", SENT: "Envoyé", FAILED: "Échec", SKIPPED: "Non envoyé",
};
const WA_ICON: Record<WhatsappStatut, typeof MessageSquare> = {
  PENDING: MessageSquare, SENT: MessageSquare, FAILED: MessageSquareWarning, SKIPPED: MessageSquareOff,
};

export function DesignationBoard({
  date,
  locked,
  horsDelai,
  trucks,
  drivers,
  pairs,
}: {
  date: string;
  locked: boolean;
  horsDelai: boolean;
  trucks: BoardOption[];
  drivers: BoardOption[];
  pairs: BoardPair[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selTruck, setSelTruck] = useState<string | null>(null);
  const [selDriver, setSelDriver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);

  const drafts = pairs.filter((p) => !p.validated);
  const editable = !locked && !horsDelai;

  function associer() {
    if (!selTruck || !selDriver) return;
    setError(null); setBilan(null);
    startTransition(async () => {
      const r = await addPaireAction(date, selDriver, selTruck);
      if (!r.ok) { setError(r.error); return; }
      setSelTruck(null); setSelDriver(null);
      router.refresh();
    });
  }

  function retirer(id: string) {
    setError(null); setBilan(null);
    startTransition(async () => {
      const r = await removePaireAction(id);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  }

  function validerTout() {
    setError(null); setBilan(null);
    startTransition(async () => {
      const r = await validerToutAction(date);
      if (!r.ok) { setError(r.error); return; }
      setBilan(`${r.total} désignation(s) validée(s) — ${r.sent} WhatsApp envoyé(s), ${r.failed} échec(s), ${r.skipped} non envoyé(s).`);
      router.refresh();
    });
  }

  function liberer(id: string) {
    if (!window.confirm("Libérer ce chauffeur ? Sa désignation sera annulée (camion en panne) et il redeviendra disponible pour une nouvelle désignation.")) return;
    setError(null); setBilan(null);
    startTransition(async () => {
      const r = await libererDesignationAction(id);
      if (!r.ok) { setError(r.error); return; }
      router.refresh();
    });
  }

  if (horsDelai) {
    return (
      <Alert className="border-amber-300 bg-amber-50/60 text-amber-900">
        <AlertTriangle className="size-4" />
        <AlertTitle>Hors délai</AlertTitle>
        <AlertDescription>On ne peut désigner que jusqu&apos;à 30 jours à l&apos;avance. Choisis une date plus proche.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Action impossible</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {bilan && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Validation effectuée</AlertTitle><AlertDescription>{bilan}</AlertDescription></Alert>
      )}
      {locked && (
        <Alert className="border-slate-300 bg-slate-50/60"><Lock className="size-4" /><AlertTitle>Journée verrouillée</AlertTitle><AlertDescription>Cette date est passée — les désignations sont en lecture seule.</AlertDescription></Alert>
      )}

      {/* Panneaux disponibles — masqués si verrouillé */}
      {editable && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Camions */}
          <Panel title="Camions disponibles" icon={Truck} count={trucks.length}>
            {trucks.length === 0 ? (
              <Empty text="Aucun camion disponible (tous désignés ou en panne)." />
            ) : (
              <ul className="space-y-1.5">
                {trucks.map((t) => (
                  <SelectableRow
                    key={t.id}
                    label={t.label}
                    icon={<Truck className="size-4 text-muted-foreground" />}
                    selected={selTruck === t.id}
                    onClick={() => setSelTruck(selTruck === t.id ? null : t.id)}
                  />
                ))}
              </ul>
            )}
          </Panel>

          {/* Chauffeurs */}
          <Panel title="Chauffeurs disponibles" icon={User} count={drivers.length}>
            {drivers.length === 0 ? (
              <Empty text="Aucun chauffeur disponible (tous désignés ou absents)." />
            ) : (
              <ul className="space-y-1.5">
                {drivers.map((d) => (
                  <SelectableRow
                    key={d.id}
                    label={d.label}
                    icon={
                      d.equipeCode ? (
                        <span className="flex size-4 items-center justify-center rounded text-[9px] font-bold text-white" style={{ backgroundColor: d.equipeCouleur ?? "#3b82f6" }}>
                          {d.equipeCode}
                        </span>
                      ) : <User className="size-4 text-muted-foreground" />
                    }
                    selected={selDriver === d.id}
                    onClick={() => setSelDriver(selDriver === d.id ? null : d.id)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {/* Barre d'association */}
      {editable && (
        <div className="flex items-center justify-center">
          <Button onClick={associer} disabled={!selTruck || !selDriver || pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            Associer la paire
          </Button>
        </div>
      )}

      {/* Paires constituées */}
      <Panel title="Paires constituées" icon={Link2} count={pairs.length}>
        {pairs.length === 0 ? (
          <Empty text="Aucune paire pour cette date." />
        ) : (
          <ul className="space-y-2">
            {pairs.map((p) => {
              const WaIcon = WA_ICON[p.whatsappStatut];
              return (
                <li key={p.id} className={cn("flex flex-wrap items-center gap-3 rounded-md border p-2.5", p.enPanne && "border-rose-300 bg-rose-50/50")}>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {p.equipeCode && (
                      <span className="flex size-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: p.equipeCouleur ?? "#3b82f6" }}>
                        {p.equipeCode}
                      </span>
                    )}
                    <span className="font-medium truncate">{p.driverName}</span>
                    <span className="text-xs text-muted-foreground">↔</span>
                    <span className="flex items-center gap-1 text-sm"><Truck className="size-3.5 text-muted-foreground" />{p.truckLabel}</span>
                  </div>
                  {p.enPanne ? (
                    <Badge variant="danger" className="gap-1 text-[10px]"><Wrench className="size-3" />Camion en panne</Badge>
                  ) : p.validated ? (
                    <Badge variant="success" className="gap-1 text-[10px]"><WaIcon className="size-3" />Validé · WhatsApp {WA_LABEL[p.whatsappStatut]}</Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1 text-[10px]">Brouillon</Badge>
                  )}
                  {/* En panne → libérer le chauffeur (annule la désignation, garde la trace) */}
                  {editable && p.enPanne && (
                    <Button variant="outline" size="sm" onClick={() => liberer(p.id)} disabled={pending} className="h-8 gap-1 border-rose-300 text-rose-700 hover:bg-rose-50">
                      <Wrench className="size-3.5" />Libérer
                    </Button>
                  )}
                  {/* Brouillon non en panne → retirer */}
                  {editable && !p.validated && !p.enPanne && (
                    <Button variant="ghost" size="sm" onClick={() => retirer(p.id)} disabled={pending} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" title="Retirer">
                      <X className="size-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* VALIDER TOUT */}
      {editable && drafts.length > 0 && (
        <div className="flex flex-col items-end gap-2 border-t pt-4">
          <Button onClick={validerTout} disabled={pending} size="lg" className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Valider tout et notifier ({drafts.length})
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Aucun WhatsApp n&apos;est envoyé tant que tu ne cliques pas. La validation envoie tout d&apos;un coup.
          </p>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function Panel({ title, icon: Icon, count, children }: { title: string; icon: typeof Truck; count: number; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
          <Badge variant="secondary" className="text-[10px]">{count}</Badge>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SelectableRow({ label, icon, selected, onClick }: { label: string; icon: React.ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
          selected ? "border-primary bg-primary/10 font-medium" : "border-input hover:bg-accent",
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">{text}</p>;
}
