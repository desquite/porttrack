"use client";

import { useActionState } from "react";
import { Loader2, Save, Gavel } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  INFRACTION_STATUTS,
  INFRACTION_IMPUTATIONS,
  type Database,
} from "@porttrack/shared";
import {
  createInfractionAction,
  updateInfractionAction,
  type InfractionFormState,
} from "../actions";

type Infraction = Database["public"]["Tables"]["infractions"]["Row"];

export type InfractionRefOption = { id: string; label: string };

const STATUT_LABEL: Record<(typeof INFRACTION_STATUTS)[number], string> = {
  NON_PAYEE: "Non payée",
  PAYEE:     "Payée",
  CONTESTEE: "Contestée",
};
const IMPUTATION_LABEL: Record<(typeof INFRACTION_IMPUTATIONS)[number], string> = {
  ENTREPRISE: "À la charge de l'entreprise",
  CHAUFFEUR:  "À la charge du chauffeur",
};

type Props = {
  mode: "create" | "update";
  infractionId?: string;
  defaultValues?: Partial<Infraction>;
  tenantId: string;
  materiels: InfractionRefOption[];
  chauffeurs: InfractionRefOption[];
};

const initialState: InfractionFormState = { status: "idle" };

export function InfractionForm({ mode, infractionId, defaultValues, tenantId, materiels, chauffeurs }: Props) {
  const boundAction =
    mode === "update" && infractionId
      ? updateInfractionAction.bind(null, infractionId)
      : createInfractionAction;
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

  const defaultStatut = (defaultValues?.statut as string | undefined) ?? "NON_PAYEE";
  const defaultImputation = (defaultValues?.imputation as string | undefined) ?? "ENTREPRISE";
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="tenant_id" value={tenantId} />

      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <Gavel className="size-4" />
          <AlertTitle>Impossible d&apos;enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <Section title="Infraction">
        <Grid cols={2}>
          <Field label="Chauffeur concerné" name="chauffeur_id" required error={getError("chauffeur_id")}>
            <select id="chauffeur_id" name="chauffeur_id" required
              defaultValue={getValue("chauffeur_id") || defaultValues?.chauffeur_id || ""}
              className={selectClass("chauffeur_id")}>
              <option value="">— Sélectionner —</option>
              {chauffeurs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Matériel concerné" name="materiel_roulant_id" error={getError("materiel_roulant_id")}>
            <select id="materiel_roulant_id" name="materiel_roulant_id"
              defaultValue={getValue("materiel_roulant_id") || defaultValues?.materiel_roulant_id || ""}
              className={selectClass("materiel_roulant_id")}>
              <option value="">— Non renseigné —</option>
              {materiels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          <Field label="Date de l'infraction" name="date_infraction" required error={getError("date_infraction")}>
            <Input id="date_infraction" name="date_infraction" type="date" required
              defaultValue={getValue("date_infraction") || todayISO} className={fieldClass("date_infraction")} />
          </Field>
          <Field label="Lieu" name="lieu_infraction" error={getError("lieu_infraction")}>
            <Input id="lieu_infraction" name="lieu_infraction"
              placeholder="Ex. Bd VGE, Yopougon"
              defaultValue={getValue("lieu_infraction")} className={fieldClass("lieu_infraction")} />
          </Field>
          <Field label="Type d'infraction" name="type_infraction" required error={getError("type_infraction")} hint="Excès de vitesse, stationnement, défaut document…">
            <Input id="type_infraction" name="type_infraction" required
              defaultValue={getValue("type_infraction")} className={fieldClass("type_infraction")} />
          </Field>
          <Field label="Montant amende (FCFA)" name="montant_fcfa" required error={getError("montant_fcfa")}>
            <Input id="montant_fcfa" name="montant_fcfa" type="number" min="0" step="1000" required
              defaultValue={getValue("montant_fcfa")} className={fieldClass("montant_fcfa")} />
          </Field>
          <Field label="Description" name="description" error={getError("description")} className="md:col-span-2">
            <textarea id="description" name="description" rows={2}
              defaultValue={getValue("description") || (defaultValues?.description as string | undefined) || ""}
              placeholder="Détails complémentaires (optionnel)"
              className={cn(
                "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                getError("description") && "border-rose-500",
              )} />
          </Field>
        </Grid>
      </Section>

      <Section title="Paiement & imputation">
        <Grid cols={3}>
          <Field label="Date limite paiement" name="date_limite_paiement" error={getError("date_limite_paiement")}>
            <Input id="date_limite_paiement" name="date_limite_paiement" type="date"
              defaultValue={getValue("date_limite_paiement")} className={fieldClass("date_limite_paiement")} />
          </Field>
          <Field label="Date de paiement" name="date_paiement" error={getError("date_paiement")}>
            <Input id="date_paiement" name="date_paiement" type="date"
              defaultValue={getValue("date_paiement")} className={fieldClass("date_paiement")} />
          </Field>
          <Field label="Statut" name="statut" error={getError("statut")}>
            <select id="statut" name="statut" defaultValue={getValue("statut") || defaultStatut} className={selectClass("statut")}>
              {INFRACTION_STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field label="Imputation" name="imputation" error={getError("imputation")} className="md:col-span-3">
            <select id="imputation" name="imputation"
              defaultValue={getValue("imputation") || defaultImputation} className={selectClass("imputation")}>
              {INFRACTION_IMPUTATIONS.map((i) => <option key={i} value={i}>{IMPUTATION_LABEL[i]}</option>)}
            </select>
          </Field>
        </Grid>
      </Section>

      <Section title="Notes">
        <textarea id="notes" name="notes" rows={3}
          defaultValue={getValue("notes") || (defaultValues?.notes as string | undefined) || ""}
          placeholder="(optionnel)"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring" />
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="mr-2 size-4 animate-spin" />Enregistrement…</> :
            <><Save className="mr-2 size-4" />{mode === "create" ? "Enregistrer l'infraction" : "Enregistrer"}</>}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <div className="rounded-md border bg-muted/20 p-4">{children}</div>
    </div>
  );
}
function Grid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: React.ReactNode }) {
  return <div className={cn("grid gap-4", cols === 2 && "md:grid-cols-2", cols === 3 && "md:grid-cols-3")}>{children}</div>;
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
