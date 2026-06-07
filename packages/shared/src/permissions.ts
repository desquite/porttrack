// =============================================================================
// Permissions par profil (cahier v8 §3 — modèle « cases hiérarchiques »)
// =============================================================================
// Un utilisateur se voit attribuer un ou plusieurs PROFILS (= domaines).
// Pour chaque profil : soit « tous les droits » du domaine ("*"), soit une
// sélection fine de sous-droits.
//
// MANAGER et SUPER_ADMIN court-circuitent ce système (accès total).
// Paramètres et Tableau de bord ne sont PAS gérés ici (règles dédiées :
// Paramètres = visible par tous / modif Manager+ ; Dashboard = Manager seul).
//
// Stockage : colonne users.permissions (JSONB), au format StoredPermissions.
// =============================================================================

import type { Role } from "./constants";

/** Domaines = profils assignables (1 profil ↔ 1 domaine). */
export const PERMISSION_DOMAINS = ["exploitation", "operations", "flotte"] as const;
export type PermissionDomain = (typeof PERMISSION_DOMAINS)[number];

export type SubRight = {
  /** clé stable stockée en base (ex. "exploitation.chauffeurs") */
  key: string;
  /** libellé affiché (= entrée de menu) */
  label: string;
  /** route locale-agnostique (sert au menu + à la redirection) */
  href: string;
};

export type DomainDef = {
  /** libellé du profil dans le formulaire (ex. "Exploitant") */
  profileLabel: string;
  /** libellé du domaine (= groupe de menu) */
  label: string;
  subRights: SubRight[];
};

/**
 * Arbre des droits. NB : la composition par PROFIL peut différer du regroupement
 * VISUEL du menu (ex. Archives EIR & Traçabilité sont visuellement dans
 * « Archives & Conformité » mais relèvent du profil Opération — décision client).
 */
export const PERMISSION_TREE: Record<PermissionDomain, DomainDef> = {
  exploitation: {
    profileLabel: "Exploitant",
    label: "Exploitation",
    subRights: [
      { key: "exploitation.chauffeurs",   label: "Chauffeurs",   href: "/chauffeurs" },
      { key: "exploitation.equipes",      label: "Équipes",      href: "/equipes" },
      { key: "exploitation.planning",     label: "Planning",     href: "/planning" },
      { key: "exploitation.absences",     label: "Absences",     href: "/absences" },
      { key: "exploitation.designations", label: "Désignations", href: "/designations" },
      { key: "exploitation.checklists",   label: "Check-lists",  href: "/checklists" },
      { key: "exploitation.accidents",    label: "Accidents",    href: "/accidents" },
      { key: "exploitation.infractions",  label: "Infractions",  href: "/infractions" },
    ],
  },
  operations: {
    profileLabel: "Opération",
    label: "Opérations conteneurs",
    subRights: [
      { key: "operations.dashboard",    label: "Tableau Opérations",  href: "/operations" },
      { key: "operations.conteneurs",   label: "Conteneurs",          href: "/conteneurs" },
      { key: "operations.affectations", label: "Flux & affectations", href: "/affectations" },
      { key: "operations.livraisons",   label: "Livraison",           href: "/livraisons" },
      { key: "operations.recuperations",label: "Récupération",        href: "/recuperations" },
      { key: "operations.eir",          label: "Archives EIR",        href: "/eir" },
      { key: "operations.historique",   label: "Traçabilité",         href: "/historique" },
    ],
  },
  flotte: {
    profileLabel: "Garage",
    label: "Flotte & Garage",
    subRights: [
      { key: "flotte.materiel", label: "Flotte", href: "/flotte" },
      { key: "flotte.pannes",   label: "Pannes", href: "/pannes" },
    ],
  },
};

/** Toutes les clés de sous-droits connues. */
export const ALL_SUBRIGHT_KEYS: string[] = PERMISSION_DOMAINS.flatMap(
  (d) => PERMISSION_TREE[d].subRights.map((s) => s.key),
);

/**
 * Permissions stockées en base. Par domaine :
 *   "*"       → tous les sous-droits (capte aussi les futurs ajouts)
 *   string[]  → sélection fine de sous-droits
 *   absent    → aucun accès à ce domaine
 */
export type StoredPermissions = Partial<Record<PermissionDomain, "*" | string[]>>;

/** Domaine d'une clé de sous-droit ("exploitation.chauffeurs" → "exploitation"). */
export function domainOfKey(key: string): PermissionDomain | null {
  const d = key.split(".")[0];
  return (PERMISSION_DOMAINS as readonly string[]).includes(d) ? (d as PermissionDomain) : null;
}

/** Parse défensif du JSONB brut en StoredPermissions. */
export function parsePermissions(raw: unknown): StoredPermissions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: StoredPermissions = {};
  for (const domain of PERMISSION_DOMAINS) {
    const v = obj[domain];
    if (v === "*") out[domain] = "*";
    else if (Array.isArray(v)) out[domain] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

const PRIVILEGED: Role[] = ["SUPER_ADMIN", "MANAGER"];

/** L'utilisateur a-t-il accès à un sous-droit précis ? (Manager/SuperAdmin = oui) */
export function canAccess(role: Role, perms: StoredPermissions | null | undefined, key: string): boolean {
  if (PRIVILEGED.includes(role)) return true;
  const domain = domainOfKey(key);
  if (!domain) return false;
  const v = perms?.[domain];
  if (v === "*") return true;
  return Array.isArray(v) && v.includes(key);
}

/** L'utilisateur a-t-il AU MOINS un accès dans ce domaine ? (pour afficher le groupe de menu) */
export function canAccessDomain(role: Role, perms: StoredPermissions | null | undefined, domain: PermissionDomain): boolean {
  if (PRIVILEGED.includes(role)) return true;
  const v = perms?.[domain];
  return v === "*" || (Array.isArray(v) && v.length > 0);
}

/** Ensemble plat de tous les sous-droits accordés (résolus). */
export function grantedKeys(role: Role, perms: StoredPermissions | null | undefined): Set<string> {
  if (PRIVILEGED.includes(role)) return new Set(ALL_SUBRIGHT_KEYS);
  const out = new Set<string>();
  for (const domain of PERMISSION_DOMAINS) {
    const v = perms?.[domain];
    if (v === "*") PERMISSION_TREE[domain].subRights.forEach((s) => out.add(s.key));
    else if (Array.isArray(v)) v.forEach((k) => out.add(k));
  }
  return out;
}

/** Première route autorisée (pour rediriger un non-manager hors du dashboard). */
export function firstAllowedHref(role: Role, perms: StoredPermissions | null | undefined): string {
  if (PRIVILEGED.includes(role)) return "/dashboard";
  for (const domain of PERMISSION_DOMAINS) {
    for (const sr of PERMISSION_TREE[domain].subRights) {
      if (canAccess(role, perms, sr.key)) return sr.href;
    }
  }
  // Aucun droit métier → au moins les Paramètres (visibles par tous, en lecture)
  return "/parametres";
}
