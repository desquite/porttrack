import { z } from "zod";
import { ACCIDENT_STATUTS } from "../constants";

// Helpers (alignés sur les autres schémas)
const optionalString = (max?: number) =>
  z.preprocess(
    (val) => {
      if (typeof val !== "string") return val;
      const t = val.trim();
      return t === "" ? null : t;
    },
    max !== undefined ? z.string().max(max).nullable() : z.string().nullable(),
  );

const optionalUuid = z.preprocess(
  (val) => {
    if (typeof val !== "string") return val;
    const t = val.trim();
    return t === "" ? null : t;
  },
  z.string().uuid("Référence invalide").nullable(),
);

const optionalDate = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").nullable());

// timestamptz (datetime-local input : YYYY-MM-DDTHH:mm)
const dateTimeRequired = z
  .string()
  .trim()
  .min(1, "Date et heure de l'accident requises")
  .regex(
    /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/,
    "Format date/heure invalide",
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
        "Montant invalide",
      ),
  );

const boolFromForm = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "on" || val === "true" || val === "1";
  return false;
}, z.boolean());

export const accidentCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  materiel_roulant_id: z.string().uuid("Matériel roulant requis"),
  chauffeur_id: optionalUuid,

  date_accident: dateTimeRequired,
  lieu_accident: optionalString(200),
  circonstances: z
    .string()
    .trim()
    .min(3, "Décris les circonstances en quelques mots")
    .max(4000, "Trop long (4000 max)"),
  tiers_implique: boolFromForm,

  assurance_ref: optionalString(100),
  date_declaration_assurance: optionalDate,
  franchise_fcfa: optionalAmount,
  remboursement_fcfa: optionalAmount,

  statut: z.enum(ACCIDENT_STATUTS).default("DECLARE"),
  notes: optionalString(2000),
});

export type AccidentCreateInput = z.input<typeof accidentCreateSchema>;
export type AccidentCreateData = z.output<typeof accidentCreateSchema>;
