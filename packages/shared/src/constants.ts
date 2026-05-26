/**
 * Constantes métier PORTTRACK partagées entre web, mobile et bot.
 * Source : cahier des charges v1.4 (mai 2026).
 */

export const ACONIERS = ["MEDLOG", "AGL", "MAERSK", "AUTRE"] as const;
export type Aconier = (typeof ACONIERS)[number];

export const TYPES_MATERIEL_ROULANT = ["TRACTEUR", "SEMI_REMORQUE"] as const;
export type TypeMaterielRoulant = (typeof TYPES_MATERIEL_ROULANT)[number];

export const STATUTS_CHAUFFEUR = [
  "DISPONIBLE",
  "EN_MISSION",
  "CONGE",
  "SUSPENDU",
  "BLOQUE",
] as const;
export type StatutChauffeur = (typeof STATUTS_CHAUFFEUR)[number];

export const STATUTS_MATERIEL = [
  "DISPONIBLE",
  "EN_MISSION",
  "EN_PANNE",
  "BLOQUE",
] as const;
export type StatutMateriel = (typeof STATUTS_MATERIEL)[number];

export const STATUTS_CONTENEUR = [
  "EN_ATTENTE",
  "EN_COURS",
  "LIVRE",
] as const;
export type StatutConteneur = (typeof STATUTS_CONTENEUR)[number];

export const ROLES = [
  "SUPER_ADMIN",
  "MANAGER",
  "DISPATCHER",
  "COMPTABLE",
  "CHEF_GARAGE",
  "CUSTOM",
] as const;
export type Role = (typeof ROLES)[number];

/** Documents requis par type de matériel roulant (cahier §7.2 / §14.2) */
export const DOCUMENTS_TRACTEUR = [
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CARTE_TRANSPORT",
  "CARTE_STATIONNEMENT",
] as const;

export const DOCUMENTS_SEMI_REMORQUE = [
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CARTE_TRANSPORT",
  "CARTE_STATIONNEMENT",
  "PATENTE", // exclusif aux semi-remorques
] as const;

/** Codes du bot WhatsApp (cahier §7.5) */
export const BOT_WHATSAPP_COMMANDES = {
  CG: "CARTE_GRISE",
  AS: "ASSURANCE",
  VT: "VISITE_TECHNIQUE",
  CT: "CARTE_TRANSPORT",
  CS: "CARTE_STATIONNEMENT",
  PT: "PATENTE",
  PC: "PERMIS_CONDUIRE",
  DOCS: "TOUS_DOCS",
} as const;

/** Seuils d'alerte expiration documents (cahier §14) */
export const SEUILS_ALERTE_DOC = {
  AVANT: 30, // jours
  URGENT: 15, // jours
} as const;

/** Seuils d'alerte BADT (cahier §13.3) */
export const SEUILS_BADT = {
  ANTICIPEE_HEURES: 48,
  URGENTE_HEURES: 24,
} as const;
