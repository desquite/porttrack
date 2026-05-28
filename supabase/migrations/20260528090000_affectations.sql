-- =============================================================================
-- PORTTRACK — Migration #7 : table affectations
-- =============================================================================
-- Une affectation lie les 3 entités opérationnelles :
--   conteneur (quoi livrer) + chauffeur (qui) + tracteur (+ remorque)
-- avec un cycle de vie (planifiée → en cours → terminée) et des dates/km.
--
-- C'est le workflow central : le dispatcher affecte un chauffeur et un
-- véhicule à un conteneur, suit le départ et le retour.
-- =============================================================================

-- =============================================================================
-- 1. Enum statut
-- =============================================================================

create type public.affectation_statut as enum (
  'PLANIFIEE',  -- Affectation créée, départ à venir
  'EN_COURS',   -- Camion parti avec le conteneur
  'TERMINEE',   -- Livraison effectuée, véhicule rentré
  'ANNULEE'     -- Affectation annulée
);

-- =============================================================================
-- 2. Table affectations
-- =============================================================================

create table public.affectations (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete restrict,

  -- Liens métier
  conteneur_id           uuid not null references public.conteneurs(id) on delete cascade,
  chauffeur_id           uuid references public.chauffeurs(id) on delete set null,
  tracteur_id            uuid references public.materiel_roulant(id) on delete set null,
  remorque_id            uuid references public.materiel_roulant(id) on delete set null,

  -- Dates
  date_affectation       date not null default current_date,
  date_depart_prevue     timestamptz,
  date_depart_reelle     timestamptz,
  date_retour            timestamptz,

  -- Relevés kilométriques (pour suivi conso/maintenance)
  km_depart              numeric(10, 0),
  km_retour              numeric(10, 0),

  -- Statut
  statut                 public.affectation_statut not null default 'PLANIFIEE',

  -- Métadonnées
  notes                  text,
  created_by             uuid references public.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- km_retour doit être >= km_depart s'ils sont tous deux renseignés
  constraint affectations_km_coherent
    check (km_depart is null or km_retour is null or km_retour >= km_depart)
);

-- =============================================================================
-- 3. Index
-- =============================================================================

create index affectations_tenant_id_idx on public.affectations (tenant_id);
create index affectations_conteneur_idx on public.affectations (conteneur_id);
create index affectations_chauffeur_idx on public.affectations (chauffeur_id);
create index affectations_tracteur_idx on public.affectations (tracteur_id);
create index affectations_tenant_statut_idx on public.affectations (tenant_id, statut);

-- Affectations actives (planifiées/en cours) triées par date — vue dispatcher
create index affectations_actives_idx
  on public.affectations (tenant_id, date_affectation desc)
  where statut in ('PLANIFIEE', 'EN_COURS');

comment on table public.affectations is
  'Lie conteneur + chauffeur + matériel avec cycle de vie. Workflow central dispatcher.';

-- =============================================================================
-- 4. Trigger : cohérence tenant cross-FK
-- =============================================================================
-- Garantit que conteneur, chauffeur, tracteur et remorque appartiennent
-- TOUS au même tenant que l'affectation. Les FK seules ne le garantissent
-- pas (elles ignorent la RLS). SECURITY DEFINER pour lire les tables
-- référencées sans être bloqué par leur RLS.

create or replace function public.check_affectation_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
begin
  -- Conteneur (obligatoire)
  select tenant_id into v_tenant from public.conteneurs where id = new.conteneur_id;
  if v_tenant is null or v_tenant <> new.tenant_id then
    raise exception 'Le conteneur n''appartient pas à ce tenant';
  end if;

  -- Chauffeur (optionnel)
  if new.chauffeur_id is not null then
    select tenant_id into v_tenant from public.chauffeurs where id = new.chauffeur_id;
    if v_tenant is null or v_tenant <> new.tenant_id then
      raise exception 'Le chauffeur n''appartient pas à ce tenant';
    end if;
  end if;

  -- Tracteur (optionnel)
  if new.tracteur_id is not null then
    select tenant_id into v_tenant from public.materiel_roulant where id = new.tracteur_id;
    if v_tenant is null or v_tenant <> new.tenant_id then
      raise exception 'Le tracteur n''appartient pas à ce tenant';
    end if;
  end if;

  -- Remorque (optionnel)
  if new.remorque_id is not null then
    select tenant_id into v_tenant from public.materiel_roulant where id = new.remorque_id;
    if v_tenant is null or v_tenant <> new.tenant_id then
      raise exception 'La remorque n''appartient pas à ce tenant';
    end if;
  end if;

  return new;
end;
$$;

create trigger affectations_check_tenant
  before insert or update on public.affectations
  for each row execute function public.check_affectation_tenant();

-- =============================================================================
-- 5. Trigger updated_at
-- =============================================================================

create trigger affectations_set_updated_at
  before update on public.affectations
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 6. RLS
-- =============================================================================

alter table public.affectations enable row level security;

create policy "affectations_select_same_tenant_or_super"
  on public.affectations for select
  to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "affectations_insert_same_tenant"
  on public.affectations for insert
  to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "affectations_update_same_tenant"
  on public.affectations for update
  to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "affectations_delete_manager_or_super"
  on public.affectations for delete
  to authenticated
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

-- =============================================================================
-- 7. Grants
-- =============================================================================

grant select, insert, update, delete on public.affectations to authenticated;
