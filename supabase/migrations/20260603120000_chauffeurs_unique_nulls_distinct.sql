-- =============================================================================
-- Migration #31 — chauffeurs : CNI / permis uniques SANS bloquer les NULL
-- =============================================================================
-- BUG : les contraintes d'unicité CNI et permis avaient été créées en
--   « UNIQUE NULLS NOT DISTINCT » → Postgres traite alors DEUX NULL comme
--   égaux. Conséquence : impossible de créer un 2ᵉ chauffeur sans permis (ou
--   sans CNI) — erreur « duplicate key … chauffeurs_permis_unique_per_tenant »
--   alors que ces champs sont facultatifs.
--
-- CORRECTIF : revenir au comportement standard « NULLS DISTINCT » :
--   * plusieurs chauffeurs SANS CNI / SANS permis sont autorisés (NULL distincts)
--   * deux chauffeurs avec le MÊME numéro réel restent interdits (unicité utile)
--
-- On normalise d'abord les éventuelles chaînes vides en NULL (défensif) avant
-- de recréer les contraintes.
-- =============================================================================

-- 1) Normalisation : "" / "   " → NULL
update public.chauffeurs set numero_cni    = nullif(btrim(numero_cni), '')    where numero_cni    is not null;
update public.chauffeurs set numero_permis = nullif(btrim(numero_permis), '') where numero_permis is not null;

-- 2) Suppression des contraintes fautives (NULLS NOT DISTINCT)
alter table public.chauffeurs drop constraint if exists chauffeurs_cni_unique_per_tenant;
alter table public.chauffeurs drop constraint if exists chauffeurs_permis_unique_per_tenant;

-- 3) Recréation en NULLS DISTINCT (comportement par défaut)
alter table public.chauffeurs
  add constraint chauffeurs_cni_unique_per_tenant unique (tenant_id, numero_cni);
alter table public.chauffeurs
  add constraint chauffeurs_permis_unique_per_tenant unique (tenant_id, numero_permis);
