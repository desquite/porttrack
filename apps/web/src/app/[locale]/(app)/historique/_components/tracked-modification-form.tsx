"use client";

import { useActionState, useState } from "react";
import { Loader2, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { createTrackedModificationAction, type ModificationFormState } from "../actions";

export type TrackedFieldOption = {
  champ: string;
  label: string;
  type: "text" | "datetime" | "date";
  /** Valeur actuelle, déjà formatée pour l'input (datetime-local: YYYY-MM-DDTHH:mm). */
  currentInput: string;
  /** Valeur actuelle affichée à l'humain. */
  currentDisplay: string;
};

type Props = {
  tenantId: string;
  tableCible: string;
  recordId: string;
  fields: TrackedFieldOption[];
};

const initialState: ModificationFormState = { status: "idle" };

export function TrackedModificationForm({ tenantId, tableCible, recordId, fields }: Props) {
  const [state, formAction, pending] = useActionState(createTrackedModificationAction, initialState);
  const [champ, setChamp] = useState<string>(fields[0]?.champ ?? "");
  const [hasFile, setHasFile] = useState(false);

  const selected = fields.find((f) => f.champ === champ) ?? fields[0];

  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return (state.fieldErrors?.[name as keyof typeof state.fieldErrors] as string[] | undefined)?.[0] ?? null;
  };

  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucun champ traçable pour cet enregistrement.</p>;
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="tenant_id" value={tenantId} />
      <input type="hidden" name="table_cible" value={tableCible} />
      <input type="hidden" name="enregistrement_id" value={recordId} />

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Modification refusée</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="champ" className="text-xs">Champ à modifier <span className="text-rose-600">*</span></Label>
          <select
            id="champ"
            name="champ"
            value={champ}
            onChange={(e) => setChamp(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            {fields.map((f) => <option key={f.champ} value={f.champ}>{f.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Valeur actuelle</Label>
          <div className="flex h-9 items-center rounded-md border border-dashed border-input bg-muted/40 px-3 text-sm text-muted-foreground">
            {selected?.currentDisplay || "(vide)"}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="valeur_apres" className="text-xs">Nouvelle valeur</Label>
        {selected?.type === "datetime" ? (
          <Input
            key={selected.champ}
            id="valeur_apres"
            name="valeur_apres"
            type="datetime-local"
            defaultValue={selected.currentInput}
            className={cn(getError("valeur_apres") && "border-rose-500")}
          />
        ) : selected?.type === "date" ? (
          <Input
            key={selected.champ}
            id="valeur_apres"
            name="valeur_apres"
            type="date"
            defaultValue={selected.currentInput}
            className={cn(getError("valeur_apres") && "border-rose-500")}
          />
        ) : (
          <Input
            key={selected?.champ}
            id="valeur_apres"
            name="valeur_apres"
            type="text"
            defaultValue={selected?.currentInput}
            placeholder="Laisser vide pour effacer la valeur"
            className={cn(getError("valeur_apres") && "border-rose-500")}
          />
        )}
        <p className="text-[11px] text-muted-foreground">Laisse le champ vide pour effacer la valeur actuelle.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="motif" className="text-xs">Motif de la modification <span className="text-rose-600">*</span></Label>
        <textarea
          id="motif"
          name="motif"
          rows={2}
          required
          placeholder="Ex : prorogation de délai confirmée par l'aconier"
          className={cn(
            "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
            getError("motif") && "border-rose-500",
          )}
        />
        {getError("motif") && <p className="text-[11px] text-rose-600">{getError("motif")}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="justificatif" className="text-xs">Justificatif <span className="text-rose-600">*</span></Label>
        <input
          id="justificatif"
          type="file"
          name="justificatif"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
          required
          onChange={(e) => setHasFile(!!e.target.files && e.target.files.length > 0)}
          className="block w-full cursor-pointer rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm file:mr-2 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Obligatoire (cahier §8.4). PDF, JPG, PNG ou HEIC — 10 Mo max. Le bouton reste désactivé tant qu&apos;aucun fichier n&apos;est joint.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
        <ShieldCheck className="size-4 shrink-0" />
        Cette modification sera enregistrée dans l&apos;historique <strong>immuable</strong> et un email sera envoyé au(x) manager(s).
      </div>

      <div className="flex justify-end border-t pt-4">
        <Button type="submit" disabled={pending || !hasFile}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Enregistrement…</> :
            <><Upload className="mr-2 size-4" />Valider la modification</>}
        </Button>
      </div>
    </form>
  );
}
