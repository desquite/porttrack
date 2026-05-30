"use client";

import { useActionState } from "react";
import { Loader2, Save, CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { WEEKDAYS, type Database } from "@porttrack/shared";
import { createEquipeAction, updateEquipeAction, type EquipeFormState } from "../actions";

type Equipe = Database["public"]["Tables"]["equipes"]["Row"];

type Props = {
  mode: "create" | "update";
  equipeId?: string;
  defaultValues?: Partial<Equipe>;
  tenantId: string;
};

const initialState: EquipeFormState = { status: "idle" };

export function EquipeForm({ mode, equipeId, defaultValues, tenantId }: Props) {
  const boundAction =
    mode === "update" && equipeId
      ? updateEquipeAction.bind(null, equipeId)
      : createEquipeAction;
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const getValue = (name: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) return state.values[name] ?? "";
    if (defaultValues && name in defaultValues) {
      const v = (defaultValues as Record<string, unknown>)[name];
      if (v == null) return "";
      // time fields : tronque seconde si présente
      if ((name === "heure_debut" || name === "heure_fin") && typeof v === "string") return v.slice(0, 5);
      return String(v);
    }
    return "";
  };
  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return (state.fieldErrors?.[name as keyof typeof state.fieldErrors] as string[] | undefined)?.[0] ?? null;
  };
  const fieldClass = (n: string) => cn(getError(n) && "border-rose-500 focus-visible:ring-rose-500");

  const defaultJours = (defaultValues?.jours_travailles as number[] | undefined) ?? [1, 2, 3, 4, 5];
  const defaultActif = defaultValues?.actif ?? true;
  const defaultCouleur = (defaultValues?.couleur as string | undefined) ?? "#3b82f6";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tenant_id" value={tenantId} />

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <CalendarClock className="size-4" />
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom de l'équipe" name="nom" required error={getError("nom")}>
          <Input id="nom" name="nom" required placeholder="Ex. Équipe Jour"
            defaultValue={getValue("nom")} className={fieldClass("nom")} />
        </Field>
        <Field label="Code court" name="code" required error={getError("code")} hint="1 à 3 caractères affichés dans la grille (ex. J, N, R)">
          <Input id="code" name="code" required maxLength={3} placeholder="J"
            defaultValue={getValue("code")} className={fieldClass("code")} />
        </Field>
        <Field label="Heure début" name="heure_debut" error={getError("heure_debut")} hint="Laisse vide pour une équipe Repos">
          <Input id="heure_debut" name="heure_debut" type="time"
            defaultValue={getValue("heure_debut")} className={fieldClass("heure_debut")} />
        </Field>
        <Field label="Heure fin" name="heure_fin" error={getError("heure_fin")}>
          <Input id="heure_fin" name="heure_fin" type="time"
            defaultValue={getValue("heure_fin")} className={fieldClass("heure_fin")} />
        </Field>
        <Field label="Couleur d'affichage" name="couleur" error={getError("couleur")} className="md:col-span-1">
          <Input id="couleur" name="couleur" type="color"
            defaultValue={getValue("couleur") || defaultCouleur}
            className={cn("h-9 w-24 cursor-pointer", fieldClass("couleur"))} />
        </Field>
        <Field label="Ordre d'affichage" name="ordre" error={getError("ordre")} hint="Plus petit = en haut de la liste">
          <Input id="ordre" name="ordre" type="number" min="0" step="1"
            defaultValue={getValue("ordre") || "0"} className={fieldClass("ordre")} />
        </Field>
      </div>

      <div>
        <Label className="text-xs">Jours travaillés <span className="text-rose-600">*</span></Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => {
            const checked = defaultJours.includes(d.value);
            return (
              <label key={d.value} className="flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-muted/40">
                <input type="checkbox" name="jours_travailles" value={d.value} defaultChecked={checked} className="size-3.5 rounded border-input" />
                {d.labelLong}
              </label>
            );
          })}
        </div>
        {getError("jours_travailles") && <p className="mt-1 text-[11px] text-rose-600">{getError("jours_travailles")}</p>}
      </div>

      <div className="flex items-center gap-2">
        <input id="actif" type="checkbox" name="actif" defaultChecked={defaultActif} className="size-4 rounded border-input" />
        <Label htmlFor="actif" className="text-sm">Équipe active</Label>
      </div>

      <Field label="Notes" name="notes" error={getError("notes")}>
        <textarea id="notes" name="notes" rows={2}
          defaultValue={getValue("notes")}
          placeholder="Informations complémentaires (optionnel)"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
      </Field>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Enregistrement…</> :
            <><Save className="mr-2 size-4" />{mode === "create" ? "Créer l'équipe" : "Enregistrer"}</>}
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
