import { z } from "zod";

// =============================================================================
// Schéma création/mise à jour d'une équipe
// =============================================================================

const optionalString = (max?: number) =>
  z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      const t = val.trim();
      return t === "" ? null : t;
    },
    max !== undefined ? z.string().max(max).nullable() : z.string().nullable(),
  );

// HH:mm ou vide → null (autorise une équipe « Repos » sans horaires)
const optionalTime = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide (HH:mm)")
      .nullable(),
  );

// Couleur hex (#rgb / #rrggbb)
const colorHex = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur hex invalide (ex. #3b82f6)");

// Jours travaillés : array de valeurs 0..6 (chaque case checkbox).
// On reçoit depuis le form un tableau de chaînes ("0".."6") qu'on parse.
const joursTravailles = z.preprocess(
  (val) => {
    if (Array.isArray(val)) return val.map(String);
    if (val == null || val === "") return [];
    if (typeof val === "string") return [val];
    return val;
  },
  z
    .array(
      z
        .string()
        .regex(/^[0-6]$/)
        .transform((s) => Number(s)),
    )
    .transform((arr) => Array.from(new Set(arr)).sort()),
);

export const equipeCreateSchema = z
  .object({
    tenant_id: z.string().uuid("Tenant invalide"),
    nom: z.string().trim().min(1, "Nom requis").max(80, "Trop long"),
    code: z
      .string()
      .trim()
      .min(1, "Code requis (1-3 caractères)")
      .max(3, "Code trop long (3 max)")
      .transform((s) => s.toUpperCase()),
    heure_debut: optionalTime,
    heure_fin: optionalTime,
    jours_travailles: joursTravailles,
    couleur: colorHex,
    ordre: z
      .string()
      .trim()
      .transform((s) => (s === "" ? 0 : Number(s)))
      .pipe(z.number().int().min(0).max(999)),
    actif: z.preprocess((val) => {
      if (typeof val === "boolean") return val;
      if (typeof val === "string") return val === "on" || val === "true" || val === "1";
      return true;
    }, z.boolean()),
    notes: optionalString(2000),
  })
  .refine(
    (d) =>
      (d.heure_debut == null && d.heure_fin == null) ||
      (d.heure_debut != null && d.heure_fin != null),
    { message: "Renseigne les deux heures ou aucune (équipe Repos).", path: ["heure_fin"] },
  );

export type EquipeCreateInput = z.input<typeof equipeCreateSchema>;
export type EquipeCreateData = z.output<typeof equipeCreateSchema>;
