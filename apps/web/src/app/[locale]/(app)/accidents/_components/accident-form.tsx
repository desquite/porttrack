"use client";

import { useActionState } from "react";
import { Loader2, Save, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ACCIDENT_STATUTS, type Database } from "@porttrack/shared";
import {
  createAccidentAction,
  updateAccidentAction,
  type AccidentFormState,
} from "../actions";

type Accident = Database["public"]["Tables"]["accidents"]["Row"];

export type AccidentRefOption = { id: string; label: string };

const STATUT_LABEL: Record<(typeof ACCIDENT_STATUTS)[number], string> = {
  DECLARE:             "Déclaré",
  EN_COURS_TRAITEMENT: "En cours de traitement",
  CLOTURE:             "Clôturé",
};

type Props = {
  mode: "create" | "update";
  accidentId?: string;
  defaultValues?: Partial<Accident>;
  tenantId: string;
  materiels: AccidentRefOption[];
  chauffeurs: AccidentRefOption[];
};

const initialState: AccidentFormState = { status: "idle" };

export function AccidentForm({ mode, accidentId, defaultValues, tenantId, materiels, chauffeurs }: Props) {
  const boundAction =
    mode === "update" && accidentId
      ? updateAccidentAction.bind(null, accidentId)
      : createAccidentAction;
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const getValue = (name: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) return state.values[name] ?? "";
    if (defaultValues && name in defaultValues) {
      const v = (defaultValues as Record<string, unknown>)[name];
      if (v == null) return "";
      // datetime-local : on tronque au format YYYY-MM-DDTHH:mm
      if (name === "date_accident" && typeof v === "string") return v.slice(0, 16);
      return String(v);
    }
    return "";
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

  const defaultStatut = (defaultValues?.statut as string | undefined) ?? "DECLARE";
  const defaultTiers = defaultValues?.tiers_implique ?? false;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tenant_id" value={tenantId} />

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <ShieldAlert className="size-4" />
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <Section title="L'accident">
        <Grid cols={2}>
          <Field label="Matériel impliqué" name="materiel_roulant_id" required error={getError("materiel_roulant_id")}>
            <select id="materiel_roulant_id" name="materiel_roulant_id" required
              defaultValue={getValue("materiel_roulant_id") || defaultValues?.materiel_roulant_id || ""}
              className={selectClass("materiel_roulant_id")}>
              <option value="">— Sélectionner —</option>
              {materiels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Chauffeur au volant" name="chauffeur_id" error={getError("chauffeur_id")}>
            <select id="chauffeur_id" name="chauffeur_id"
              defaultValue={getValue("chauffeur_id") || defaultValues?.chauffeur_id || ""}
              className={selectClass("chauffeur_id")}>
              <option value="">— Inconnu / non renseigné —</option>
              {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Date et heure" name="date_accident" required error={getError("date_accident")}>
            <Input id="date_accident" name="date_accident" type="datetime-local" required
              defaultValue={getValue("date_accident")} className={fieldClass("date_accident")} />
          </Field>
          <Field label="Lieu de l'accident" name="lieu_accident" error={getError("lieu_accident")}>
            <Input id="lieu_accident" name="lieu_accident"
              placeholder="Ex. Carrefour Indénié, Plateau"
              defaultValue={getValue("lieu_accident")} className={fieldClass("lieu_accident")} />
          </Field>
          <Field label="Circonstances" name="circonstances" required error={getError("circonstances")} className="md:col-span-2">
            <textarea id="circonstances" name="circonstances" required rows={3}
              defaultValue={getValue("circonstances") || (defaultValues?.circonstances as string | undefined) || ""}
              placeholder="Décris ce qui s'est passé…"
              className={cn(
                "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                getError("circonstances") && "border-rose-500",
              )} />
          </Field>
          <Field label="Tiers impliqué" name="tiers_implique" error={getError("tiers_implique")} className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="tiers_implique" defaultChecked={defaultTiers} className="size-4 rounded border-input" />
              Un tiers est impliqué dans cet accident
            </label>
          </Field>
        </Grid>
      </Section>

      <Section title="Suivi assurance">
        <Grid cols={3}>
          <Field label="Réf. dossier assurance" name="assurance_ref" error={getError("assurance_ref")}>
            <Input id="assurance_ref" name="assurance_ref" defaultValue={getValue("assurance_ref")} className={fieldClass("assurance_ref")} />
          </Field>
          <Field label="Date déclaration assurance" name="date_declaration_assurance" error={getError("date_declaration_assurance")}>
            <Input id="date_declaration_assurance" name="date_declaration_assurance" type="date"
              defaultValue={getValue("date_declaration_assurance")} className={fieldClass("date_declaration_assurance")} />
          </Field>
          <Field label="Statut" name="statut" error={getError("statut")}>
            <select id="statut" name="statut" defaultValue={getValue("statut") || defaultStatut} className={selectClass("statut")}>
              {ACCIDENT_STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Franchise (FCFA)" name="franchise_fcfa" error={getError("franchise_fcfa")}>
            <Input id="franchise_fcfa" name="franchise_fcfa" type="number" min="0" step="1000"
              defaultValue={getValue("franchise_fcfa")} className={fieldClass("franchise_fcfa")} />
          </Field>
          <Field label="Remboursement (FCFA)" name="remboursement_fcfa" error={getError("remboursement_fcfa")} className="md:col-span-2">
            <Input id="remboursement_fcfa" name="remboursement_fcfa" type="number" min="0" step="1000"
              defaultValue={getValue("remboursement_fcfa")} className={fieldClass("remboursement_fcfa")} />
          </Field>
        </Grid>
      </Section>

      <Section title="Notes">
        <textarea id="notes" name="notes" rows={3}
          defaultValue={getValue("notes") || (defaultValues?.notes as string | undefined) || ""}
          placeholder="Informations complémentaires (optionnel)"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Enregistrement…</> :
            <><Save className="mr-2 size-4" />{mode === "create" ? "Déclarer l'accident" : "Enregistrer"}</>}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Présentationnels
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="rounded-md border bg-muted/20 p-4">{children}</div>
    </div>
  );
}

function Grid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: React.ReactNode }) {
  return (
    <div className={cn("grid gap-4", cols === 2 && "md:grid-cols-2", cols === 3 && "md:grid-cols-3")}>
      {children}
    </div>
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
