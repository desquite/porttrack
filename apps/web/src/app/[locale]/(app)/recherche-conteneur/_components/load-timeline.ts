import { createClient } from "@/lib/supabase/server";

/**
 * Reconstitue le « parcours » (process) d'un ou plusieurs conteneurs à partir
 * des vraies données : statut du conteneur + affectations + EIR de livraison
 * + récupérations. Sert à la page Recherche pour montrer OÙ EN EST chaque
 * conteneur, sans dépendre d'un journal d'événements dédié.
 */

export type TimelineStep = {
  /** clé logique de l'étape (pour l'icône / le tri) */
  kind: "cree" | "affecte" | "livre" | "recup_planifiee" | "recupere" | "annule";
  label: string;
  date: string | null;
  /** détail secondaire (chauffeur, lieu, mode…) */
  detail?: string | null;
  done: boolean;
};

export type ConteneurParcours = {
  id: string;
  numero: string;
  numeroBl: string | null;
  client: string | null;
  transitaire: string | null;
  dateBadt: string | null;
  statut: string;
  /** libellé court de l'état courant (le plus avancé) */
  etatLabel: string;
  steps: TimelineStep[];
};

const MODE_LABEL: Record<string, string> = {
  REMORQUE_COUPEE: "remorque coupée",
  CLIENT_DECHARGE: "client a déchargé",
  AUTO_CHARGEUR: "auto-chargeur",
};
const DEST_LABEL: Record<string, string> = { PARC_ACONIER: "Parc aconier", TERMINAL: "Terminal" };

const STATUT_LABEL: Record<string, string> = {
  EN_ATTENTE: "En attente",
  EN_COURS: "En cours",
  LIVRE: "Livré",
  ANNULE: "Annulé",
};

/**
 * Construit le parcours de chaque conteneur fourni (déjà chargés en amont via
 * la recherche). Fait 3 requêtes groupées (affectations, EIR, récupérations)
 * sur l'ensemble des IDs.
 */
export async function buildParcours(
  conteneurs: Array<{
    id: string;
    numero: string;
    numero_bl: string | null;
    client: string | null;
    transitaire: string | null;
    date_badt: string | null;
    statut: string;
    created_at: string | null;
    date_livraison_reelle: string | null;
  }>,
): Promise<ConteneurParcours[]> {
  if (conteneurs.length === 0) return [];
  const ids = conteneurs.map((c) => c.id);
  const supabase = await createClient();

  const [{ data: affs }, { data: eirs }, { data: recups }] = await Promise.all([
    supabase
      .from("affectations")
      .select(`conteneur_id, statut, date_affectation, created_at,
               chauffeur:chauffeurs ( nom, prenoms ),
               tracteur:materiel_roulant!affectations_tracteur_id_fkey ( immatriculation )`)
      .in("conteneur_id", ids),
    supabase
      .from("eir_archives")
      .select("conteneur_id, date_livraison, chauffeur_nom, mode_livraison, validated_via, validated_by_nom")
      .in("conteneur_id", ids)
      .order("date_livraison", { ascending: false }),
    supabase
      .from("recuperations")
      .select("conteneur_id, statut, date_planifiee, date_recuperation, chauffeur_nom, destination_type, destination_lieu, validated_via, validated_by_nom")
      .in("conteneur_id", ids)
      .neq("statut", "ANNULEE"),
  ]);

  // Index par conteneur (1re entrée la plus pertinente)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const affByConteneur = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const a of (affs ?? []) as any[]) {
    if (!affByConteneur.has(a.conteneur_id)) affByConteneur.set(a.conteneur_id, a);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eirByConteneur = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const e of (eirs ?? []) as any[]) {
    if (!eirByConteneur.has(e.conteneur_id)) eirByConteneur.set(e.conteneur_id, e);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recupByConteneur = new Map<string, any>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (recups ?? []) as any[]) {
    if (!recupByConteneur.has(r.conteneur_id)) recupByConteneur.set(r.conteneur_id, r);
  }

  const viaLabel = (via: string | null, nom: string | null, fallback: string | null) => {
    const who = nom || fallback || "—";
    if (via === "SAISIE_BUREAU") return `${who} (saisie bureau)`;
    if (via === "PWA_CHAUFFEUR") return `${who} (PWA chauffeur)`;
    return who;
  };

  return conteneurs.map((c) => {
    const aff = affByConteneur.get(c.id);
    const eir = eirByConteneur.get(c.id);
    const recup = recupByConteneur.get(c.id);

    const steps: TimelineStep[] = [];

    // 1) Création
    steps.push({
      kind: "cree",
      label: "Conteneur enregistré",
      date: c.created_at,
      detail: c.numero_bl ? `BL ${c.numero_bl}` : null,
      done: true,
    });

    // 2) Affectation (planification livraison)
    if (aff) {
      const ch = aff.chauffeur ? `${aff.chauffeur.prenoms ?? ""} ${aff.chauffeur.nom ?? ""}`.trim() : null;
      const tr = aff.tracteur?.immatriculation ?? null;
      steps.push({
        kind: "affecte",
        label: "Affecté à un chauffeur",
        date: aff.date_affectation ?? aff.created_at ?? null,
        detail: [ch, tr].filter(Boolean).join(" · ") || null,
        done: true,
      });
    }

    // 3) Livraison (EIR)
    if (eir) {
      const mode = eir.mode_livraison ? MODE_LABEL[eir.mode_livraison] ?? eir.mode_livraison : null;
      steps.push({
        kind: "livre",
        label: "Livré",
        date: eir.date_livraison ?? c.date_livraison_reelle ?? null,
        detail: [
          mode,
          viaLabel(eir.validated_via, eir.validated_by_nom, eir.chauffeur_nom),
        ].filter(Boolean).join(" · ") || null,
        done: true,
      });
    } else if (c.statut === "LIVRE") {
      steps.push({ kind: "livre", label: "Livré", date: c.date_livraison_reelle, detail: null, done: true });
    }

    // 4) Récupération du vide
    if (recup) {
      const destTxt = recup.destination_lieu || (recup.destination_type ? DEST_LABEL[recup.destination_type] : null);
      if (recup.statut === "CONFIRMEE") {
        steps.push({
          kind: "recupere",
          label: "Récupéré (cycle fermé)",
          date: recup.date_recuperation ?? null,
          detail: [
            destTxt ? `→ ${destTxt}` : null,
            viaLabel(recup.validated_via, recup.validated_by_nom, recup.chauffeur_nom),
          ].filter(Boolean).join(" · ") || null,
          done: true,
        });
      } else {
        steps.push({
          kind: "recup_planifiee",
          label: "Récupération planifiée",
          date: recup.date_planifiee ?? null,
          detail: [recup.chauffeur_nom, destTxt ? `→ ${destTxt}` : null].filter(Boolean).join(" · ") || null,
          done: true,
        });
      }
    }

    if (c.statut === "ANNULE") {
      steps.push({ kind: "annule", label: "Annulé", date: null, detail: null, done: true });
    }

    // État courant = le plus avancé
    let etatLabel = STATUT_LABEL[c.statut] ?? c.statut;
    if (recup?.statut === "CONFIRMEE") etatLabel = "Récupéré 🔒";
    else if (recup?.statut === "PLANIFIEE") etatLabel = "Récup. planifiée";
    else if (c.statut === "LIVRE") etatLabel = "Livré";

    return {
      id: c.id,
      numero: c.numero,
      numeroBl: c.numero_bl,
      client: c.client,
      transitaire: c.transitaire,
      dateBadt: c.date_badt,
      statut: c.statut,
      etatLabel,
      steps,
    };
  });
}
