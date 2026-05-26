import { z } from "zod";
import { STATUTS_CONTENEUR } from "../constants";

/** Conteneur — cahier §4.2 (référence MEDLOG) */
export const conteneurSchema = z.object({
  id_conteneur: z
    .string()
    .min(1, "Numéro de conteneur obligatoire")
    .max(20, "Numéro trop long"),
  type_conteneur: z.string().min(1, "Type obligatoire"), // 20DV, 40HC...
  client: z.string().min(1, "Client obligatoire"),
  transitaire: z.string().optional().nullable(),
  bl: z.string().optional().nullable(),
  destination: z.string().min(1, "Lieu de livraison obligatoire"),
  poids: z.number().nonnegative().optional().nullable(),
  marchandise: z.string().optional().nullable(),
  mode_livraison: z.string().optional().nullable(),
  date_do: z.string().date().optional().nullable(),
  date_badt: z.string().date().optional().nullable(),
  statut: z.enum(STATUTS_CONTENEUR).default("EN_ATTENTE"),
  transporteur: z.string().optional().nullable(),
  plomb: z.string().optional().nullable(),
  num_declaration: z.string().optional().nullable(),
  type_visite: z.string().optional().nullable(),
  navire_voyage: z.string().optional().nullable(),
});

export type ConteneurInput = z.infer<typeof conteneurSchema>;
