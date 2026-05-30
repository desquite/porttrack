"use client";

import { useActionState } from "react";
import { Loader2, Save, CalendarOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ABSENCE_TYPES, type Database } from "@porttrack/shared";
import { createAbsenceAction, updateAbsenceAction, type AbsenceFormState } from "../actions";

type Absence = Database["public"]["Tables"]["absences"]["Row"];

export type AbsenceRefOption = { id: string; label: string };

const TYPE_LABEL: Record<(typeof ABSENCE_TYPES)[number], string> = {
  CONGE_PLANIFIE:   "Congé planifié",
  ABSENCE_IMPREVUE: "Absence imprévue",
  MALADIE:          "Maladie",
  FORMATION:        "Formation",
  AUTRE:            "Autre",
};

type Props = {
  mode: "create" | "update";
  absenceId?: string;
  defaultValues?: Partial<Absence>;
  tenantId: string;
  chauffeurs: AbsenceRefOption[];
};

const initialState: AbsenceFormState = { status: "idle" };

export function AbsenceForm({ mode, absenceId, defaultValues, tenantId, chauffeurs }: Props) {
  const boundAction =
    mode === "update" && absenceId
      ? updateAbsenceAction.bind(null, absenceId)
      : createAbsenceAction;
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const getValue = (name: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) return state.values[name] ?? "";
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
  const fieldClass = (n: string) => cn(getError(n) && "border-rose-500 focus-visible:ring-rose-500");
  const selectClass = (n: string) =>
    cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      getError(n) && "border-rose-500",
    );

  const defaultType = (defaultValues?.type as string | undefined) ?? "CONGE_PLANIFIE";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tenant_id" value={tenantId} />

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <CalendarOff className="size-4" />
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Chauffeur" name="chauffeur_id" required error={getError("chauffeur_id")}>
          <select id="chauffeur_id" name="chauffeur_id" required
            defaultValue={getValue("chauffeur_id") || defaultValues?.chauffeur_id || ""}
            className={selectClass("chauffeur_id")}>
            <option value="">— Sélectionner —</option>
            {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Type d'absence" name="type" required error={getError("type")}>
          <select id="type" name="type" required
            defaultValue={getValue("type") || defaultType}
            className={selectClass("type")}>
            {ABSENCE_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
        </Field>
        <Field label="Date de début" name="date_debut" required error={getError("date_debut")}>
          <Input id="date_debut" name="date_debut" type="date" required
            defaultValue={getValue("date_debut") || today} className={fieldClass("date_debut")} />
        </Field>
        <Field label="Date de fin" name="date_fin" required error={getError("date_fin")} hint="Pour une seule journée, mets la même date que le début">
          <Input id="date_fin" name="date_fin" type="date" required
            defaultValue={getValue("date_fin") || today} className={fieldClass("date_fin")} />
        </Field>
        <Field label="Motif" name="motif" error={getError("motif")} className="md:col-span-2">
          <textarea id="motif" name="motif" rows={2}
            defaultValue={getValue("motif") || (defaultValues?.motif as string | undefined) || ""}
            placeholder="(optionnel)"
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Enregistrement…</> :
            <><Save className="mr-2 size-4" />{mode === "create" ? "Enregistrer l'absence" : "Enregistrer"}</>}
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
