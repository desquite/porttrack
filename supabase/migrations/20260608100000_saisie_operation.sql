-- =============================================================================
-- Migration #33 — Saisie d'opération côté bureau (cycle import)
-- =============================================================================
-- Les chauffeurs qui ne valident pas dans la PWA rapportent l'EIR papier au
-- bureau. Un opérateur saisit alors le mouvement depuis le back-office.
--
-- Pour la traçabilité, on distingue désormais d'OÙ vient la validation :
--   * PWA_CHAUFFEUR : le chauffeur a confirmé lui-même dans son app
--   * SAISIE_BUREAU : un opérateur a saisi le mouvement à partir de l'EIR
--
-- On enregistre aussi un SNAPSHOT du nom de l'opérateur (qui reste lisible
-- même si l'utilisateur est désactivé/supprimé ensuite).
--
-- Le stockage du fichier EIR utilise le bucket `documents` existant, sous le
-- même chemin `{tenant_id}/eir/{conteneur_id}/{uuid}.{ext}` que la PWA.
-- =============================================================================

-- 1. eir_archives : ajout des colonnes de traçabilité
alter table public.eir_archives
  add column validated_via text not null default 'PWA_CHAUFFEUR'
    check (validated_via in ('PWA_CHAUFFEUR', 'SAISIE_BUREAU')),
  add column validated_by_user_id uuid references public.users(id) on delete set null,
  add column validated_by_nom text;

-- Backfill : toutes les lignes existantes ont été créées par la PWA chauffeur
-- (la saisie bureau n'existait pas) → le DEFAULT 'PWA_CHAUFFEUR' couvre déjà
-- le cas. On retire le default ensuite pour forcer l'écriture explicite.
alter table public.eir_archives alter column validated_via drop default;

comment on column public.eir_archives.validated_via is
  'Mode de validation : PWA_CHAUFFEUR (chauffeur dans l''app mobile) ou SAISIE_BUREAU (opérateur back-office à partir de l''EIR papier).';
comment on column public.eir_archives.validated_by_user_id is
  'Utilisateur bureau qui a saisi le mouvement (NULL si PWA chauffeur).';
comment on column public.eir_archives.validated_by_nom is
  'Snapshot du nom de l''opérateur (reste lisible même si l''utilisateur est supprimé).';

-- 2. recuperations : ajout des colonnes de traçabilité
alter table public.recuperations
  add column validated_via text
    check (validated_via in ('PWA_CHAUFFEUR', 'SAISIE_BUREAU')),
  add column validated_by_nom text;

comment on column public.recuperations.validated_via is
  'Mode de validation de la récupération (PWA_CHAUFFEUR ou SAISIE_BUREAU). NULL tant que la récupération n''est pas confirmée.';
comment on column public.recuperations.validated_by_nom is
  'Snapshot du nom de l''utilisateur qui a confirmé (PWA = nom chauffeur, bureau = nom opérateur).';

-- 3. Index utile : compter par mode de validation pour le futur bilan adoption PWA
create index eir_archives_tenant_via_idx
  on public.eir_archives (tenant_id, validated_via);
