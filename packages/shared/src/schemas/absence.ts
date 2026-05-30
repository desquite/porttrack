import { z } from "zod";
import { ABSENCE_TYPES } from "../constants";

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

export const absenceCreateSchema = z
  .object({
    tenant_id: z.string().uuid("Tenant invalide"),
    chauffeur_id: z.string().uuid("Chauffeur requis"),
    type: z.enum(ABSENCE_TYPES),
    date_debut: requiredDate,
    date_fin: requiredDate,
    motif: optionalString(2000),
  })
  .refine((d) => d.date_fin >= d.date_debut, {
    message: "La date de fin doit être après le début.",
    path: ["date_fin"],
  });

export type AbsenceCreateInput = z.input<typeof absenceCreateSchema>;
export type AbsenceCreateData = z.output<typeof absenceCreateSchema>;
