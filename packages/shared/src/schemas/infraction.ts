import { z } from "zod";
import { INFRACTION_STATUTS, INFRACTION_IMPUTATIONS } from "../constants";

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

const requiredDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

const requiredAmount = z
  .string()
  .trim()
  .min(1, "Montant requis")
  .transform((s) => Number(s))
  .pipe(
    z
      .number()
      .min(0, "Montant invalide")
      .lt(1_000_000_000, "Montant invalide"),
  );

export const infractionCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  chauffeur_id: z.string().uuid("Chauffeur requis"),
  materiel_roulant_id: optionalUuid,

  date_infraction: requiredDate,
  lieu_infraction: optionalString(200),
  type_infraction: z
    .string()
    .trim()
    .min(2, "Type d'infraction requis")
    .max(100, "Trop long"),
  description: optionalString(2000),
  montant_fcfa: requiredAmount,

  date_limite_paiement: optionalDate,
  date_paiement: optionalDate,

  statut: z.enum(INFRACTION_STATUTS).default("NON_PAYEE"),
  imputation: z.enum(INFRACTION_IMPUTATIONS).default("ENTREPRISE"),

  notes: optionalString(2000),
});

export type InfractionCreateInput = z.input<typeof infractionCreateSchema>;
export type InfractionCreateData = z.output<typeof infractionCreateSchema>;
