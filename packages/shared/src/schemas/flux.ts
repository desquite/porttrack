import { z } from "zod";

// =============================================================================
// Métadonnées d'un import de flux (cahier §4)
// =============================================================================
// Le fichier Excel lui-même transite en FormData (File) ; ce schéma valide les
// métadonnées qui l'accompagnent : tenant cible, aconier détecté/choisi, nom du
// fichier et le mapping champ standard → en-tête du fichier.

export const fluxMappingSchema = z.record(z.string(), z.string());
export type FluxMappingInput = z.infer<typeof fluxMappingSchema>;

export const fluxImportMetaSchema = z.object({
  tenantId: z.string().uuid("Tenant invalide"),
  aconier: z.string().trim().min(1, "Aconier requis").max(50),
  nomFichier: z.string().trim().min(1, "Nom de fichier requis").max(255),
  mapping: fluxMappingSchema,
});

export type FluxImportMeta = z.infer<typeof fluxImportMetaSchema>;

// =============================================================================
// Rapport d'import renvoyé au client (cahier §4.3)
// =============================================================================

export interface FluxImportReport {
  fluxId: string | null;
  aconier: string;
  nomFichier: string;
  nombreLignes: number;
  nombreImportes: number;
  nombreDoublons: number;
  nombreErreurs: number;
  statut: "TERMINE" | "PARTIEL" | "ECHEC";
  doublons: string[]; // numéros ignorés
  erreurs: { ligne: number; message: string }[];
  avertissements: { ligne: number; message: string }[];
}
