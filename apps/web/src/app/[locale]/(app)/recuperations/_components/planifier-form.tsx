"use client";

import { useActionState } from "react";
import { Loader2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { planifierRecuperationAction, type RecuperationFormState } from "../actions";
import type { RefOption } from "../../affectations/_components/load-refs";

const initial: RecuperationFormState = { status: "idle" };
const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

export function PlanifierForm({
  conteneurId,
  chauffeurs,
  tracteurs,
  remorques,
}: {
  conteneurId: string;
  chauffeurs: RefOption[];
  tracteurs: RefOption[];
  remorques: RefOption[];
}) {
  const action = planifierRecuperationAction.bind(null, conteneurId);
  const [state, formAction, pending] = useActionState(action, initial);
  const v = state.status === "error" ? state.values ?? {} : {};
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-5">
      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Impossible de planifier</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="chauffeur_id">Chauffeur ★</Label>
          <select id="chauffeur_id" name="chauffeur_id" defaultValue={v.chauffeur_id ?? ""} required className={selectCls}>
            <option value="">— Choisir —</option>
            {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="tracteur_id">Tracteur ★</Label>
          <select id="tracteur_id" name="tracteur_id" defaultValue={v.tracteur_id ?? ""} required className={selectCls}>
            <option value="">— Choisir —</option>
            {tracteurs.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="remorque_id">Remorque (facultatif)</Label>
          <select id="remorque_id" name="remorque_id" defaultValue={v.remorque_id ?? ""} className={selectCls}>
            <option value="">— Aucune —</option>
            {remorques.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="date_planifiee">Date prévue</Label>
          <Input id="date_planifiee" name="date_planifiee" type="date" defaultValue={v.date_planifiee ?? today} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Destination du vide ★</Label>
        <div className="flex flex-wrap gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="destination_type" value="PARC_ACONIER" defaultChecked={v.destination_type !== "TERMINAL"} />
            Parc aconier
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="radio" name="destination_type" value="TERMINAL" defaultChecked={v.destination_type === "TERMINAL"} />
            Terminal
          </label>
        </div>
        <Input name="destination_lieu" placeholder="Nom du parc / terminal (facultatif)" defaultValue={v.destination_lieu ?? ""} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Planification…</> : <><Undo2 className="mr-2 size-4" />Planifier la récupération</>}
      </Button>
    </form>
  );
}
