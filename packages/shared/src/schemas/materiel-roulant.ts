import { z } from "zod";
import { MATERIEL_ETATS, MATERIEL_TYPES } from "../constants";

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

const optionalNumber = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : Number(s)))
  .pipe(z.number().nullable());

// =============================================================================
// Schéma création matériel roulant
// =============================================================================

export const materielRoulantCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),

  // -- Identification --
  type: z.enum(MATERIEL_TYPES),
  immatriculation: z
    .string()
    .trim()
    .min(1, "Immatriculation obligatoire")
    .max(20, "Immatriculation trop longue (max 20)"),
  marque: optionalString(50),
  modele: optionalString(50),
  annee: optionalNumber.refine(
    (v) => v === null || (Number.isInteger(v) && v >= 1990 && v <= new Date().getFullYear() + 1),
    `Année entre 1990 et ${new Date().getFullYear() + 1}`,
  ),

  // -- Caractéristiques --
  capacite_tonnes: optionalNumber.refine(
    (v) => v === null || (v > 0 && v < 100),
    "Capacité doit être entre 0 et 100 tonnes",
  ),
  kilometrage_actuel: optionalNumber.refine(
    (v) => v === null || (v >= 0 && v < 10_000_000),
    "Kilométrage invalide",
  ),

  // -- Dates documents (dénormalisées dans la table) --
  assurance_fin:          optionalDate,
  visite_technique_fin:   optionalDate,
  vignette_fin:           optionalDate,
  patente_fin:            optionalDate,
  autorisation_dgttc_fin: optionalDate,

  // -- État --
  etat: z.enum(MATERIEL_ETATS).default("EN_SERVICE"),

  // -- Acquisition --
  date_acquisition: optionalDate,
  prix_acquisition_fcfa: optionalNumber.refine(
    (v) => v === null || (v >= 0 && v < 1_000_000_000),
    "Prix invalide",
  ),

  // -- Divers --
  notes: optionalString(2000),
});

export type MaterielRoulantCreateInput = z.input<typeof materielRoulantCreateSchema>;
export type MaterielRoulantCreateData = z.output<typeof materielRoulantCreateSchema>;

// Alias legacy
export const materielRoulantSchema = materielRoulantCreateSchema;
export type MaterielRoulantInput = MaterielRoulantCreateInput;
