"use client";

import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { ACONIERS, CONTENEUR_STATUTS, type Database } from "@porttrack/shared";
import {
  createConteneurAction,
  updateConteneurAction,
  type ConteneurFormState,
} from "../actions";

type Conteneur = Database["public"]["Tables"]["conteneurs"]["Row"];

// Options des dropdowns chargées côté serveur
export type RefOption = { id: string; label: string };

type Props = {
  mode: "create" | "update";
  isSuperAdmin: boolean;
  tenants: { id: string; nom_entreprise: string }[];
  defaultTenantId: string | null;
  defaultValues?: Partial<Conteneur>;
  conteneurId?: string;
  // Catalogues
  shippingLines: RefOption[];
  typesConteneur: RefOption[];
  ports: RefOption[];
};

const STATUT_LABEL: Record<(typeof CONTENEUR_STATUTS)[number], string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  LIVRE: "Livré",
  ANNULE: "Annulé",
};

const initialState: ConteneurFormState = { status: "idle" };

export function ConteneurForm({
  mode,
  isSuperAdmin,
  tenants,
  defaultTenantId,
  defaultValues,
  conteneurId,
  shippingLines,
  typesConteneur,
  ports,
}: Props) {
  const boundAction =
    mode === "update" && conteneurId
      ? updateConteneurAction.bind(null, conteneurId)
      : createConteneurAction;

  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const getValue = (name: string): string => {
    if (state.status === "error" && state.values?.[name] !== undefined) {
      return state.values[name] ?? "";
    }
    if (defaultValues && name in defaultValues) {
      const v = (defaultValues as Record<string, unknown>)[name];
      if (v == null) return "";
      // date_badt est un timestamptz : on tronque à YYYY-MM-DDTHH:mm pour datetime-local
      if (name === "date_badt" && typeof v === "string") {
        return v.slice(0, 16);
      }
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
            <select
              id="tenant_id"
              name="tenant_id"
              defaultValue={getValue("tenant_id") || defaultTenantId || ""}
              required
              className={selectClass("tenant_id")}
            >
              <option value="">— Sélectionner —</option>
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
      <Section title="Identification">
        <Grid cols={3}>
          <Field label="Numéro de conteneur" name="numero" required error={getError("numero")} hint="Format ISO 6346 (ex. MSCU1234567)">
            <Input
              id="numero"
              name="numero"
              defaultValue={getValue("numero")}
              required
              placeholder="MSCU1234567"
              className={cn("font-mono uppercase", fieldClass("numero"))}
            />
          </Field>

          <Field label="Type de conteneur" name="type_conteneur_id" error={getError("type_conteneur_id")}>
            <select
              id="type_conteneur_id"
              name="type_conteneur_id"
              defaultValue={getValue("type_conteneur_id")}
              className={selectClass("type_conteneur_id")}
            >
              <option value="">— Non précisé —</option>
              {typesConteneur.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Compagnie maritime" name="shipping_line_id" error={getError("shipping_line_id")}>
            <select
              id="shipping_line_id"
              name="shipping_line_id"
              defaultValue={getValue("shipping_line_id")}
              className={selectClass("shipping_line_id")}
            >
              <option value="">— Non précisée —</option>
              {shippingLines.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        </Grid>
      </Section>

      {/* Documents douaniers */}
      <Section title="Documents douaniers & commerciaux">
        <Grid cols={3}>
          <Field label="Numéro BL" name="numero_bl" error={getError("numero_bl")} hint="Bill of Lading">
            <Input id="numero_bl" name="numero_bl" defaultValue={getValue("numero_bl")} className={fieldClass("numero_bl")} />
          </Field>
          <Field label="N° déclaration douane" name="num_declaration" error={getError("num_declaration")}>
            <Input id="num_declaration" name="num_declaration" defaultValue={getValue("num_declaration")} className={fieldClass("num_declaration")} />
          </Field>
          <Field label="Circuit / type visite" name="type_visite" error={getError("type_visite")} hint="vert, jaune, rouge…">
            <Input id="type_visite" name="type_visite" defaultValue={getValue("type_visite")} className={fieldClass("type_visite")} />
          </Field>
        </Grid>
      </Section>

      {/* Acteurs */}
      <Section title="Acteurs">
        <Grid cols={3}>
          <Field label="Aconier (manutention)" name="aconier" required error={getError("aconier")} hint="Société de manutention (≠ compagnie maritime)">
            <Input
              id="aconier"
              name="aconier"
              list="aconier-suggestions"
              defaultValue={getValue("aconier")}
              required
              placeholder="MEDLOG TRANSPORT"
              className={fieldClass("aconier")}
            />
            <datalist id="aconier-suggestions">
              {ACONIERS.filter((a) => a !== "AUTRE").map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </Field>
          <Field label="Client (importateur/exportateur)" name="client" error={getError("client")}>
            <Input id="client" name="client" defaultValue={getValue("client")} className={fieldClass("client")} />
          </Field>
          <Field label="Transitaire" name="transitaire" error={getError("transitaire")}>
            <Input id="transitaire" name="transitaire" defaultValue={getValue("transitaire")} className={fieldClass("transitaire")} />
          </Field>
        </Grid>
      </Section>

      {/* Logistique */}
      <Section title="Logistique">
        <Grid cols={2}>
          <Field label="Port d'origine" name="origine_id" error={getError("origine_id")}>
            <select id="origine_id" name="origine_id" defaultValue={getValue("origine_id")} className={selectClass("origine_id")}>
              <option value="">— Non précisé —</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Destination" name="destination_id" error={getError("destination_id")}>
            <select id="destination_id" name="destination_id" defaultValue={getValue("destination_id")} className={selectClass("destination_id")}>
              <option value="">— Non précisée —</option>
              {ports.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Destination libre" name="destination_libre" error={getError("destination_libre")} hint="Si la destination n'est pas dans la liste" className="md:col-span-2">
            <Input id="destination_libre" name="destination_libre" defaultValue={getValue("destination_libre")} placeholder="Adresse / lieu précis de livraison" className={fieldClass("destination_libre")} />
          </Field>

          <Field label="Marchandise" name="marchandise" error={getError("marchandise")}>
            <Input id="marchandise" name="marchandise" defaultValue={getValue("marchandise")} className={fieldClass("marchandise")} />
          </Field>
          <Field label="Poids (kg)" name="poids_kg" error={getError("poids_kg")}>
            <Input id="poids_kg" name="poids_kg" type="number" min="0" step="0.01" defaultValue={getValue("poids_kg")} className={fieldClass("poids_kg")} />
          </Field>

          <Field label="Numéro de plomb" name="plomb" error={getError("plomb")}>
            <Input id="plomb" name="plomb" defaultValue={getValue("plomb")} className={fieldClass("plomb")} />
          </Field>
          <Field label="Navire / voyage" name="navire_voyage" error={getError("navire_voyage")}>
            <Input id="navire_voyage" name="navire_voyage" defaultValue={getValue("navire_voyage")} className={fieldClass("navire_voyage")} />
          </Field>
        </Grid>
      </Section>

      {/* Dates */}
      <Section title="Dates clés" description="La date BADT déclenche le compte à rebours surestaries.">
        <Grid cols={2}>
          <Field label="Date DO (Délivrance Ordre)" name="date_do" error={getError("date_do")}>
            <Input id="date_do" name="date_do" type="date" defaultValue={getValue("date_do")} className={fieldClass("date_do")} />
          </Field>
          <Field label="Date BADT" name="date_badt" error={getError("date_badt")} hint="Bon À Délivrer Transitaire">
            <Input id="date_badt" name="date_badt" type="datetime-local" defaultValue={getValue("date_badt")} className={fieldClass("date_badt")} />
          </Field>
          <Field label="Livraison prévue" name="date_livraison_prevue" error={getError("date_livraison_prevue")}>
            <Input id="date_livraison_prevue" name="date_livraison_prevue" type="date" defaultValue={getValue("date_livraison_prevue")} className={fieldClass("date_livraison_prevue")} />
          </Field>
          <Field label="Livraison réelle" name="date_livraison_reelle" error={getError("date_livraison_reelle")}>
            <Input id="date_livraison_reelle" name="date_livraison_reelle" type="date" defaultValue={getValue("date_livraison_reelle")} className={fieldClass("date_livraison_reelle")} />
          </Field>
        </Grid>
      </Section>

      {/* Statut + notes */}
      <Section title="Statut & notes">
        <Grid cols={2}>
          <Field label="Statut" name="statut" required error={getError("statut")}>
            <select id="statut" name="statut" defaultValue={getValue("statut") || "EN_ATTENTE"} required className={selectClass("statut")}>
              {CONTENEUR_STATUTS.map((s) => (
                <option key={s} value={s}>{STATUT_LABEL[s]}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes" name="notes" error={getError("notes")} className="md:col-span-2">
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={getValue("notes")}
              placeholder="Instructions particulières, incidents, contacts…"
              className={cn(
                "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                getError("notes") && "border-rose-500",
              )}
            />
          </Field>
        </Grid>
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
              {mode === "update" ? "Enregistrer les modifications" : "Enregistrer le conteneur"}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// Présentationnels
// =============================================================================

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
  return (
    <div className={cn("grid gap-4", cols === 2 && "md:grid-cols-2", cols === 3 && "md:grid-cols-3")}>
      {children}
    </div>
  );
}

function Field({
  label, name, hint, error, required, children, className,
}: {
  label: string; name: string; hint?: string; error?: string | null;
  required?: boolean; children: React.ReactNode; className?: string;
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
