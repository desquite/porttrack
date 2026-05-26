import { z } from "zod";
import { STATUTS_MATERIEL, TYPES_MATERIEL_ROULANT } from "../constants";

/** Fiche Matériel Roulant — cahier §7.3 */
export const materielRoulantSchema = z.object({
  immatriculation: z
    .string()
    .min(1, "Immatriculation obligatoire")
    .max(20, "Immatriculation trop longue"),
  chrono: z
    .string()
    .max(20, "Nom interne trop long")
    .optional()
    .nullable(),
  type: z.enum(TYPES_MATERIEL_ROULANT),
  marque: z.string().min(1, "Marque obligatoire"),
  modele: z.string().min(1, "Modèle obligatoire"),
  annee_mise_en_service: z
    .number()
    .int()
    .min(1980)
    .max(new Date().getFullYear() + 1),
  tonnage: z.number().positive("Tonnage doit être positif"),
  kilometrage: z.number().int().nonnegative().optional().nullable(),
  statut: z.enum(STATUTS_MATERIEL).default("DISPONIBLE"),
  semi_remorque_associee_id: z.string().uuid().optional().nullable(),
  chauffeur_habituel_id: z.string().uuid().optional().nullable(),
});

export type MaterielRoulantInput = z.infer<typeof materielRoulantSchema>;
