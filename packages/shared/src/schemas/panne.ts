import { z } from "zod";
import { PANNE_STATUTS } from "../constants";

// =============================================================================
// Helpers (mêmes patterns que les autres schémas — chaînes vides → null)
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

const optionalAmount = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : Number(s)))
  .pipe(
    z
      .number()
      .nullable()
      .refine(
        (v) => v === null || (v >= 0 && v < 1_000_000_000),
        "Montant invalide (0 à 999 999 999 FCFA)",
      ),
  );

// =============================================================================
// Schéma création / mise à jour de panne (Ordre de Réparation)
// =============================================================================

export const panneCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  materiel_roulant_id: z.string().uuid("Matériel roulant requis"),

  date_declaration: optionalDate,

  description: z
    .string()
    .trim()
    .min(3, "Décris la panne en quelques mots")
    .max(2000, "Description trop longue (2000 max)"),

  type_panne: optionalString(100),
  garage: optionalString(200),

  date_debut_reparation: optionalDate,
  date_fin_reparation: optionalDate,

  cout_estime_fcfa: optionalAmount,
  cout_reel_fcfa: optionalAmount,

  statut: z.enum(PANNE_STATUTS).default("DECLAREE"),

  notes: optionalString(2000),
});

export type PanneCreateInput = z.input<typeof panneCreateSchema>;
export type PanneCreateData = z.output<typeof panneCreateSchema>;
