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

/**
 * Schéma d'une modification tracée. La validation que le champ est bien
 * « traçable » pour la table cible se fait côté action via le registre
 * TRACKED_FIELDS (impossible à exprimer ici sans coupler aux constantes).
 *
 * `valeur_apres` est volontairement optionnel : remettre un champ à vide est
 * une modification légitime (ex. effacer une destination erronée).
 */
export const modificationTraceeSchema = z.object({
  tenant_id: z.string().uuid("Tenant invalide"),
  table_cible: z.string().min(1, "Table cible requise"),
  enregistrement_id: z.string().uuid("Enregistrement invalide"),
  champ: z.string().min(1, "Champ requis"),
  valeur_apres: optionalString(2000),
  motif: z.string().trim().min(3, "Indique un motif (3 caractères min.)").max(2000, "Motif trop long (2000 max)"),
});

export type ModificationTraceeInput = z.input<typeof modificationTraceeSchema>;
export type ModificationTraceeData = z.output<typeof modificationTraceeSchema>;
