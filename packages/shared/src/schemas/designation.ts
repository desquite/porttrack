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

export const designationCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  chauffeur_id: z.string().uuid("Chauffeur requis"),
  materiel_roulant_id: z.string().uuid("Matériel requis"),
  date_designation: requiredDate,
  notes: optionalString(1000),
});

export type DesignationCreateInput = z.input<typeof designationCreateSchema>;
export type DesignationCreateData = z.output<typeof designationCreateSchema>;
