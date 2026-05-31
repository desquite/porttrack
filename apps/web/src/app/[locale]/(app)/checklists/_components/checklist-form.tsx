"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { createChecklistAction, updateChecklistAction, type ChecklistFormState } from "../actions";

export type ChecklistFormItem = {
  id: string;       // uuid de checklist_items_config
  label: string;
  defaultEtat?: "OK" | "ANOMALIE";
};

type CreateProps = {
  mode: "create";
  tenantId: string;
  designationId: string;
  chauffeurId: string;
  materielId: string;
  dateDepart: string;
  items: ChecklistFormItem[];
  defaultRemarque?: string;
};

type UpdateProps = {
  mode: "update";
  checklistId: string;
  items: ChecklistFormItem[];
  defaultRemarque?: string;
};

type Props = CreateProps | UpdateProps;

const initialState: ChecklistFormState = { status: "idle" };

export function ChecklistForm(props: Props) {
  const action = props.mode === "create"
    ? createChecklistAction
    : updateChecklistAction.bind(null, props.checklistId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const getValue = (name: string, fallback?: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) return state.values[name] ?? "";
    return fallback ?? "";
  };
  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return (state.fieldErrors?.[name as keyof typeof state.fieldErrors] as string[] | undefined)?.[0] ?? null;
  };

  return (
    <form action={formAction} className="space-y-6">
      {props.mode === "create" && (
        <>
          <input type="hidden" name="tenant_id" value={props.tenantId} />
          <input type="hidden" name="designation_id" value={props.designationId} />
          <input type="hidden" name="chauffeur_id" value={props.chauffeurId} />
          <input type="hidden" name="materiel_roulant_id" value={props.materielId} />
          <input type="hidden" name="date_depart" value={props.dateDepart} />
        </>
      )}

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {props.items.length === 0 ? (
        <Alert>
          <AlertTitle>Aucun item configuré</AlertTitle>
          <AlertDescription>
            La liste des items de check-list est vide pour ton entreprise.
            Demande à un manager d&apos;en ajouter dans
            {" "}<Link href="/parametres/checklist-items" className="underline">Paramètres → Items de check-list</Link>.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {props.items.map((item) => {
            const name = `item-${item.id}`;
            const current = getValue(name, item.defaultEtat ?? "OK");
            return (
              <ItemRow
                key={item.id}
                name={name}
                label={item.label}
                defaultValue={current}
                error={getError(name)}
              />
            );
          })}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="remarque" className="text-xs">Remarque libre</Label>
        <textarea
          id="remarque"
          name="remarque"
          rows={3}
          defaultValue={getValue("remarque", props.defaultRemarque ?? "")}
          placeholder="Détails sur les anomalies constatées (optionnel)"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        />
        {getError("remarque") && <p className="text-[11px] text-rose-600">{getError("remarque")}</p>}
        <p className="text-[11px] text-muted-foreground">
          Toute anomalie ou remarque non vide passe le statut global en <strong>Remarque</strong>.
        </p>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending || props.items.length === 0}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Enregistrement…</> :
            <><Save className="mr-2 size-4" />{props.mode === "create" ? "Valider la check-list" : "Mettre à jour"}</>}
        </Button>
      </div>
    </form>
  );
}

function ItemRow({
  name, label, defaultValue, error,
}: {
  name: string; label: string; defaultValue: string; error: string | null;
}) {
  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-3 rounded-md border p-3",
      error && "border-rose-300",
    )}>
      <div className="text-sm font-medium">{label}</div>
      <div className="flex gap-1.5">
        <RadioPill name={name} value="OK" checked={defaultValue === "OK"} label="OK" tone="ok" />
        <RadioPill name={name} value="ANOMALIE" checked={defaultValue === "ANOMALIE"} label="Anomalie" tone="anomalie" />
      </div>
      {error && <p className="basis-full text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}

function RadioPill({
  name, value, checked, label, tone,
}: {
  name: string; value: string; checked: boolean; label: string; tone: "ok" | "anomalie";
}) {
  return (
    <label
      className={cn(
        "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        "has-[:checked]:font-semibold",
        tone === "ok"
          ? "has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50 has-[:checked]:text-emerald-900"
          : "has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50 has-[:checked]:text-amber-900",
        "border-input bg-transparent text-muted-foreground hover:bg-muted",
      )}
    >
      <input type="radio" name={name} value={value} defaultChecked={checked} className="sr-only" />
      {label}
    </label>
  );
}
