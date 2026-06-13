"use client";

import { useActionState, useState } from "react";
import { Loader2, PackageCheck, User, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { confirmDeliveryWithEirAction, type ConfirmDeliveryState } from "../actions";

export type RemorqueOption = { id: string; label: string };

type Props = {
  tenantId: string;
  conteneurId: string;
  affectationId?: string | null;
  chauffeurNom?: string | null;
  tracteurImmat?: string | null;
  remorques: RemorqueOption[];
  defaultRemorqueId?: string | null;
};

const MODES = [
  { value: "REMORQUE_COUPEE", label: "Remorque coupée sur site (laissée chez le client)" },
  { value: "CLIENT_DECHARGE", label: "Client a déchargé (la remorque repart)" },
  { value: "AUTO_CHARGEUR", label: "Déposé par terre (auto-chargeur, sans remorque)" },
];

const initialState: ConfirmDeliveryState = { status: "idle" };
const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring";

export function ConfirmDeliveryForm({
  tenantId, conteneurId, affectationId, chauffeurNom, tracteurImmat, remorques, defaultRemorqueId,
}: Props) {
  const [state, formAction, pending] = useActionState(confirmDeliveryWithEirAction, initialState);
  const [hasFile, setHasFile] = useState(false);
  const [mode, setMode] = useState("");
  const [remorqueId, setRemorqueId] = useState(defaultRemorqueId ?? "");

  const today = new Date().toISOString().slice(0, 10);
  const needsRemorque = mode !== "" && mode !== "AUTO_CHARGEUR";
  const canSubmit = hasFile && !!mode && (!needsRemorque || !!remorqueId);

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="conteneur_id" value={conteneurId} />
      {affectationId && <input type="hidden" name="affectation_id" value={affectationId} />}

      {state.status === "error" && (
        <Alert variant="destructive">
          <AlertTitle>Livraison non confirmée</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {(chauffeurNom || tracteurImmat) && (
        <div className="flex flex-wrap gap-4 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          {chauffeurNom && <span className="flex items-center gap-1.5"><User className="size-3.5" />{chauffeurNom}</span>}
          {tracteurImmat && <span className="flex items-center gap-1.5"><Truck className="size-3.5" />{tracteurImmat}</span>}
          <span className="italic">— enregistrés avec l&apos;EIR</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="mode_livraison" className="text-xs">Mode de livraison <span className="text-rose-600">*</span></Label>
        <select id="mode_livraison" name="mode_livraison" value={mode} onChange={(e) => setMode(e.target.value)} className={selectClass}>
          <option value="">— Comment le conteneur a-t-il été livré ? —</option>
          {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {needsRemorque && (
        <div className="space-y-1.5">
          <Label htmlFor="remorque_id" className="text-xs">Remorque / châssis utilisé <span className="text-rose-600">*</span></Label>
          <select id="remorque_id" name="remorque_id" value={remorqueId} onChange={(e) => setRemorqueId(e.target.value)} className={selectClass}>
            <option value="">— Choisir —</option>
            {remorques.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {remorques.length === 0 && <p className="text-[11px] text-amber-700">Aucune remorque en service dans la flotte.</p>}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="date_livraison" className="text-xs">Date de livraison</Label>
          <Input id="date_livraison" name="date_livraison" type="date" defaultValue={today} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eir" className="text-xs">Fichier EIR <span className="text-rose-600">*</span></Label>
          <input
            id="eir"
            type="file"
            name="eir"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            required
            onChange={(e) => setHasFile(!!e.target.files && e.target.files.length > 0)}
            className="block w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        L&apos;upload de l&apos;EIR est obligatoire. Photo smartphone acceptée — PDF, JPG, PNG, HEIC, 10 Mo max.
        Une fois confirmé, le conteneur passe en <strong>Livré</strong> et l&apos;EIR est archivé (conservation 5 ans).
      </p>

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending || !canSubmit}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Confirmation…</> :
            <><PackageCheck className="mr-2 size-4" />Confirmer la livraison</>}
        </Button>
      </div>
    </form>
  );
}
