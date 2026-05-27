/**
 * Constantes métier PORTTRACK partagées entre web, mobile et bot.
 * Source de vérité : enums Postgres dans supabase/migrations/*.sql.
 *
 * IMPORTANT : ces tableaux DOIVENT rester synchronisés avec les enums
 * de la base de données. Si tu ajoutes une valeur à un enum côté DB,
 * ajoute-la aussi ici (et lance `supabase gen types` pour régénérer
 * database.types.ts).
 */

// =============================================================================
// Rôles utilisateurs (enum public.user_role)
// =============================================================================

export const ROLES = [
  "SUPER_ADMIN",
  "MANAGER",
  "DISPATCHER",
  "COMPTABLE",
  "CHEF_GARAGE",
  "CUSTOM",
] as const;
export type Role = (typeof ROLES)[number];

// =============================================================================
// Statuts et plans tenants
// =============================================================================

export const TENANT_STATUTS = [
  "TRIAL",
  "ACTIVE",
  "SUSPENDED",
  "CANCELLED",
] as const;
export type TenantStatut = (typeof TENANT_STATUTS)[number];

export const PLANS_ABONNEMENT = [
  "STARTER",   // 25 000 FCFA/mois — 1-5 camions
  "BUSINESS",  // 55 000 FCFA/mois — 6-20 camions
  "PREMIUM",   // 120 000 FCFA/mois — 20+ camions
] as const;
export type PlanAbonnement = (typeof PLANS_ABONNEMENT)[number];

// =============================================================================
// Chauffeurs (enum public.chauffeur_statut)
// =============================================================================

export const CHAUFFEUR_STATUTS = [
  "ACTIF",
  "EN_CONGE",
  "SUSPENDU",
  "INACTIF",
] as const;
export type ChauffeurStatut = (typeof CHAUFFEUR_STATUTS)[number];

export const SEXES = ["M", "F"] as const;
export type Sexe = (typeof SEXES)[number];

/**
 * Catégories de permis de conduire reconnues en Côte d'Ivoire.
 * Stockées en text[] côté DB pour pouvoir cumuler plusieurs catégories.
 */
export const CATEGORIES_PERMIS = [
  "A",   // motos
  "B",   // voitures particulières
  "C",   // poids lourds
  "CE",  // poids lourds avec remorque (le plus utile pour le transport portuaire)
  "D",   // autobus
  "DE",  // autobus avec remorque
] as const;
export type CategoriePermis = (typeof CATEGORIES_PERMIS)[number];

// =============================================================================
// Matériel roulant (enums public.materiel_type / materiel_etat)
// =============================================================================

export const MATERIEL_TYPES = [
  "TRACTEUR",
  "REMORQUE",
  "SEMI_REMORQUE",
  "PORTE_CONTENEUR_20",
  "PORTE_CONTENEUR_40",
  "PORTE_CONTENEUR_MIXTE",
] as const;
export type MaterielType = (typeof MATERIEL_TYPES)[number];

export const MATERIEL_ETATS = [
  "EN_SERVICE",
  "EN_PANNE",
  "EN_REPARATION",
  "HORS_SERVICE",
  "VENDU",
] as const;
export type MaterielEtat = (typeof MATERIEL_ETATS)[number];

// =============================================================================
// Documents (enums public.document_owner_type / document_type)
// =============================================================================

export const DOCUMENT_OWNER_TYPES = ["CHAUFFEUR", "MATERIEL"] as const;
export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];

export const DOCUMENT_TYPES = [
  // Chauffeur
  "CNI",
  "PERMIS_CONDUIRE",
  "VISITE_MEDICALE",
  "ATTESTATION_CNPS",
  "CONTRAT_TRAVAIL",
  "PHOTO_IDENTITE",
  // Matériel
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "VIGNETTE",
  "PATENTE_TRANSPORT",
  "AUTORISATION_DGTTC",
  // Autre
  "AUTRE",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// =============================================================================
// Ports / villes (enum public.port_kind)
// =============================================================================

export const PORT_KINDS = ["PORT_MARITIME", "VILLE_HINTERLAND", "PORT_SEC"] as const;
export type PortKind = (typeof PORT_KINDS)[number];

// =============================================================================
// Seuils d'alerte
// =============================================================================

/** Documents : seuils en jours avant expiration */
export const SEUILS_ALERTE_DOC = {
  AVANT: 30,   // alerte orange
  URGENT: 15,  // alerte rouge avant expiration
} as const;

/** BADT (Bon À Délivrer Transitaire — cahier §13.3) */
export const SEUILS_BADT = {
  ANTICIPEE_HEURES: 48,
  URGENTE_HEURES: 24,
} as const;

// =============================================================================
// Conteneurs (futur)
// =============================================================================

export const STATUTS_CONTENEUR = [
  "EN_ATTENTE",
  "EN_COURS",
  "LIVRE",
] as const;
export type StatutConteneur = (typeof STATUTS_CONTENEUR)[number];

// =============================================================================
// Bot WhatsApp (futur — cahier §7.5)
// =============================================================================

export const BOT_WHATSAPP_COMMANDES = {
  CG: "CARTE_GRISE",
  AS: "ASSURANCE",
  VT: "VISITE_TECHNIQUE",
  VG: "VIGNETTE",
  PT: "PATENTE_TRANSPORT",
  DG: "AUTORISATION_DGTTC",
  PC: "PERMIS_CONDUIRE",
  VM: "VISITE_MEDICALE",
  CNI: "CNI",
  DOCS: "TOUS_DOCS",
} as const;
