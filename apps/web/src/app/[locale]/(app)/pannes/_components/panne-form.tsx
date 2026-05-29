"use client";

import { useActionState } from "react";
import { Loader2, Save, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PANNE_STATUTS, type Database } from "@porttrack/shared";
import {
  createPanneAction,
  updatePanneAction,
  type PanneFormState,
} from "../actions";

type Panne = Database["public"]["Tables"]["pannes"]["Row"];

export type MaterielOption = {
  id: string;
  label: string; // ex. "TIGER 01 — AA-1234-CI"
};

const STATUT_LABEL: Record<(typeof PANNE_STATUTS)[number], string> = {
  DECLAREE:      "Déclarée",
  EN_REPARATION: "En réparation",
  REPAREE:       "Réparée",
  ANNULEE:       "Annulée (fausse alerte)",
};

type Props = {
  mode: "create" | "update";
  panneId?: string;
  defaultValues?: Partial<Panne>;
  tenantId: string;
  materiels: MaterielOption[];
};

const initialState: PanneFormState = { status: "idle" };

export function PanneForm({
  mode,
  panneId,
  defaultValues,
  tenantId,
  materiels,
}: Props) {
  const boundAction =
    mode === "update" && panneId
      ? updatePanneAction.bind(null, panneId)
      : createPanneAction;

  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const getValue = (name: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) {
      return state.values[name] ?? "";
    }
    if (defaultValues && name in defaultValues) {
      const v = (defaultValues as Record<string, unknown>)[name];
      if (v == null) return "";
      return String(v);
    }
    return "";
  };
  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return (state.fieldErrors?.[name as keyof typeof state.fieldErrors] as string[] | undefined)?.[0] ?? null;
  };
  const fieldClass = (name: string) =>
    cn(getError(name) && "border-rose-500 focus-visible:ring-rose-500");
  const selectClass = (name: string) =>
    cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      getError(name) && "border-rose-500",
    );

  const defaultStatut = (defaultValues?.statut as string | undefined) ?? "DECLAREE";
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tenant_id" value={tenantId} />

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {/* Matériel + description */}
      <Section title="Panne déclarée">
        <Grid cols={2}>
          <Field label="Matériel concerné" name="materiel_roulant_id" required error={getError("materiel_roulant_id")}>
            <select
              id="materiel_roulant_id"
              name="materiel_roulant_id"
              required
              defaultValue={getValue("materiel_roulant_id") || defaultValues?.materiel_roulant_id || ""}
              className={selectClass("materiel_roulant_id")}
            >
              <option value="">— Sélectionner —</option>
              {materiels.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Date de déclaration" name="date_declaration" error={getError("date_declaration")}>
            <Input
              id="date_declaration"
              name="date_declaration"
              type="date"
              defaultValue={getValue("date_declaration") || (defaultValues?.date_declaration as string | undefined) || todayISO}
              className={fieldClass("date_declaration")}
            />
          </Field>

          <Field label="Description" name="description" required error={getError("description")} className="md:col-span-2">
            <textarea
              id="description"
              name="description"
              required
              rows={3}
              defaultValue={getValue("description") || (defaultValues?.description as string | undefined) || ""}
              placeholder="Ex. fuite d'huile sur le moteur, voyant moteur allumé…"
              className={cn(
                "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                getError("description") && "border-rose-500",
              )}
            />
          </Field>

          <Field label="Type de panne" name="type_panne" hint="Mécanique, électrique, pneu…" error={getError("type_panne")}>
            <Input id="type_panne" name="type_panne" defaultValue={getValue("type_panne")} className={fieldClass("type_panne")} />
          </Field>

          <Field label="Garage / réparateur" name="garage" error={getError("garage")}>
            <Input id="garage" name="garage" defaultValue={getValue("garage")} className={fieldClass("garage")} />
          </Field>
        </Grid>
      </Section>

      {/* Réparation + coûts */}
      <Section title="Réparation">
        <Grid cols={3}>
          <Field label="Début réparation" name="date_debut_reparation" error={getError("date_debut_reparation")}>
            <Input id="date_debut_reparation" name="date_debut_reparation" type="date" defaultValue={getValue("date_debut_reparation")} className={fieldClass("date_debut_reparation")} />
          </Field>
          <Field label="Fin réparation" name="date_fin_reparation" error={getError("date_fin_reparation")}>
            <Input id="date_fin_reparation" name="date_fin_reparation" type="date" defaultValue={getValue("date_fin_reparation")} className={fieldClass("date_fin_reparation")} />
          </Field>
          <Field label="Statut" name="statut" error={getError("statut")}>
            <select id="statut" name="statut" defaultValue={getValue("statut") || defaultStatut} className={selectClass("statut")}>
              {PANNE_STATUTS.map((s) => (
                <option key={s} value={s}>{STATUT_LABEL[s]}</option>
              ))}
            </select>
          </Field>

          <Field label="Coût estimé (FCFA)" name="cout_estime_fcfa" error={getError("cout_estime_fcfa")}>
            <Input id="cout_estime_fcfa" name="cout_estime_fcfa" type="number" min="0" step="1000" defaultValue={getValue("cout_estime_fcfa")} className={fieldClass("cout_estime_fcfa")} />
          </Field>
          <Field label="Coût réel (FCFA)" name="cout_reel_fcfa" error={getError("cout_reel_fcfa")} className="md:col-span-2">
            <Input id="cout_reel_fcfa" name="cout_reel_fcfa" type="number" min="0" step="1000" defaultValue={getValue("cout_reel_fcfa")} className={fieldClass("cout_reel_fcfa")} />
          </Field>
        </Grid>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={getValue("notes") || (defaultValues?.notes as string | undefined) || ""}
          placeholder="Informations complémentaires (optionnel)"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Enregistrement…
            </>
          ) : (
            <>
              {mode === "create" ? <Wrench className="mr-2 size-4" /> : <Save className="mr-2 size-4" />}
              {mode === "create" ? "Déclarer la panne" : "Enregistrer les modifications"}
            </>
          )}
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
  label,
  name,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={name} className="flex items-center gap-1 text-xs">
        {label}
        {required && <span className="text-rose-600">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
