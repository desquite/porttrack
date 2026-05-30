import { z } from "zod";
import { CHECKLIST_ITEM_ETATS } from "../constants";

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

const itemEtat = z.enum(CHECKLIST_ITEM_ETATS).default("OK");

export const checklistDepartCreateSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  designation_id: z.string().uuid("Désignation requise"),
  chauffeur_id: z.string().uuid("Chauffeur requis"),
  materiel_roulant_id: z.string().uuid("Matériel requis"),
  date_depart: requiredDate,

  item_huile: itemEtat,
  item_pneus: itemEtat,
  item_feux: itemEtat,
  item_freins: itemEtat,
  item_retros: itemEtat,
  item_documents: itemEtat,

  remarque: optionalString(2000),
});

export const checklistDepartUpdateSchema = z.object({
  item_huile: itemEtat,
  item_pneus: itemEtat,
  item_feux: itemEtat,
  item_freins: itemEtat,
  item_retros: itemEtat,
  item_documents: itemEtat,
  remarque: optionalString(2000),
});

export type ChecklistDepartCreateInput = z.input<typeof checklistDepartCreateSchema>;
export type ChecklistDepartCreateData = z.output<typeof checklistDepartCreateSchema>;
export type ChecklistDepartUpdateInput = z.input<typeof checklistDepartUpdateSchema>;
export type ChecklistDepartUpdateData = z.output<typeof checklistDepartUpdateSchema>;
