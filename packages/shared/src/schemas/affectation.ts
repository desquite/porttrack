import { z } from "zod";
import { AFFECTATION_STATUTS } from "../constants";

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

const optionalUuid = z.preprocess(
  (val) => {
    if (typeof val !== "string") return val;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  },
  z.string().uuid("Référence invalide").nullable(),
);

const optionalDate = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide").nullable());

const optionalDateTime = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/,
        "Date/heure invalide",
      )
      .nullable(),
  );

const requiredDate = z
  .string()
  .trim()
  .min(1, "Date obligatoire")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

const optionalNumber = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : Number(s)))
  .pipe(z.number().nullable());

// =============================================================================
// Schéma création affectation
// =============================================================================

export const affectationCreateSchema = z
  .object({
    tenant_id: z.string().uuid("Tenant invalide"),

    // Liens — conteneur obligatoire, le reste optionnel (affectation peut
    // être planifiée avant d'assigner un chauffeur/véhicule)
    conteneur_id: z.string().uuid("Conteneur obligatoire"),
    chauffeur_id: optionalUuid,
    tracteur_id: optionalUuid,
    remorque_id: optionalUuid,

    // Dates
    date_affectation: requiredDate,
    date_depart_prevue: optionalDateTime,
    date_depart_reelle: optionalDateTime,
    date_retour: optionalDateTime,

    // Km
    km_depart: optionalNumber.refine(
      (v) => v === null || (v >= 0 && v < 10_000_000),
      "Kilométrage invalide",
    ),
    km_retour: optionalNumber.refine(
      (v) => v === null || (v >= 0 && v < 10_000_000),
      "Kilométrage invalide",
    ),

    // Statut
    statut: z.enum(AFFECTATION_STATUTS).default("PLANIFIEE"),

    notes: optionalString(2000),
  })
  // km_retour >= km_depart
  .refine(
    (data) =>
      data.km_depart === null ||
      data.km_retour === null ||
      data.km_retour >= data.km_depart,
    {
      message: "Le km retour doit être supérieur ou égal au km départ",
      path: ["km_retour"],
    },
  )
  // tracteur != remorque
  .refine(
    (data) =>
      !data.tracteur_id ||
      !data.remorque_id ||
      data.tracteur_id !== data.remorque_id,
    {
      message: "Le tracteur et la remorque doivent être des véhicules différents",
      path: ["remorque_id"],
    },
  );

export type AffectationCreateInput = z.input<typeof affectationCreateSchema>;
export type AffectationCreateData = z.output<typeof affectationCreateSchema>;
