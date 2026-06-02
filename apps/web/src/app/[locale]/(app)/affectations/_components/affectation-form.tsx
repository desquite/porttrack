"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { AFFECTATION_STATUTS, type Database } from "@porttrack/shared";
import {
  createAffectationAction,
  updateAffectationAction,
  type AffectationFormState,
} from "../actions";
import type { RefOption } from "./load-refs";

type Affectation = Database["public"]["Tables"]["affectations"]["Row"];

type Props = {
  mode: "create" | "update";
  isSuperAdmin: boolean;
  tenants: { id: string; nom_entreprise: string }[];
  defaultTenantId: string | null;
  defaultValues?: Partial<Affectation>;
  affectationId?: string;
  conteneurs: RefOption[];
  chauffeurs: RefOption[];
  tracteurs: RefOption[];
};

const STATUT_LABEL: Record<(typeof AFFECTATION_STATUTS)[number], string> = {
  PLANIFIEE: "Planifiée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

const initialState: AffectationFormState = { status: "idle" };

export function AffectationForm({
  mode,
  isSuperAdmin,
  tenants,
  defaultTenantId,
  defaultValues,
  affectationId,
  conteneurs,
  chauffeurs,
  tracteurs,
}: Props) {
  const boundAction =
    mode === "update" && affectationId
      ? updateAffectationAction.bind(null, affectationId)
      : createAffectationAction;

  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const getValue = (name: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) {
      return state.values[name] ?? "";
    }
    if (defaultValues && name in defaultValues) {
      const v = (defaultValues as Record<string, unknown>)[name];
      if (v == null) return "";
      // timestamptz → datetime-local
      if (
        (name === "date_depart_prevue" ||
          name === "date_depart_reelle" ||
          name === "date_retour") &&
        typeof v === "string"
      ) {
        return v.slice(0, 16);
      }
      return String(v);
    }
    // défaut : date d'affectation = aujourd'hui en création
    if (name === "date_affectation" && mode === "create") {
      return new Date().toISOString().slice(0, 10);
    }
    return "";
  };
  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return state.fieldErrors?.[name as keyof typeof state.fieldErrors]?.[0] ?? null;
  };
  const fieldClass = (name: string) =>
    cn(getError(name) && "border-rose-500 focus-visible:ring-rose-500");
  const selectClass = (name: string) =>
    cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      getError(name) && "border-rose-500 focus-visible:ring-rose-500",
    );

  const showTenantSelector = mode === "create" && isSuperAdmin;

  return (
    <form action={formAction} className="space-y-8">
      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d'enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {showTenantSelector ? (
        <Section title="Affectation à une entreprise">
          <Field label="Entreprise" name="tenant_id" required error={getError("tenant_id")}>
            <select id="tenant_id" name="tenant_id" defaultValue={getValue("tenant_id") || defaultTenantId || ""} required className={selectClass("tenant_id")}>
              <option value="">— Sélectionner —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.nom_entreprise}</option>
              ))}
            </select>
          </Field>
        </Section>
      ) : (
        <input type="hidden" name="tenant_id" value={defaultTenantId ?? ""} />
      )}

      {/* Liens métier. La remorque/châssis n'est PLUS choisie ici : c'est le
          chauffeur qui sélectionne l'équipement utilisé au moment de confirmer
          la livraison (cf. PWA chauffeur / EIR). On préserve néanmoins la valeur
          existante en édition via un input hidden pour ne pas l'effacer. */}
      <input type="hidden" name="remorque_id" value={getValue("remorque_id")} />
      <Section title="Conteneur & ressources" description="Sélectionne le conteneur à livrer, le chauffeur et le tracteur affectés.">
        <Grid cols={2}>
          <Field label="Conteneur" name="conteneur_id" required error={getError("conteneur_id")} className="md:col-span-2">
            <Combobox
              id="conteneur_id"
              name="conteneur_id"
              options={conteneurs}
              defaultValue={getValue("conteneur_id")}
              placeholder="— Sélectionner un conteneur —"
              searchPlaceholder="Rechercher un conteneur (n°, BL, client…)"
              required
              invalid={!!getError("conteneur_id")}
            />
          </Field>

          <Field label="Chauffeur" name="chauffeur_id" error={getError("chauffeur_id")}>
            <Combobox
              id="chauffeur_id"
              name="chauffeur_id"
              options={chauffeurs}
              defaultValue={getValue("chauffeur_id")}
              placeholder="— Non assigné —"
              searchPlaceholder="Rechercher un chauffeur…"
              emptyOptionLabel="— Non assigné —"
              invalid={!!getError("chauffeur_id")}
            />
          </Field>

          <Field label="Tracteur" name="tracteur_id" error={getError("tracteur_id")}>
            <Combobox
              id="tracteur_id"
              name="tracteur_id"
              options={tracteurs}
              defaultValue={getValue("tracteur_id")}
              placeholder="— Non assigné —"
              searchPlaceholder="Rechercher un tracteur (immat., chrono…)"
              emptyOptionLabel="— Non assigné —"
              invalid={!!getError("tracteur_id")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Dates */}
      <Section title="Planning">
        <Grid cols={2}>
          <Field label="Date d'affectation" name="date_affectation" required error={getError("date_affectation")}>
            <Input id="date_affectation" name="date_affectation" type="date" defaultValue={getValue("date_affectation")} required className={fieldClass("date_affectation")} />
          </Field>
          <Field label="Départ prévu" name="date_depart_prevue" error={getError("date_depart_prevue")}>
            <Input id="date_depart_prevue" name="date_depart_prevue" type="datetime-local" defaultValue={getValue("date_depart_prevue")} className={fieldClass("date_depart_prevue")} />
          </Field>
          <Field label="Départ réel" name="date_depart_reelle" error={getError("date_depart_reelle")}>
            <Input id="date_depart_reelle" name="date_depart_reelle" type="datetime-local" defaultValue={getValue("date_depart_reelle")} className={fieldClass("date_depart_reelle")} />
          </Field>
          <Field label="Retour" name="date_retour" error={getError("date_retour")}>
            <Input id="date_retour" name="date_retour" type="datetime-local" defaultValue={getValue("date_retour")} className={fieldClass("date_retour")} />
          </Field>
        </Grid>
      </Section>

      {/* Km + statut */}
      <Section title="Kilométrage & statut">
        <Grid cols={3}>
          <Field label="Km départ" name="km_depart" error={getError("km_depart")}>
            <Input id="km_depart" name="km_depart" type="number" min="0" step="1" defaultValue={getValue("km_depart")} className={fieldClass("km_depart")} />
          </Field>
          <Field label="Km retour" name="km_retour" error={getError("km_retour")}>
            <Input id="km_retour" name="km_retour" type="number" min="0" step="1" defaultValue={getValue("km_retour")} className={fieldClass("km_retour")} />
          </Field>
          <Field label="Statut" name="statut" required error={getError("statut")}>
            <select id="statut" name="statut" defaultValue={getValue("statut") || "PLANIFIEE"} required className={selectClass("statut")}>
              {AFFECTATION_STATUTS.map((s) => (
                <option key={s} value={s}>{STATUT_LABEL[s]}</option>
              ))}
            </select>
          </Field>
        </Grid>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <Field label="Notes libres" name="notes" error={getError("notes")}>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            defaultValue={getValue("notes")}
            placeholder="Consignes de livraison, contacts sur place, incidents…"
            className={cn(
              "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              getError("notes") && "border-rose-500",
            )}
          />
        </Field>
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
              <Save className="mr-2 size-4" />
              {mode === "update" ? "Enregistrer les modifications" : "Créer l'affectation"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Présentationnels
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="rounded-md border bg-muted/20 p-4">{children}</div>
    </div>
  );
}

function Grid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: React.ReactNode }) {
  return <div className={cn("grid gap-4", cols === 2 && "md:grid-cols-2", cols === 3 && "md:grid-cols-3")}>{children}</div>;
}

function Field({ label, name, hint, error, required, children, className }: { label: string; name: string; hint?: string; error?: string | null; required?: boolean; children: React.ReactNode; className?: string }) {
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
