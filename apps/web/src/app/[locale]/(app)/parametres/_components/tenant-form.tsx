"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  PLANS_ABONNEMENT,
  TENANT_STATUTS,
  type Database,
} from "@porttrack/shared";
import { updateTenantAction, type TenantFormState } from "../actions";

type Tenant = Database["public"]["Tables"]["tenants"]["Row"];

type Props = {
  tenant: Tenant;
  isSuperAdmin: boolean;
  /** Le caller peut-il éditer (SUPER_ADMIN / MANAGER) ? Sinon lecture seule. */
  canEdit?: boolean;
};

const PLAN_LABEL: Record<(typeof PLANS_ABONNEMENT)[number], string> = {
  STARTER:  "Starter — 25 000 FCFA/mois (1-5 camions)",
  BUSINESS: "Business — 55 000 FCFA/mois (6-20 camions)",
  PREMIUM:  "Premium — 120 000 FCFA/mois (20+ camions)",
};

const STATUT_LABEL: Record<(typeof TENANT_STATUTS)[number], string> = {
  TRIAL:     "Période d'essai (TRIAL)",
  ACTIVE:    "Actif (abonnement payant)",
  SUSPENDED: "Suspendu (impayé / manquement)",
  CANCELLED: "Résilié",
};

const initialState: TenantFormState = { status: "idle" };

export function TenantForm({ tenant, isSuperAdmin, canEdit = true }: Props) {
  const boundAction = updateTenantAction.bind(null, tenant.id);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const getValue = (name: string, fallback: string | null = null): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) {
      return state.values[name] ?? "";
    }
    if (fallback != null) return fallback;
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

  return (
    <form action={formAction} className="space-y-8">
      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible d'enregistrer</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      <fieldset disabled={!canEdit} className="m-0 min-w-0 space-y-8 border-0 p-0 disabled:opacity-70">
      {/* Identité */}
      <Section title="Identité de l'entreprise">
        <Grid cols={2}>
          <Field label="Nom de l'entreprise" name="nom_entreprise" required error={getError("nom_entreprise")}>
            <Input
              id="nom_entreprise"
              name="nom_entreprise"
              defaultValue={getValue("nom_entreprise", tenant.nom_entreprise)}
              required
              className={fieldClass("nom_entreprise")}
            />
          </Field>

          <Field
            label="RCCM"
            name="rccm"
            error={getError("rccm")}
            hint="Registre du Commerce et du Crédit Mobilier"
          >
            <Input
              id="rccm"
              name="rccm"
              defaultValue={getValue("rccm", tenant.rccm)}
              placeholder="CI-ABJ-2020-B-12345"
              className={fieldClass("rccm")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <Grid cols={2}>
          <Field
            label="Email du manager principal"
            name="email_manager"
            required
            error={getError("email_manager")}
            hint="Email de contact principal — utilisé pour les notifications"
          >
            <Input
              id="email_manager"
              name="email_manager"
              type="email"
              defaultValue={getValue("email_manager", tenant.email_manager)}
              required
              className={fieldClass("email_manager")}
            />
          </Field>

          <Field label="Téléphone" name="telephone" error={getError("telephone")}>
            <Input
              id="telephone"
              name="telephone"
              type="tel"
              defaultValue={getValue("telephone", tenant.telephone)}
              placeholder="+225 27 21 24 56 78"
              className={fieldClass("telephone")}
            />
          </Field>

          <Field label="Adresse" name="adresse" error={getError("adresse")} className="md:col-span-2">
            <Input
              id="adresse"
              name="adresse"
              defaultValue={getValue("adresse", tenant.adresse)}
              placeholder="Zone industrielle de Vridi, Abidjan"
              className={fieldClass("adresse")}
            />
          </Field>
        </Grid>
      </Section>

      {/* Section admin — SUPER_ADMIN uniquement */}
      {isSuperAdmin ? (
        <Section
          title="Abonnement & statut (SUPER_ADMIN)"
          description="Réservé à l'équipe PORTTRACK. Non visible des managers d'entreprise."
        >
          <Grid cols={3}>
            <Field label="Plan d'abonnement" name="plan" error={getError("plan")}>
              <select
                id="plan"
                name="plan"
                defaultValue={getValue("plan", tenant.plan)}
                className={selectClass("plan")}
              >
                {PLANS_ABONNEMENT.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Statut" name="statut" error={getError("statut")}>
              <select
                id="statut"
                name="statut"
                defaultValue={getValue("statut", tenant.statut)}
                className={selectClass("statut")}
              >
                {TENANT_STATUTS.map((s) => (
                  <option key={s} value={s}>
                    {STATUT_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Fin de période d'essai" name="date_fin_essai" error={getError("date_fin_essai")}>
              <Input
                id="date_fin_essai"
                name="date_fin_essai"
                type="date"
                defaultValue={getValue(
                  "date_fin_essai",
                  tenant.date_fin_essai ? tenant.date_fin_essai.slice(0, 10) : null,
                )}
                className={fieldClass("date_fin_essai")}
              />
            </Field>
          </Grid>
        </Section>
      ) : (
        <Section
          title="Abonnement"
          description="Pour modifier ton plan d'abonnement, contacte l'équipe PORTTRACK."
        >
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <ReadOnlyField label="Plan actuel" value={PLAN_LABEL[tenant.plan]} />
            <ReadOnlyField label="Statut" value={STATUT_LABEL[tenant.statut]} />
            <ReadOnlyField
              label="Fin d'essai"
              value={
                tenant.date_fin_essai
                  ? new Date(tenant.date_fin_essai).toLocaleDateString("fr-FR")
                  : "—"
              }
            />
          </div>
        </Section>
      )}

      </fieldset>

      {/* Submit — réservé aux administrateurs */}
      {canEdit ? (
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
                Enregistrer les modifications
              </>
            )}
          </Button>
        </div>
      ) : (
        <p className="border-t pt-6 text-xs text-muted-foreground">
          Lecture seule — seul le manager de l&apos;entreprise peut modifier ces informations.
        </p>
      )}
    </form>
  );
}

// =============================================================================
// Composants présentationnels (alignés avec ChauffeurForm / MaterielForm)
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
