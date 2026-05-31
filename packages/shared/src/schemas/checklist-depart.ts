import { z } from "zod";

const optionalString = (max?: number) =>
  z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      const t = val.trim();
      return t === "" ? null : t;
    },
    max !== undefined ? z.string().max(max).nullable() : z.string().nullable(),
  );

const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)");

/**
 * Création d'une check-list — les états des items ne sont pas dans ce schéma,
 * ils sont parsés dynamiquement à part (clés `item-<uuid>` dans le FormData)
 * car la liste d'items est configurable par tenant.
 */
export const checklistDepartCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  designation_id: z.string().uuid("Désignation requise"),
  chauffeur_id: z.string().uuid("Chauffeur requis"),
  materiel_roulant_id: z.string().uuid("Matériel requis"),
  date_depart: requiredDate,
  remarque: optionalString(2000),
});

export const checklistDepartUpdateSchema = z.object({
  remarque: optionalString(2000),
});

export type ChecklistDepartCreateInput = z.input<typeof checklistDepartCreateSchema>;
export type ChecklistDepartCreateData = z.output<typeof checklistDepartCreateSchema>;
export type ChecklistDepartUpdateInput = z.input<typeof checklistDepartUpdateSchema>;
export type ChecklistDepartUpdateData = z.output<typeof checklistDepartUpdateSchema>;

// =============================================================================
// Configuration des items (par tenant)
// =============================================================================

const code = z
  .string()
  .trim()
  .min(1, "Code requis")
  .max(50, "Code trop long (50 max)")
  .regex(/^[a-z0-9_-]+$/, "Code : minuscules, chiffres, tiret ou underscore uniquement");

export const checklistItemConfigCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  code,
  label: z.string().trim().min(1, "Libellé requis").max(150, "Libellé trop long (150 max)"),
  ordre: z.coerce.number().int().min(0).max(9999).default(100),
  actif: z.preprocess(
    (v) => (typeof v === "string" ? v === "on" || v === "true" || v === "1" : !!v),
    z.boolean(),
  ).default(true),
});

export const checklistItemConfigUpdateSchema = checklistItemConfigCreateSchema.omit({
  tenant_id: true,
  code: true,
});

export type ChecklistItemConfigCreateInput = z.input<typeof checklistItemConfigCreateSchema>;
export type ChecklistItemConfigCreateData = z.output<typeof checklistItemConfigCreateSchema>;
export type ChecklistItemConfigUpdateInput = z.input<typeof checklistItemConfigUpdateSchema>;
export type ChecklistItemConfigUpdateData = z.output<typeof checklistItemConfigUpdateSchema>;
