import { z } from "zod";
import { PLANS_ABONNEMENT, TENANT_STATUTS } from "../constants";

// =============================================================================
// Helpers
// =============================================================================

const optionalString = (max?: number) =>
  z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      const trimmed = val.trim();
      return trimmed === "" ? null : trimmed;
    },
    max !== undefined
      ? z.string().max(max, `Maximum ${max} caractères`).nullable()
      : z.string().nullable(),
  );

const optionalDate = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide")
      .nullable(),
  );

// =============================================================================
// Schéma update tenant (édition profil par un MANAGER ou SUPER_ADMIN)
// =============================================================================

export const tenantUpdateSchema = z.object({
  // Identité de l'entreprise
  nom_entreprise: z
    .string()
    .trim()
    .min(1, "Nom obligatoire")
    .max(200, "Nom trop long (max 200)"),
  rccm: optionalString(50),

  // Contact
  email_manager: z
    .string()
    .trim()
    .min(1, "Email du contact principal obligatoire")
    .max(150, "Email trop long")
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Adresse email invalide"),
  telephone: optionalString(30).refine(
    (v) => v === null || /^[+0-9 ()-]+$/.test(v as string),
    "Format de téléphone invalide",
  ),
  adresse: optionalString(500),

  // Champs réservés SUPER_ADMIN — facultatifs côté form, validés par le serveur
  // selon le rôle de l'appelant (cf actions.ts)
  plan: z.enum(PLANS_ABONNEMENT).optional(),
  statut: z.enum(TENANT_STATUTS).optional(),
  date_fin_essai: optionalDate.optional(),
});

export type TenantUpdateInput = z.input<typeof tenantUpdateSchema>;
export type TenantUpdateData = z.output<typeof tenantUpdateSchema>;
