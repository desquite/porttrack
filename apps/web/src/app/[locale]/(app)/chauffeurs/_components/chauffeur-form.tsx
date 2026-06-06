"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  CATEGORIES_PERMIS,
  CHAUFFEUR_STATUTS,
  SEXES,
  type Database,
} from "@porttrack/shared";
import {
  createChauffeurAction,
  updateChauffeurAction,
  type ChauffeurFormState,
} from "../actions";

type Chauffeur = Database["public"]["Tables"]["chauffeurs"]["Row"];

type Props = {
  mode: "create" | "update";
  isSuperAdmin: boolean;
  tenants: { id: string; nom_entreprise: string }[];
  defaultTenantId: string | null;
  /** Équipes disponibles pour le sélecteur (cahier v7 §7.2). */
  equipes?: { id: string; nom: string; code: string }[];
  /** Valeurs pré-remplies (mode update) — issues du chauffeur chargé en DB */
  defaultValues?: Partial<Chauffeur>;
  /** ID du chauffeur à updater — requis si mode === "update" */
  chauffeurId?: string;
};

const STATUT_LABEL: Record<(typeof CHAUFFEUR_STATUTS)[number], string> = {
  ACTIF: "Actif",
  EN_CONGE: "En congé",
  SUSPENDU: "Suspendu",
  INACTIF: "Inactif",
};

const initialState: ChauffeurFormState = { status: "idle" };

export function ChauffeurForm({
  mode,
  isSuperAdmin,
  tenants,
  defaultTenantId,
  equipes = [],
  defaultValues,
  chauffeurId,
}: Props) {
  // En update on bind l'id à l'action (plus propre qu'un hidden field tamperable)
  const boundAction =
    mode === "update" && chauffeurId
      ? updateChauffeurAction.bind(null, chauffeurId)
      : createChauffeurAction;

  const [state, formAction, pending] = useActionState(boundAction, initialState);

  // Helpers : récupère valeur ET erreurs d'un champ.
  // Priorité : (1) valeurs réinjectées après erreur ; (2) defaultValues (mode update) ; (3) "".
  const getValue = (name: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) {
      const v = state.values[name];
      return Array.isArray(v) ? v.join(",") : String(v ?? "");
    }
    if (defaultValues && name in defaultValues) {
      const v = (defaultValues as Record<string, unknown>)[name];
      if (v == null) return "";
      if (Array.isArray(v)) return v.join(",");
      return String(v);
    }
    return "";
  };

  const getArrayValue = (name: string): string[] => {
    if (state.status === "error" && Array.isArray(state.values?.[name])) {
      return state.values![name] as string[];
    }
    if (defaultValues && name in defaultValues) {
      const v = (defaultValues as Record<string, unknown>)[name];
      if (Array.isArray(v)) return v as string[];
    }
    return [];
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

  // En mode update on ne montre pas le sélecteur de tenant — le chauffeur reste
  // attaché à son tenant initial. Le tenant_id est envoyé en hidden depuis
  // defaultTenantId (qui en update vaut chauffeur.tenant_id, propagé par le parent).
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
          description="En tant que SUPER_ADMIN, tu dois sélectionner le tenant auquel rattacher ce chauffeur."
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

      {/* Identité */}
      <Section title="Identité">
        <Grid cols={2}>
          <Field label="Prénoms" name="prenoms" required error={getError("prenoms")}>
            <Input
              id="prenoms"
              name="prenoms"
              defaultValue={getValue("prenoms")}
              required
              autoComplete="given-name"
              className={fieldClass("prenoms")}
            />
          </Field>
          <Field label="Nom" name="nom" required error={getError("nom")}>
            <Input
              id="nom"
              name="nom"
              defaultValue={getValue("nom")}
              required
              autoComplete="family-name"
              className={fieldClass("nom")}
            />
          </Field>

          <Field label="Date de naissance" name="date_naissance" error={getError("date_naissance")}>
            <Input
              id="date_naissance"
              name="date_naissance"
              type="date"
              defaultValue={getValue("date_naissance")}
              className={fieldClass("date_naissance")}
            />
          </Field>
          <Field label="Sexe" name="sexe" error={getError("sexe")}>
            <select
              id="sexe"
              name="sexe"
              defaultValue={getValue("sexe")}
              className={selectClass("sexe")}
            >
              <option value="">—</option>
              {SEXES.map((s) => (
                <option key={s} value={s}>
                  {s === "M" ? "Masculin" : "Féminin"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Numéro CNI" name="numero_cni" error={getError("numero_cni")} hint="Unique par entreprise">
            <Input
              id="numero_cni"
              name="numero_cni"
              defaultValue={getValue("numero_cni")}
              placeholder="CI001234567"
              className={fieldClass("numero_cni")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Rattachement à une équipe — OBLIGATOIRE (chaque chauffeur doit appartenir
          à une équipe pour figurer dans le planning et les désignations matinales) */}
      <Section title="Rattachement à une équipe">
        {equipes.length === 0 ? (
          <Alert variant="destructive">
            <AlertTitle>Aucune équipe n'existe encore</AlertTitle>
            <AlertDescription>
              Pour créer un chauffeur, tu dois d'abord créer au moins une équipe.
              {" "}
              <Link href="/equipes/new" className="font-medium underline underline-offset-2">
                Créer une équipe →
              </Link>
            </AlertDescription>
          </Alert>
        ) : (
          <Field
            label="Équipe"
            name="equipe_id_defaut"
            required
            error={getError("equipe_id_defaut")}
            hint="Détermine la cellule par défaut du planning hebdomadaire"
          >
            <select
              id="equipe_id_defaut"
              name="equipe_id_defaut"
              defaultValue={getValue("equipe_id_defaut") || defaultValues?.equipe_id_defaut || ""}
              required
              className={selectClass("equipe_id_defaut")}
            >
              <option value="" disabled>— Sélectionner une équipe —</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>{e.code} — {e.nom}</option>
              ))}
            </select>
          </Field>
        )}
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <Grid cols={2}>
          <Field label="Téléphone principal" name="telephone" required error={getError("telephone")}>
            <Input
              id="telephone"
              name="telephone"
              type="tel"
              defaultValue={getValue("telephone")}
              required
              placeholder="+225 07 11 22 33 44"
              autoComplete="tel"
              className={fieldClass("telephone")}
            />
          </Field>
          <Field label="Téléphone secondaire" name="telephone_secondaire" error={getError("telephone_secondaire")}>
            <Input
              id="telephone_secondaire"
              name="telephone_secondaire"
              type="tel"
              defaultValue={getValue("telephone_secondaire")}
              placeholder="+225 05 22 33 44 55"
              className={fieldClass("telephone_secondaire")}
            />
          </Field>

          <Field label="Email" name="email" error={getError("email")}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={getValue("email")}
              placeholder="prenom.nom@example.ci"
              autoComplete="email"
              className={fieldClass("email")}
            />
          </Field>

          <Field label="Adresse" name="adresse" error={getError("adresse")} className="md:col-span-2">
            <Input
              id="adresse"
              name="adresse"
              defaultValue={getValue("adresse")}
              placeholder="Quartier, ville"
              autoComplete="street-address"
              className={fieldClass("adresse")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Permis */}
      <Section
        title="Permis de conduire"
        description="Les dates ci-dessous alimentent automatiquement les alertes du tableau de bord."
      >
        <Grid cols={2}>
          <Field label="Numéro de permis" name="numero_permis" error={getError("numero_permis")} hint="Unique par entreprise">
            <Input
              id="numero_permis"
              name="numero_permis"
              defaultValue={getValue("numero_permis")}
              placeholder="ABJ-2018-002345"
              className={fieldClass("numero_permis")}
            />
          </Field>

          <Field label="Catégories" name="categories_permis" error={getError("categories_permis")} hint="Coche toutes les catégories valides">
            <div className="flex flex-wrap gap-3 pt-1.5">
              {CATEGORIES_PERMIS.map((cat) => {
                const selected = getArrayValue("categories_permis");
                const isChecked = selected.includes(cat);
                return (
                  <label
                    key={cat}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-sm hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary"
                  >
                    <input
                      type="checkbox"
                      name="categories_permis"
                      value={cat}
                      defaultChecked={isChecked}
                      className="sr-only"
                    />
                    {cat}
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Date d'obtention" name="permis_obtention" error={getError("permis_obtention")}>
            <Input
              id="permis_obtention"
              name="permis_obtention"
              type="date"
              defaultValue={getValue("permis_obtention")}
              className={fieldClass("permis_obtention")}
            />
          </Field>
          <Field label="Date d'expiration" name="permis_expiration" error={getError("permis_expiration")}>
            <Input
              id="permis_expiration"
              name="permis_expiration"
              type="date"
              defaultValue={getValue("permis_expiration")}
              className={fieldClass("permis_expiration")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Visite médicale */}
      <Section title="Visite médicale">
        <Grid cols={2}>
          <Field
            label="Date d'expiration"
            name="visite_medicale_expiration"
            error={getError("visite_medicale_expiration")}
            hint="Renouvellement annuel obligatoire pour les conducteurs PL en CI"
          >
            <Input
              id="visite_medicale_expiration"
              name="visite_medicale_expiration"
              type="date"
              defaultValue={getValue("visite_medicale_expiration")}
              className={fieldClass("visite_medicale_expiration")}
            />
          </Field>
        </Grid>
      </Section>

      {/* CNPS + Emploi */}
      <Section title="Sécurité sociale & emploi">
        <Grid cols={2}>
          <Field label="Numéro CNPS" name="numero_cnps" error={getError("numero_cnps")} hint="Caisse Nationale de Prévoyance Sociale">
            <Input
              id="numero_cnps"
              name="numero_cnps"
              defaultValue={getValue("numero_cnps")}
              placeholder="CNPS-789456123"
              className={fieldClass("numero_cnps")}
            />
          </Field>

          <Field label="Date d'embauche" name="date_embauche" error={getError("date_embauche")}>
            <Input
              id="date_embauche"
              name="date_embauche"
              type="date"
              defaultValue={getValue("date_embauche")}
              className={fieldClass("date_embauche")}
            />
          </Field>

          <Field label="Statut" name="statut" required error={getError("statut")}>
            <select
              id="statut"
              name="statut"
              defaultValue={getValue("statut") || "ACTIF"}
              required
              className={selectClass("statut")}
            >
              {CHAUFFEUR_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <Field label="Notes libres" name="notes" error={getError("notes")} hint="Visible par les utilisateurs ayant accès au chauffeur">
          <textarea
            id="notes"
            name="notes"
            defaultValue={getValue("notes")}
            rows={3}
            className={cn(
              "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              getError("notes") && "border-rose-500",
            )}
            placeholder="Informations diverses, restrictions médicales, langues parlées…"
          />
        </Field>
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
              {mode === "update" ? "Enregistrer les modifications" : "Enregistrer le chauffeur"}
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
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="rounded-md border bg-muted/20 p-4">{children}</div>
    </div>
  );
}

function Grid({
  cols = 2,
  children,
}: {
  cols?: 1 | 2 | 3;
  children: React.ReactNode;
}) {
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
      {hint && !error && (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
