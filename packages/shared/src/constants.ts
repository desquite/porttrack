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
  "EN_PANNE",        // panne mécanique
  "INDISPONIBLE",    // immobilisé suite à un accident (§5.2)
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
  // Matériel (ordre cahier §8 : Carte Grise, Assurance, Visite Technique,
  // Carte de Transport, Carte de Stationnement, Patente)
  "CARTE_GRISE",
  "ASSURANCE",
  "VISITE_TECHNIQUE",
  "CARTE_TRANSPORT",
  "CARTE_STATIONNEMENT",
  "PATENTE_TRANSPORT",
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

export const CONTENEUR_STATUTS = [
  "EN_ATTENTE",
  "EN_COURS",
  "LIVRE",
  "ANNULE",
] as const;
export type ConteneurStatut = (typeof CONTENEUR_STATUTS)[number];

export const AFFECTATION_STATUTS = [
  "PLANIFIEE",
  "EN_COURS",
  "TERMINEE",
  "ANNULEE",
] as const;
export type AffectationStatut = (typeof AFFECTATION_STATUTS)[number];

// =============================================================================
// Pannes / Ordre de Réparation (§8.6) — workflow Déclarée → Réparée
// =============================================================================

export const PANNE_STATUTS = [
  "DECLAREE",
  "EN_REPARATION",
  "REPAREE",
  "ANNULEE",
] as const;
export type PanneStatut = (typeof PANNE_STATUTS)[number];

/** Statuts considérés comme « ouverts » (le matériel reste indisponible). */
export const PANNE_STATUTS_OUVERTS = ["DECLAREE", "EN_REPARATION"] as const;

// =============================================================================
// Ressources d'Exploitation — Accidents & Infractions (§5)
// =============================================================================

export const ACCIDENT_STATUTS = [
  "DECLARE",
  "EN_COURS_TRAITEMENT",
  "CLOTURE",
] as const;
export type AccidentStatut = (typeof ACCIDENT_STATUTS)[number];

export const INFRACTION_STATUTS = [
  "NON_PAYEE",
  "PAYEE",
  "CONTESTEE",
] as const;
export type InfractionStatut = (typeof INFRACTION_STATUTS)[number];

export const INFRACTION_IMPUTATIONS = [
  "ENTREPRISE",
  "CHAUFFEUR",
] as const;
export type InfractionImputation = (typeof INFRACTION_IMPUTATIONS)[number];

// =============================================================================
// Planning — Équipes & Absences (§7.2 / §7.4)
// =============================================================================

export const ABSENCE_TYPES = [
  "CONGE_PLANIFIE",
  "ABSENCE_IMPREVUE",
  "MALADIE",
  "FORMATION",
  "AUTRE",
] as const;
export type AbsenceType = (typeof ABSENCE_TYPES)[number];

/**
 * Jours de la semaine — conforme Date.prototype.getDay() côté JS :
 * 0 = dimanche, 1 = lundi, …, 6 = samedi.
 */
export const WEEKDAYS = [
  { value: 1, label: "Lun", labelLong: "Lundi" },
  { value: 2, label: "Mar", labelLong: "Mardi" },
  { value: 3, label: "Mer", labelLong: "Mercredi" },
  { value: 4, label: "Jeu", labelLong: "Jeudi" },
  { value: 5, label: "Ven", labelLong: "Vendredi" },
  { value: 6, label: "Sam", labelLong: "Samedi" },
  { value: 0, label: "Dim", labelLong: "Dimanche" },
] as const;

/** Code spécial planning : valeur affichée dans la cellule pour une absence. */
export const PLANNING_CODE_ABSENCE = "A";
export const PLANNING_CODE_CONGE   = "C";

// Alias legacy (compat)
export const STATUTS_CONTENEUR = CONTENEUR_STATUTS;
export type StatutConteneur = ConteneurStatut;

// =============================================================================
// Bot WhatsApp (futur — cahier §7.5)
// =============================================================================

export const BOT_WHATSAPP_COMMANDES = {
  CG: "CARTE_GRISE",
  AS: "ASSURANCE",
  VT: "VISITE_TECHNIQUE",
  CT: "CARTE_TRANSPORT",
  CS: "CARTE_STATIONNEMENT",
  PT: "PATENTE_TRANSPORT",
  PC: "PERMIS_CONDUIRE",
  VM: "VISITE_MEDICALE",
  CNI: "CNI",
  DOCS: "TOUS_DOCS",
} as const;
