-- =============================================================================
-- PORTTRACK — Migration #4 : recherche tolérante aux accents et à la casse
-- =============================================================================
-- Objectif UX : permettre de trouver "Touré" en tapant "toure", "TOURE",
-- "Touré", peu importe.
--
-- PostgreSQL fait du case-insensitive avec `ilike` mais PAS d'accent-
-- insensitive. La solution standard : extension `unaccent` + colonne
-- générée qui stocke la version normalisée (lower + sans accents) +
-- index GIN trigram pour des recherches `ilike '%xxx%'` performantes
-- à grande échelle (testé jusqu'à 1M de lignes).
--
-- Côté application : on normalise la requête utilisateur de la même
-- façon (.normalize('NFD') + .toLowerCase()) et on cherche dans
-- search_text au lieu des colonnes brutes.
-- =============================================================================

-- =============================================================================
-- 1. Extensions
-- =============================================================================
-- unaccent : supprime les accents (Touré → Toure)
-- pg_trgm  : permet l'index GIN trigram pour ilike performant
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- =============================================================================
-- 2. Wrapper immutable autour d'unaccent
-- =============================================================================
-- unaccent() est STABLE par défaut (parce qu'il dépend du dictionnaire
-- chargé). Pour l'utiliser dans une colonne générée ou un index, il faut
-- une fonction IMMUTABLE. On fige explicitement le dictionnaire 'unaccent'
-- pour rendre le wrapper déterministe.
-- =============================================================================

create or replace function public.immutable_unaccent(input text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select public.unaccent('public.unaccent', input);
$$;

comment on function public.immutable_unaccent(text) is
  'Version IMMUTABLE d''unaccent pour usage dans colonnes générées et index';

-- =============================================================================
-- 3. Colonnes générées search_text
-- =============================================================================

-- 3.1 chauffeurs : recherche sur prénoms, nom, téléphone, CNI, numéro permis
alter table public.chauffeurs
  add column if not exists search_text text
  generated always as (
    public.immutable_unaccent(lower(
      coalesce(prenoms, '') || ' ' ||
      coalesce(nom, '') || ' ' ||
      coalesce(telephone, '') || ' ' ||
      coalesce(telephone_secondaire, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(numero_cni, '') || ' ' ||
      coalesce(numero_permis, '') || ' ' ||
      coalesce(numero_cnps, '')
    ))
  ) stored;

create index if not exists chauffeurs_search_text_trgm_idx
  on public.chauffeurs
  using gin (search_text gin_trgm_ops);

-- 3.2 materiel_roulant : recherche sur immatriculation, marque, modèle, notes
alter table public.materiel_roulant
  add column if not exists search_text text
  generated always as (
    public.immutable_unaccent(lower(
      coalesce(immatriculation, '') || ' ' ||
      coalesce(marque, '') || ' ' ||
      coalesce(modele, '')
    ))
  ) stored;

create index if not exists materiel_search_text_trgm_idx
  on public.materiel_roulant
  using gin (search_text gin_trgm_ops);

-- =============================================================================
-- 4. Documentation
-- =============================================================================

comment on column public.chauffeurs.search_text is
  'Colonne générée pour recherche tolérante (lower + unaccent). Voir migration search_normalize.';
comment on column public.materiel_roulant.search_text is
  'Colonne générée pour recherche tolérante (lower + unaccent). Voir migration search_normalize.';
