"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, AlertTriangle, Save, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  posteForEquipe,
  ROULEMENT_POSTE_CODE,
  ROULEMENT_POSTE_LABEL,
  type RoulementPoste,
} from "@porttrack/shared";
import { saveRoulementConfigAction } from "../actions";

export type EquipeOption = { id: string; nom: string; code: string; couleur: string };

const POSTE_BG: Record<RoulementPoste, string> = {
  JOUR: "#bfdbfe",
  NUIT: "#1e293b",
  REPOS: "#e2e8f0",
};
const POSTE_FG: Record<RoulementPoste, string> = {
  JOUR: "#1e3a8a",
  NUIT: "#ffffff",
  REPOS: "#475569",
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoDate(d);
}
const FR_SHORT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });

export function RoulementForm({
  equipes,
  initial,
}: {
  equipes: EquipeOption[];
  initial: {
    dateReference: string;
    equipeJourId: string;
    equipeNuitId: string;
    equipeReposId: string;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const today = isoDate(new Date());
  const [dateReference, setDateReference] = useState(initial?.dateReference ?? today);
  const [equipeJourId, setEquipeJourId] = useState(initial?.equipeJourId ?? "");
  const [equipeNuitId, setEquipeNuitId] = useState(initial?.equipeNuitId ?? "");
  const [equipeReposId, setEquipeReposId] = useState(initial?.equipeReposId ?? "");

  const distinct =
    equipeJourId && equipeNuitId && equipeReposId &&
    equipeJourId !== equipeNuitId &&
    equipeJourId !== equipeReposId &&
    equipeNuitId !== equipeReposId;

  // Aperçu : poste de chaque équipe sur 8 jours à partir de la date de référence.
  const preview = useMemo(() => {
    if (!distinct) return null;
    const config = { dateReference, equipeJourId, equipeNuitId, equipeReposId };
    const days = Array.from({ length: 8 }, (_, i) => addDays(dateReference, i));
    const rows = [equipeJourId, equipeNuitId, equipeReposId].map((id) => {
      const eq = equipes.find((e) => e.id === id)!;
      return {
        eq,
        cells: days.map((d) => posteForEquipe(config, id, d)),
      };
    });
    return { days, rows };
  }, [distinct, dateReference, equipeJourId, equipeNuitId, equipeReposId, equipes]);

  function submit() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await saveRoulementConfigAction(dateReference, equipeJourId, equipeNuitId, equipeReposId);
      if (!r.ok) { setError(r.error); return; }
      setSaved(true);
      router.refresh();
    });
  }

  if (equipes.length < 3) {
    return (
      <Alert className="border-amber-300 bg-amber-50/60 text-amber-900">
        <AlertTriangle className="size-4" />
        <AlertTitle>Pas assez d&apos;équipes</AlertTitle>
        <AlertDescription>
          Le roulement nécessite 3 équipes actives (jour, nuit, repos). Crée tes équipes dans{" "}
          <Link href="/equipes" className="underline">Gérer les équipes</Link> avant de régler le roulement.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Enregistrement impossible</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
      )}
      {saved && (
        <Alert className="border-emerald-300 bg-emerald-50/60 text-emerald-900"><CheckCircle2 className="size-4" /><AlertTitle>Roulement enregistré</AlertTitle><AlertDescription>Le planning est recalculé à partir de ce réglage.</AlertDescription></Alert>
      )}

      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Date de référence</label>
            <Input
              type="date"
              value={dateReference}
              onChange={(e) => { setDateReference(e.target.value); setSaved(false); }}
              className="h-9 w-52"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              C&apos;est le <strong>1<sup>er</sup> des deux jours</strong> du poste indiqué ci-dessous pour chaque équipe.
              Si le roulement réel a décalé d&apos;un jour, avance ou recule cette date d&apos;un jour pour le recaler.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <PosteSelect label="Équipe en JOUR" poste="JOUR" value={equipeJourId} onChange={(v) => { setEquipeJourId(v); setSaved(false); }} equipes={equipes} />
            <PosteSelect label="Équipe en NUIT" poste="NUIT" value={equipeNuitId} onChange={(v) => { setEquipeNuitId(v); setSaved(false); }} equipes={equipes} />
            <PosteSelect label="Équipe en REPOS" poste="REPOS" value={equipeReposId} onChange={(v) => { setEquipeReposId(v); setSaved(false); }} equipes={equipes} />
          </div>

          {equipeJourId && equipeNuitId && equipeReposId && !distinct && (
            <p className="text-xs text-rose-600">Les trois équipes doivent être différentes.</p>
          )}

          <div className="flex justify-end">
            <Button onClick={submit} disabled={!distinct || pending} className="gap-2">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Enregistrer le roulement
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aperçu */}
      {preview && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CalendarRange className="size-4 text-primary" />
              Aperçu — 8 jours à partir de la date de référence
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">Équipe</th>
                    {preview.days.map((d) => (
                      <th key={d} className="px-2 py-1.5 text-center font-medium capitalize">
                        {FR_SHORT.format(new Date(d + "T12:00:00"))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map(({ eq, cells }) => (
                    <tr key={eq.id} className="border-t">
                      <td className="px-2 py-1.5">
                        <span className="flex items-center gap-1.5">
                          <span className="flex size-4 items-center justify-center rounded text-[9px] font-bold text-white" style={{ backgroundColor: eq.couleur }}>{eq.code}</span>
                          {eq.nom}
                        </span>
                      </td>
                      {cells.map((poste, i) => (
                        <td key={i} className="border-l p-1">
                          {poste ? (
                            <div
                              className="flex h-8 items-center justify-center rounded text-[11px] font-bold"
                              title={ROULEMENT_POSTE_LABEL[poste]}
                              style={{ backgroundColor: POSTE_BG[poste], color: POSTE_FG[poste] }}
                            >
                              {ROULEMENT_POSTE_CODE[poste]}
                            </div>
                          ) : <div className="h-8" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              J = Jour (06h–18h) · N = Nuit (18h–06h) · R = Repos. Vérifie que cet ordre correspond au terrain.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PosteSelect({
  label, poste, value, onChange, equipes,
}: {
  label: string;
  poste: RoulementPoste;
  value: string;
  onChange: (v: string) => void;
  equipes: EquipeOption[];
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        <span className="mr-1 inline-flex size-4 items-center justify-center rounded text-[9px] font-bold" style={{ backgroundColor: POSTE_BG[poste], color: POSTE_FG[poste] }}>
          {ROULEMENT_POSTE_CODE[poste]}
        </span>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">— Choisir —</option>
        {equipes.map((e) => (
          <option key={e.id} value={e.id}>{e.code} · {e.nom}</option>
        ))}
      </select>
    </div>
  );
}
