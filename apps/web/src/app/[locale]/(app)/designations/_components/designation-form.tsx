"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { createDesignationAction, type DesignationFormState } from "../actions";

export type DesignationRefOption = { id: string; label: string };

type Props = {
  tenantId: string;
  chauffeurs: DesignationRefOption[];
  materiels: DesignationRefOption[];
  defaultDate?: string;
  defaultChauffeur?: string;
  defaultMateriel?: string;
};

const initialState: DesignationFormState = { status: "idle" };

export function DesignationForm({
  tenantId, chauffeurs, materiels, defaultDate, defaultChauffeur, defaultMateriel,
}: Props) {
  const [state, formAction, pending] = useActionState(createDesignationAction, initialState);

  const getValue = (name: string, fallback?: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) return state.values[name] ?? "";
    return fallback ?? "";
  };
  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return (state.fieldErrors?.[name as keyof typeof state.fieldErrors] as string[] | undefined)?.[0] ?? null;
  };
  const fieldClass = (n: string) => cn(getError(n) && "border-rose-500 focus-visible:ring-rose-500");
  const selectClass = (n: string) =>
    cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      getError(n) && "border-rose-500",
    );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tenant_id" value={tenantId} />

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Date de désignation" name="date_designation" required error={getError("date_designation")}>
          <Input id="date_designation" name="date_designation" type="date" required
            defaultValue={getValue("date_designation", defaultDate ?? today)} className={fieldClass("date_designation")} />
        </Field>

        <Field label="Chauffeur" name="chauffeur_id" required error={getError("chauffeur_id")}>
          <select id="chauffeur_id" name="chauffeur_id" required
            defaultValue={getValue("chauffeur_id", defaultChauffeur ?? "")}
            className={selectClass("chauffeur_id")}>
            <option value="">— Sélectionner —</option>
            {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>

        <Field label="Matériel roulant" name="materiel_roulant_id" required error={getError("materiel_roulant_id")} className="md:col-span-2">
          <select id="materiel_roulant_id" name="materiel_roulant_id" required
            defaultValue={getValue("materiel_roulant_id", defaultMateriel ?? "")}
            className={selectClass("materiel_roulant_id")}>
            <option value="">— Sélectionner —</option>
            {materiels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>

        <Field label="Notes" name="notes" error={getError("notes")} className="md:col-span-2">
          <textarea id="notes" name="notes" rows={2}
            defaultValue={getValue("notes")}
            placeholder="Consignes particulières (optionnel)"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
        </Field>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900">
        <strong>WhatsApp automatique</strong> : un message sera envoyé au chauffeur dès la création
        avec son matériel, son équipe et le rappel de check-list. Vérifie que son numéro est à jour.
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Création + envoi WhatsApp…</> :
            <><Send className="mr-2 size-4" />Désigner et notifier</>}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label, name, hint, error, required, className, children,
}: {
  label: string; name: string; hint?: string; error?: string | null;
  required?: boolean; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className="flex items-center gap-1 text-xs">
        {label}{required && <span className="text-rose-600">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
