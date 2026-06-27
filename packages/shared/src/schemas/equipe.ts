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

// Couleur hex (#rgb / #rrggbb)
const colorHex = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Couleur hex invalide (ex. #3b82f6)");

// NB : depuis le passage au planning en roulement, une équipe n'a plus d'horaires
// fixes ni de jours travaillés (elle tourne jour/nuit/repos). Les colonnes
// equipes.heure_debut/heure_fin/jours_travailles existent encore en base
// (rétrocompat) mais ne sont plus saisies ni utilisées.
export const equipeCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  nom: z.string().trim().min(1, "Nom requis").max(80, "Trop long"),
  code: z
    .string()
    .trim()
    .min(1, "Code requis (1-3 caractères)")
    .max(3, "Code trop long (3 max)")
    .transform((s) => s.toUpperCase()),
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
});

export type EquipeCreateInput = z.input<typeof equipeCreateSchema>;
export type EquipeCreateData = z.output<typeof equipeCreateSchema>;
