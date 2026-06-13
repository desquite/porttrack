import { z } from "zod";

// =============================================================================
// Métadonnées d'un import de flux
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
// Rapport d'import renvoyé au client
// =============================================================================

export interface FluxImportReport {
  fluxId: string | null;
  aconier: string;
  nomFichier: string;
  nombreLignes: number;
  nombreImportes: number;
  nombreCompletes: number; // conteneurs déjà en base dont des champs vides (ex. BL) ont été complétés depuis le fichier
  nombreReinitialises: number; // conteneurs revenus avec un nouveau BL → réinitialisés pour un nouveau cycle
  nombreDoublons: number;
  nombreErreurs: number;
  nombreIgnorees: number; // lignes sans n° de conteneur (footers, lignes vides de données)
  statut: "TERMINE" | "PARTIEL" | "ECHEC";
  doublons: string[]; // numéros ignorés
  erreurs: { ligne: number; message: string }[];
  avertissements: { ligne: number; message: string }[];
}
