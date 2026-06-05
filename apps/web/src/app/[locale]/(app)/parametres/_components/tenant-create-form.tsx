"use client";

import { useActionState } from "react";
import { Loader2, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { PLANS_ABONNEMENT, TENANT_STATUTS } from "@porttrack/shared";
import { createTenantAction, type TenantCreateState } from "../actions";

const PLAN_LABEL: Record<(typeof PLANS_ABONNEMENT)[number], string> = {
  STARTER:  "Starter — 35 000 FCFA/mois (1-5 camions)",
  BUSINESS: "Business — 60 000 FCFA/mois (6-20 camions)",
  PREMIUM:  "Premium — 100 000 FCFA/mois (20+ camions)",
};

const STATUT_LABEL: Record<(typeof TENANT_STATUTS)[number], string> = {
  TRIAL:     "Période d'essai",
  ACTIVE:    "Actif (payant)",
  SUSPENDED: "Suspendu",
  CANCELLED: "Résilié",
};

const initialState: TenantCreateState = { status: "idle" };

export function TenantCreateForm() {
  const [state, formAction, pending] = useActionState(createTenantAction, initialState);

  const getError = (name: string): string | null => {
    if (state.status !== "error") return null;
    return state.fieldErrors?.[name as keyof typeof state.fieldErrors]?.[0] ?? null;
  };
  const getValue = (name: string): string => {
    if (state.status === "error") return state.values?.[name] ?? "";
    return "";
  };
  const fieldClass = (name: string) =>
    cn(getError(name) && "border-rose-500 focus-visible:ring-rose-500");
  const selectClass = (name: string) =>
    cn(
      "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm",
      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
      getError(name) && "border-rose-500",
    );

  return (
    <form action={formAction} className="space-y-8">
      {state.status === "error" && state.formError && (
        <Alert variant="destructive">
          <AlertTitle>Impossible de créer l'entreprise</AlertTitle>
          <AlertDescription>{state.formError}</AlertDescription>
        </Alert>
      )}

      {/* Identité */}
      <Section title="Identité de l'entreprise">
        <Grid cols={2}>
          <Field label="Nom de l'entreprise" name="nom_entreprise" required error={getError("nom_entreprise")} className="md:col-span-2">
            <Input id="nom_entreprise" name="nom_entreprise" defaultValue={getValue("nom_entreprise")} required placeholder="TRANSPORTS SAHEL CI" className={fieldClass("nom_entreprise")} />
          </Field>
          <Field label="RCCM" name="rccm" error={getError("rccm")} hint="Registre du Commerce">
            <Input id="rccm" name="rccm" defaultValue={getValue("rccm")} placeholder="CI-ABJ-2026-B-12345" className={fieldClass("rccm")} />
          </Field>
        </Grid>
      </Section>

      {/* Contact */}
      <Section title="Contact">
        <Grid cols={2}>
          <Field label="Email du contact principal" name="email_manager" required error={getError("email_manager")}>
            <Input id="email_manager" name="email_manager" type="email" defaultValue={getValue("email_manager")} required placeholder="contact@entreprise.ci" className={fieldClass("email_manager")} />
          </Field>
          <Field label="Téléphone" name="telephone" error={getError("telephone")}>
            <Input id="telephone" name="telephone" type="tel" defaultValue={getValue("telephone")} placeholder="+225 27 21 24 56 78" className={fieldClass("telephone")} />
          </Field>
          <Field label="Adresse" name="adresse" error={getError("adresse")} className="md:col-span-2">
            <Input id="adresse" name="adresse" defaultValue={getValue("adresse")} placeholder="Zone industrielle de Vridi, Abidjan" className={fieldClass("adresse")} />
          </Field>
        </Grid>
      </Section>

      {/* Abonnement */}
      <Section title="Abonnement">
        <Grid cols={2}>
          <Field label="Plan" name="plan" required error={getError("plan")}>
            <select id="plan" name="plan" defaultValue={getValue("plan") || "STARTER"} required className={selectClass("plan")}>
              {PLANS_ABONNEMENT.map((p) => (
                <option key={p} value={p}>{PLAN_LABEL[p]}</option>
              ))}
            </select>
          </Field>
          <Field label="Statut" name="statut" required error={getError("statut")}>
            <select id="statut" name="statut" defaultValue={getValue("statut") || "TRIAL"} required className={selectClass("statut")}>
              {TENANT_STATUTS.map((s) => (
                <option key={s} value={s}>{STATUT_LABEL[s]}</option>
              ))}
            </select>
          </Field>
        </Grid>
      </Section>

      {/* Premier manager (optionnel) */}
      <Section
        title="Premier manager (optionnel)"
        description="Invite tout de suite le manager de l'entreprise. Son compte sera créé avec le rôle MANAGER et il pourra se connecter via la page de login. Tu pourras aussi l'inviter plus tard."
      >
        <Field label="Email du manager" name="manager_email" error={getError("manager_email")}>
          <Input id="manager_email" name="manager_email" type="email" defaultValue={getValue("manager_email")} placeholder="manager@entreprise.ci" className={fieldClass("manager_email")} />
        </Field>
      </Section>

      <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Création…
            </>
          ) : (
            <>
              <Building2 className="mr-2 size-4" />
              Créer l'entreprise
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

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

function Grid({ cols = 2, children }: { cols?: 1 | 2; children: React.ReactNode }) {
  return <div className={cn("grid gap-4", cols === 2 && "md:grid-cols-2")}>{children}</div>;
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
