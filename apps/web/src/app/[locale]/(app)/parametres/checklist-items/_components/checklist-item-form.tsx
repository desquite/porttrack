"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  createChecklistItemAction,
  updateChecklistItemAction,
  type ChecklistItemConfigFormState,
} from "../actions";

type CreateProps = {
  mode: "create";
  tenantId: string;
};

type UpdateProps = {
  mode: "update";
  itemId: string;
  defaults: { code: string; label: string; ordre: number; actif: boolean };
};

type Props = CreateProps | UpdateProps;

const initialState: ChecklistItemConfigFormState = { status: "idle" };

export function ChecklistItemForm(props: Props) {
  const action = props.mode === "create"
    ? createChecklistItemAction
    : updateChecklistItemAction.bind(null, props.itemId);
  const [state, formAction, pending] = useActionState(action, initialState);

  const getValue = (name: string, fallback?: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) return state.values[name] ?? "";
    return fallback ?? "";
  };
  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return (state.fieldErrors?.[name as keyof typeof state.fieldErrors] as string[] | undefined)?.[0] ?? null;
  };
  const fieldClass = (n: string) => cn(getError(n) && "border-rose-500 focus-visible:ring-rose-500");

  return (
    <form action={formAction} className="space-y-5">
      {props.mode === "create" && (
        <input type="hidden" name="tenant_id" value={props.tenantId} />
      )}

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code (slug stable)" name="code" required error={getError("code")} hint={props.mode === "update" ? "Non modifiable" : "Ex. huile, ceinture, klaxon. Minuscules / chiffres / _ ou -."}>
          <Input
            id="code"
            name="code"
            required
            readOnly={props.mode === "update"}
            disabled={props.mode === "update"}
            defaultValue={
              props.mode === "update"
                ? props.defaults.code
                : getValue("code", "")
            }
            placeholder="ex: ceinture"
            className={fieldClass("code")}
          />
        </Field>

        <Field label="Libellé affiché" name="label" required error={getError("label")}>
          <Input
            id="label"
            name="label"
            required
            defaultValue={getValue("label", props.mode === "update" ? props.defaults.label : "")}
            placeholder="Ex: Ceinture de sécurité"
            className={fieldClass("label")}
          />
        </Field>

        <Field label="Ordre d'affichage" name="ordre" error={getError("ordre")} hint="Plus petit = plus haut dans la check-list.">
          <Input
            id="ordre"
            name="ordre"
            type="number"
            min={0}
            max={9999}
            defaultValue={getValue("ordre", props.mode === "update" ? String(props.defaults.ordre) : "100")}
            className={fieldClass("ordre")}
          />
        </Field>

        <div className="flex items-end">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-sm shadow-sm">
            <input
              type="checkbox"
              name="actif"
              defaultChecked={props.mode === "update" ? props.defaults.actif : true}
              className="size-4"
            />
            <span className="font-medium">Item actif</span>
            <span className="text-xs text-muted-foreground">(visible dans les nouveaux formulaires)</span>
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Enregistrement…</> :
            <><Save className="mr-2 size-4" />{props.mode === "create" ? "Créer l'item" : "Mettre à jour"}</>}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label, name, hint, error, required, children,
}: {
  label: string; name: string; hint?: string; error?: string | null;
  required?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name} className="flex items-center gap-1 text-xs">
        {label}{required && <span className="text-rose-600">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
