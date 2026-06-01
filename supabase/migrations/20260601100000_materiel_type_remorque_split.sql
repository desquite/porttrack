-- =============================================================================
-- Migration #28 — materiel_type : Remorque 20'/40' + Auto-chargeuse
-- =============================================================================
-- Ajoute 3 nouvelles valeurs à l'enum public.materiel_type :
--   * REMORQUE_20      — Remorque 20 pieds
--   * REMORQUE_40      — Remorque 40 pieds
--   * AUTO_CHARGEUSE   — Camion auto-chargeur (AC)
--
-- L'ancienne valeur "REMORQUE" est CONSERVÉE pour la rétrocompat (matériels
-- déjà saisis avec ce type générique). À masquer du formulaire plus tard si
-- besoin une fois la migration des fiches existantes faite.
-- =============================================================================

ALTER TYPE public.materiel_type ADD VALUE IF NOT EXISTS 'REMORQUE_20';
ALTER TYPE public.materiel_type ADD VALUE IF NOT EXISTS 'REMORQUE_40';
ALTER TYPE public.materiel_type ADD VALUE IF NOT EXISTS 'AUTO_CHARGEUSE';
