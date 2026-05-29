"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  MATERIEL_ETATS,
  MATERIEL_TYPES,
  type Database,
} from "@porttrack/shared";
import {
  createMaterielAction,
  updateMaterielAction,
  type MaterielFormState,
} from "../actions";

type Materiel = Database["public"]["Tables"]["materiel_roulant"]["Row"];

type Props = {
  mode: "create" | "update";
  isSuperAdmin: boolean;
  tenants: { id: string; nom_entreprise: string }[];
  defaultTenantId: string | null;
  /** Valeurs pré-remplies en mode update (issues du véhicule chargé en DB) */
  defaultValues?: Partial<Materiel>;
  /** ID du véhicule à updater — requis si mode === "update" */
  materielId?: string;
};

const TYPE_LABEL: Record<(typeof MATERIEL_TYPES)[number], string> = {
  TRACTEUR:              "Tracteur routier",
  REMORQUE:              "Remorque",
  SEMI_REMORQUE:         "Semi-remorque",
  PORTE_CONTENEUR_20:    "Porte-conteneur 20'",
  PORTE_CONTENEUR_40:    "Porte-conteneur 40'",
  PORTE_CONTENEUR_MIXTE: "Porte-conteneur mixte (20'/40')",
};

const ETAT_LABEL: Record<(typeof MATERIEL_ETATS)[number], string> = {
  EN_SERVICE:    "En service",
  EN_PANNE:      "En panne",
  INDISPONIBLE:  "Indisponible (accident)",
  EN_REPARATION: "En réparation",
  HORS_SERVICE:  "Hors service",
  VENDU:         "Vendu",
};

const initialState: MaterielFormState = { status: "idle" };

export function MaterielForm({
  mode,
  isSuperAdmin,
  tenants,
  defaultTenantId,
  defaultValues,
  materielId,
}: Props) {
  // En update on bind l'id à l'action (plus propre qu'un hidden field tamperable)
  const boundAction =
    mode === "update" && materielId
      ? updateMaterielAction.bind(null, materielId)
      : createMaterielAction;

  const [state, formAction, pending] = useActionState(boundAction, initialState);

  // Priorité : (1) state.values après erreur ; (2) defaultValues mode update ; (3) ""
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
    return state.fieldErrors?.[name as keyof typeof state.fieldErrors]?.[0] ?? null;
  };
  const fieldClass = (name: string) =>
    cn(getError(name) && "border-rose-500 focus-visible:ring-rose-500");
  const selectClass = (name: string) =>
    cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      getError(name) && "border-rose-500 focus-visible:ring-rose-500",
    );

  // En mode update on masque le sélecteur de tenant — le véhicule reste attaché
  // à son tenant initial. Le tenant_id va en hidden depuis defaultTenantId.
  const showTenantSelector = mode === "create" && isSuperAdmin;

  return (
    <form action={formAction} className="space-y-8">
      {/* Erreur globale */}
      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d'enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {/* Tenant — uniquement en création par SUPER_ADMIN */}
      {showTenantSelector ? (
        <Section
          title="Affectation à une entreprise"
          description="En tant que SUPER_ADMIN, tu dois sélectionner le tenant auquel rattacher ce véhicule."
        >
          <Field label="Entreprise" name="tenant_id" required error={getError("tenant_id")}>
            <select
              id="tenant_id"
              name="tenant_id"
              defaultValue={getValue("tenant_id") || defaultTenantId || ""}
              required
              className={selectClass("tenant_id")}
            >
              <option value="">— Sélectionner une entreprise —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nom_entreprise}
                </option>
              ))}
            </select>
          </Field>
        </Section>
      ) : (
        <input type="hidden" name="tenant_id" value={defaultTenantId ?? ""} />
      )}

      {/* Identification */}
      <Section title="Identification du véhicule">
        <Grid cols={2}>
          <Field label="Type" name="type" required error={getError("type")}>
            <select
              id="type"
              name="type"
              defaultValue={getValue("type")}
              required
              className={selectClass("type")}
            >
              <option value="">— Sélectionner un type —</option>
              {MATERIEL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Immatriculation"
            name="immatriculation"
            required
            error={getError("immatriculation")}
            hint="Unique par entreprise"
          >
            <Input
              id="immatriculation"
              name="immatriculation"
              defaultValue={getValue("immatriculation")}
              required
              placeholder="2654 BD 01"
              className={cn("font-mono", fieldClass("immatriculation"))}
            />
          </Field>

          <Field label="Marque" name="marque" error={getError("marque")}>
            <Input
              id="marque"
              name="marque"
              defaultValue={getValue("marque")}
              placeholder="Renault Trucks, DAF, Scania…"
              className={fieldClass("marque")}
            />
          </Field>

          <Field label="Modèle" name="modele" error={getError("modele")}>
            <Input
              id="modele"
              name="modele"
              defaultValue={getValue("modele")}
              placeholder="T 380, XF 480…"
              className={fieldClass("modele")}
            />
          </Field>

          <Field label="Année" name="annee" error={getError("annee")}>
            <Input
              id="annee"
              name="annee"
              type="number"
              min="1990"
              max={new Date().getFullYear() + 1}
              step="1"
              defaultValue={getValue("annee")}
              placeholder="2019"
              className={fieldClass("annee")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Caractéristiques */}
      <Section title="Caractéristiques techniques">
        <Grid cols={2}>
          <Field label="Capacité (tonnes)" name="capacite_tonnes" error={getError("capacite_tonnes")}>
            <Input
              id="capacite_tonnes"
              name="capacite_tonnes"
              type="number"
              min="0"
              step="0.1"
              defaultValue={getValue("capacite_tonnes")}
              placeholder="19.0"
              className={fieldClass("capacite_tonnes")}
            />
          </Field>
          <Field label="Kilométrage actuel (km)" name="kilometrage_actuel" error={getError("kilometrage_actuel")}>
            <Input
              id="kilometrage_actuel"
              name="kilometrage_actuel"
              type="number"
              min="0"
              step="1"
              defaultValue={getValue("kilometrage_actuel")}
              placeholder="287450"
              className={fieldClass("kilometrage_actuel")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Documents (5 dates) */}
      <Section
        title="Documents légaux"
        description="Les dates renseignées ici alimenteront automatiquement les alertes du dashboard."
      >
        <Grid cols={3}>
          <Field label="Fin d'assurance" name="assurance_fin" error={getError("assurance_fin")}>
            <Input
              id="assurance_fin"
              name="assurance_fin"
              type="date"
              defaultValue={getValue("assurance_fin")}
              className={fieldClass("assurance_fin")}
            />
          </Field>
          <Field label="Fin de visite technique" name="visite_technique_fin" error={getError("visite_technique_fin")}>
            <Input
              id="visite_technique_fin"
              name="visite_technique_fin"
              type="date"
              defaultValue={getValue("visite_technique_fin")}
              className={fieldClass("visite_technique_fin")}
            />
          </Field>
          <Field label="Fin Carte de transport" name="carte_transport_fin" error={getError("carte_transport_fin")}>
            <Input
              id="carte_transport_fin"
              name="carte_transport_fin"
              type="date"
              defaultValue={getValue("carte_transport_fin")}
              className={fieldClass("carte_transport_fin")}
            />
          </Field>
          <Field label="Fin Carte de stationnement" name="carte_stationnement_fin" error={getError("carte_stationnement_fin")}>
            <Input
              id="carte_stationnement_fin"
              name="carte_stationnement_fin"
              type="date"
              defaultValue={getValue("carte_stationnement_fin")}
              className={fieldClass("carte_stationnement_fin")}
            />
          </Field>
          <Field
            label="Fin de patente (semi-remorque)"
            name="patente_fin"
            error={getError("patente_fin")}
            className="md:col-span-2"
          >
            <Input
              id="patente_fin"
              name="patente_fin"
              type="date"
              defaultValue={getValue("patente_fin")}
              className={fieldClass("patente_fin")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Acquisition */}
      <Section title="Acquisition">
        <Grid cols={2}>
          <Field label="Date d'acquisition" name="date_acquisition" error={getError("date_acquisition")}>
            <Input
              id="date_acquisition"
              name="date_acquisition"
              type="date"
              defaultValue={getValue("date_acquisition")}
              className={fieldClass("date_acquisition")}
            />
          </Field>
          <Field label="Prix d'acquisition (FCFA)" name="prix_acquisition_fcfa" error={getError("prix_acquisition_fcfa")}>
            <Input
              id="prix_acquisition_fcfa"
              name="prix_acquisition_fcfa"
              type="number"
              min="0"
              step="1000"
              defaultValue={getValue("prix_acquisition_fcfa")}
              placeholder="45000000"
              className={fieldClass("prix_acquisition_fcfa")}
            />
          </Field>
        </Grid>
      </Section>

      {/* État + notes */}
      <Section title="État opérationnel & notes">
        <Grid cols={2}>
          <Field label="État" name="etat" required error={getError("etat")}>
            <select
              id="etat"
              name="etat"
              defaultValue={getValue("etat") || "EN_SERVICE"}
              required
              className={selectClass("etat")}
            >
              {MATERIEL_ETATS.map((e) => (
                <option key={e} value={e}>
                  {ETAT_LABEL[e]}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Notes libres"
            name="notes"
            error={getError("notes")}
            className="md:col-span-2"
          >
            <textarea
              id="notes"
              name="notes"
              defaultValue={getValue("notes")}
              rows={3}
              placeholder="Restrictions d'usage, options spécifiques, historique…"
              className={cn(
                "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                getError("notes") && "border-rose-500",
              )}
            />
          </Field>
        </Grid>
      </Section>

      {/* Submit */}
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
              {mode === "update" ? "Enregistrer les modifications" : "Enregistrer le véhicule"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Composants présentationnels
// =============================================================================

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
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
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 && "md:grid-cols-2",
        cols === 3 && "md:grid-cols-3",
      )}
    >
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
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
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
