-- =============================================================================
-- Migration #31 — Panne du camion désigné : traçabilité + libération chauffeur
-- =============================================================================
-- Scénario : un chauffeur désigné signale son camion en panne. On veut :
--   1) tracer QUI a signalé la panne (le garage doit le savoir) ;
--   2) pouvoir « libérer » le chauffeur (annuler sa désignation du jour) SANS
--      perdre la trace ni sa check-list du matin (ON DELETE CASCADE sur
--      checklists_depart interdit la suppression pure), et tout en lui
--      permettant d'être RE-désigné le même jour.
-- =============================================================================

-- 1. Qui a signalé la panne (chauffeur déclarant). Nullable : les pannes saisies
--    au bureau n'ont pas forcément de chauffeur.
alter table public.pannes
  add column if not exists chauffeur_id uuid references public.chauffeurs(id) on delete set null;

comment on column public.pannes.chauffeur_id is
  'Chauffeur ayant signalé la panne (déclaration PWA). NULL si saisie bureau.';

-- 2. Annulation d'une désignation (ex. « Camion en panne ») — on conserve la
--    ligne (et sa check-list) au lieu de la supprimer.
alter table public.designations
  add column if not exists annulee_at timestamptz,
  add column if not exists annulee_motif text;

comment on column public.designations.annulee_at is
  'Désignation annulée (ex. camion en panne) : conservée pour la trace, mais ne compte plus comme active. Cahier v8.';

-- 3. Les contraintes UNIQUE deviennent PARTIELLES : seules les désignations
--    ACTIVES (non annulées) sont uniques par (chauffeur, jour) et (matériel,
--    jour). Une désignation annulée peut donc coexister avec une nouvelle
--    désignation active le même jour (re-désignation après panne).
alter table public.designations drop constraint if exists designations_chauffeur_unique_par_jour;
alter table public.designations drop constraint if exists designations_materiel_unique_par_jour;

create unique index if not exists designations_chauffeur_unique_actif
  on public.designations (tenant_id, chauffeur_id, date_designation)
  where annulee_at is null;

create unique index if not exists designations_materiel_unique_actif
  on public.designations (tenant_id, materiel_roulant_id, date_designation)
  where annulee_at is null;
