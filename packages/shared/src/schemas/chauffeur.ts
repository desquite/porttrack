import { z } from "zod";
import {
  CATEGORIES_PERMIS,
  CHAUFFEUR_STATUTS,
  SEXES,
} from "../constants";

// =============================================================================
// Helpers — transforms communs
// =============================================================================

/** Trim + null si chaîne vide → utile pour les champs optionnels venant d'un form HTML */
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

/** Date ISO (yyyy-mm-dd) optionnelle */
const optionalDate = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide (attendu YYYY-MM-DD)")
      .nullable(),
  );

/** UUID optionnel (chaîne vide → null) */
const optionalUuid = z.preprocess(
  (val) => {
    if (typeof val !== "string") return val;
    const trimmed = val.trim();
    return trimmed === "" ? null : trimmed;
  },
  z.string().uuid("Référence invalide").nullable(),
);

/** Date ISO obligatoire */
const requiredDate = z
  .string()
  .trim()
  .min(1, "Date obligatoire")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide");

// =============================================================================
// Schéma principal : création d'un chauffeur
// =============================================================================

export const chauffeurCreateSchema = z
  .object({
    // Tenant : obligatoire pour SUPER_ADMIN, sinon auto-injecté depuis la session
    tenant_id: z.string().uuid("Tenant invalide"),

    // -- Identité --
    prenoms: z
      .string()
      .trim()
      .min(1, "Prénoms obligatoires")
      .max(100, "Prénoms trop longs (max 100)"),
    nom: z
      .string()
      .trim()
      .min(1, "Nom obligatoire")
      .max(100, "Nom trop long (max 100)"),
    date_naissance: optionalDate,
    sexe: z
      .enum([...SEXES, ""] as const)
      .transform((v) => (v === "" ? null : (v as (typeof SEXES)[number])))
      .nullable(),
    numero_cni: optionalString(50),

    // -- Contact --
    telephone: z
      .string()
      .trim()
      .min(8, "Téléphone trop court")
      .max(30, "Téléphone trop long")
      .regex(/^[+0-9 ()-]+$/, "Format de téléphone invalide"),
    telephone_secondaire: optionalString(30).refine(
      (v) => v === null || /^[+0-9 ()-]+$/.test(v),
      "Format de téléphone secondaire invalide",
    ),
    email: optionalString(150).refine(
      (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Adresse email invalide",
    ),
    adresse: optionalString(500),

    // -- Permis --
    numero_permis: optionalString(50),
    categories_permis: z
      .array(z.enum(CATEGORIES_PERMIS))
      .default([])
      .transform((arr) => (arr.length === 0 ? null : arr)),
    permis_obtention: optionalDate,
    permis_expiration: optionalDate,

    // -- Visite médicale --
    visite_medicale_expiration: optionalDate,

    // -- CNPS --
    numero_cnps: optionalString(50),

    // -- Emploi --
    date_embauche: optionalDate,
    statut: z.enum(CHAUFFEUR_STATUTS).default("ACTIF"),
    equipe_id_defaut: optionalUuid,

    // -- Divers --
    notes: optionalString(2000),
  })
  // Cross-field : la date d'obtention du permis doit être <= la date d'expiration
  .refine(
    (data) =>
      !data.permis_obtention ||
      !data.permis_expiration ||
      data.permis_obtention <= data.permis_expiration,
    {
      message: "La date d'obtention du permis doit être antérieure à la date d'expiration",
      path: ["permis_expiration"],
    },
  )
  // Cross-field : date de naissance plausible (entre 16 et 100 ans)
  .refine(
    (data) => {
      if (!data.date_naissance) return true;
      const dob = new Date(data.date_naissance);
      const now = new Date();
      const age =
        (now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return age >= 16 && age <= 100;
    },
    {
      message: "Date de naissance invalide (âge entre 16 et 100 ans)",
      path: ["date_naissance"],
    },
  )
  // Cross-field : embauche <= aujourd'hui
  .refine(
    (data) => !data.date_embauche || new Date(data.date_embauche) <= new Date(),
    {
      message: "La date d'embauche ne peut pas être dans le futur",
      path: ["date_embauche"],
    },
  );

export type ChauffeurCreateInput = z.input<typeof chauffeurCreateSchema>;
export type ChauffeurCreateData = z.output<typeof chauffeurCreateSchema>;

// =============================================================================
// Schéma update : tous les champs deviennent optionnels (sauf l'id)
// =============================================================================

// Pour la v1 on garde createSchema. Update sera ajouté quand on fera la page édition.
// (Évite de dupliquer la logique de validation cross-field.)

// On garde l'export legacy `chauffeurSchema` pour ne pas casser d'éventuels
// usages — alias vers le nouveau schéma de création.
export const chauffeurSchema = chauffeurCreateSchema;
export type ChauffeurInput = ChauffeurCreateInput;
