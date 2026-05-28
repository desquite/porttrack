import { z } from "zod";
import { CONTENEUR_STATUTS } from "../constants";

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
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide")
      .nullable(),
  );

// date_badt est un timestamptz : on accepte une saisie datetime-local
// (YYYY-MM-DDTHH:mm) ou une date simple
const optionalDateTime = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(
    z
      .string()
      .regex(
        /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?$/,
        "Format de date/heure invalide",
      )
      .nullable(),
  );

const optionalNumber = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : Number(s)))
  .pipe(z.number().nullable());

// =============================================================================
// Schéma création conteneur
// =============================================================================
// Le numéro ISO 6346 standard fait 11 caractères (4 lettres préfixe + 7
// chiffres). On reste tolérant (certains imports legacy ne respectent pas
// strictement) : on exige juste une chaîne non vide jusqu'à 20 caractères.

export const conteneurCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),

  // -- Identification --
  numero: z
    .string()
    .trim()
    .min(1, "Numéro de conteneur obligatoire")
    .max(20, "Numéro trop long (max 20)")
    .transform((s) => s.toUpperCase()),
  type_conteneur_id: optionalUuid,
  shipping_line_id: optionalUuid,

  // -- Documents commerciaux / douaniers --
  numero_bl: optionalString(50),
  num_declaration: optionalString(50),
  type_visite: optionalString(50),

  // -- Acteurs --
  client: optionalString(200),
  transitaire: optionalString(200),

  // -- Logistique --
  origine_id: optionalUuid,
  destination_id: optionalUuid,
  destination_libre: optionalString(200),
  marchandise: optionalString(500),
  poids_kg: optionalNumber.refine(
    (v) => v === null || (v >= 0 && v < 100_000),
    "Poids invalide (0 à 100 000 kg)",
  ),
  plomb: optionalString(50),
  navire_voyage: optionalString(150),

  // -- Dates --
  date_do: optionalDate,
  date_badt: optionalDateTime,
  date_livraison_prevue: optionalDate,
  date_livraison_reelle: optionalDate,

  // -- Statut --
  statut: z.enum(CONTENEUR_STATUTS).default("EN_ATTENTE"),

  // -- Divers --
  notes: optionalString(2000),
});

export type ConteneurCreateInput = z.input<typeof conteneurCreateSchema>;
export type ConteneurCreateData = z.output<typeof conteneurCreateSchema>;

// Alias legacy
export const conteneurSchema = conteneurCreateSchema;
export type ConteneurInput = ConteneurCreateInput;
