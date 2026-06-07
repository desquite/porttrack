-- =============================================================================
-- Migration #32 — Récupération des vides (fermeture du cycle import)
-- =============================================================================
-- Après livraison, le conteneur (vide) doit être RÉCUPÉRÉ chez le client et
-- ramené vers un parc aconier ou un terminal. C'est une vraie opération de
-- transport : les Opérations la PLANIFIENT (camion + chauffeur), le chauffeur
-- l'exécute et la CONFIRME (preuve / EIR + lieu de dépôt).
--
-- On NE TOUCHE PAS l'enum `conteneur_statut` (EN_ATTENTE/EN_COURS/LIVRE/ANNULE).
-- L'état de récupération est DÉRIVÉ via cette table :
--   * conteneur LIVRE sans récupération active        → « à récupérer »
--   * récupération PLANIFIEE                           → « récupération planifiée »
--   * récupération CONFIRMEE                           → « récupéré » (cycle fermé)
-- Un conteneur livré ET récupéré est verrouillé (plus aucune planification).
-- =============================================================================

create table public.recuperations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  conteneur_id    uuid not null references public.conteneurs(id) on delete restrict,

  -- PLANIFIEE → CONFIRMEE (ou ANNULEE pour repartir sur une nouvelle planif)
  statut          text not null default 'PLANIFIEE'
                    check (statut in ('PLANIFIEE', 'CONFIRMEE', 'ANNULEE')),

  -- Planification (affectation de la mission de récupération)
  chauffeur_id    uuid references public.chauffeurs(id) on delete set null,
  tracteur_id     uuid references public.materiel_roulant(id) on delete set null,
  remorque_id     uuid references public.materiel_roulant(id) on delete set null,
  date_planifiee  date,

  -- Destination du vide : parc aconier ou terminal (lieu en saisie libre)
  destination_type text check (destination_type in ('PARC_ACONIER', 'TERMINAL')),
  destination_lieu text,

  -- Confirmation par le chauffeur (preuve + date réelle)
  date_recuperation date,
  eir_url         text,
  eir_nom         text,

  -- Snapshots (restent lisibles même si chauffeur/matériel supprimés ensuite)
  chauffeur_nom   text,
  tracteur_immat  text,
  remorque_immat  text,

  created_by      uuid references public.users(id) on delete set null,
  confirmed_by    uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Une seule récupération ACTIVE (non annulée) par conteneur → empêche les
-- doubles planifications. Une annulée peut coexister (re-planification).
create unique index recuperations_conteneur_active_idx
  on public.recuperations (conteneur_id)
  where statut <> 'ANNULEE';

create index recuperations_tenant_statut_idx on public.recuperations (tenant_id, statut);
create index recuperations_chauffeur_idx     on public.recuperations (chauffeur_id) where chauffeur_id is not null;

comment on table public.recuperations is
  'Récupération du vide après livraison (fermeture du cycle import). Planifiée par les Opérations, confirmée par le chauffeur.';

-- updated_at auto (fonction set_updated_at déjà présente dans le projet)
create trigger set_recuperations_updated_at
  before update on public.recuperations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — utilisateurs bureau (par tenant) + chauffeur (ses propres missions)
-- =============================================================================

alter table public.recuperations enable row level security;

-- Bureau : lecture / écriture sur son tenant (SUPER_ADMIN bypass)
create policy "recuperations_select_same_tenant_or_super"
  on public.recuperations for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "recuperations_insert_same_tenant"
  on public.recuperations for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "recuperations_update_same_tenant"
  on public.recuperations for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

-- Suppression réservée MANAGER+ (cohérent avec le reste) : pas de policy delete
-- pour les non-privilégiés (on annule via statut = ANNULEE).

-- Chauffeur : voit et confirme SES récupérations
create policy "recuperations_driver_select_own"
  on public.recuperations for select to authenticated
  using (chauffeur_id = public.current_chauffeur_id());

create policy "recuperations_driver_update_own"
  on public.recuperations for update to authenticated
  using (chauffeur_id = public.current_chauffeur_id())
  with check (chauffeur_id = public.current_chauffeur_id());

grant select, insert, update on public.recuperations to authenticated;
