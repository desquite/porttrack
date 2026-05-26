import { z } from "zod";
import { STATUTS_CHAUFFEUR } from "../constants";

/** Fiche chauffeur — cahier §6.1 */
export const chauffeurSchema = z.object({
  matricule: z
    .string()
    .min(1, "Matricule obligatoire")
    .max(50, "Matricule trop long"),
  nom: z.string().min(1, "Nom obligatoire"),
  prenoms: z.string().min(1, "Prénoms obligatoires"),
  date_naissance: z.string().date().optional().nullable(),
  telephone: z
    .string()
    .min(8, "Numéro invalide")
    .regex(/^[+0-9 ()-]+$/, "Format de téléphone invalide"),
  adresse: z.string().optional().nullable(),
  contact_urgence_nom: z.string().optional().nullable(),
  contact_urgence_telephone: z.string().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
  num_permis: z.string().min(1, "Numéro de permis obligatoire"),
  scan_permis_url: z.string().url().optional().nullable(),
  date_expiration_permis: z.string().date(),
  date_embauche: z.string().date().optional().nullable(),
  statut: z.enum(STATUTS_CHAUFFEUR).default("DISPONIBLE"),
  materiel_habituel_id: z.string().uuid().optional().nullable(),
});

export type ChauffeurInput = z.infer<typeof chauffeurSchema>;
