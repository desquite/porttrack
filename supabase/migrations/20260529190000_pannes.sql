-- =============================================================================
-- PORTTRACK — Migration #12 : module Pannes (cahier v7 §8.6 / OR §5.2)
-- =============================================================================
-- Une « panne » = une intervention sur un matériel roulant (Ordre de Réparation).
-- Workflow : Déclarée → En réparation → Réparée (avec ANNULEE pour les fausses
-- alertes). Tant qu'au moins une panne est ouverte sur un matériel, ce dernier
-- passe automatiquement en EN_PANNE et n'est plus sélectionnable pour une
-- affectation. À la clôture de la dernière panne, le matériel repasse en
-- EN_SERVICE — sauf si son état est INDISPONIBLE (accident), HORS_SERVICE ou
-- VENDU, qui sont prioritaires et ne doivent pas être écrasés.
-- =============================================================================

-- 1. Enum statut de panne
create type public.panne_statut as enum (
  'DECLAREE',
  'EN_REPARATION',
  'REPAREE',
  'ANNULEE'
);

-- 2. Table pannes
create table public.pannes (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete restrict,
  materiel_roulant_id     uuid not null references public.materiel_roulant(id) on delete restrict,

  date_declaration        date not null default current_date,
  description             text not null,
  type_panne              text,                         -- catégorie libre (mécanique, électrique, pneu…)

  garage                  text,
  date_debut_reparation   date,
  date_fin_reparation     date,
  cout_estime_fcfa        numeric(12, 0),
  cout_reel_fcfa          numeric(12, 0),

  facture_url             text,
  facture_nom             text,

  statut                  public.panne_statut not null default 'DECLAREE',

  notes                   text,
  created_by              uuid references public.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index pannes_tenant_idx          on public.pannes (tenant_id);
create index pannes_tenant_statut_idx   on public.pannes (tenant_id, statut);
create index pannes_materiel_idx        on public.pannes (materiel_roulant_id);
create index pannes_tenant_date_idx     on public.pannes (tenant_id, date_declaration desc);

comment on table public.pannes is
  'Pannes / Ordres de Réparation (OR) sur le matériel roulant. Synchronise l''état du MR via trigger.';

-- 3. Trigger updated_at
create trigger pannes_set_updated_at
  before update on public.pannes
  for each row execute function public.set_updated_at();

-- 4. RLS — isolement tenant (même schéma que les autres tables métier)
alter table public.pannes enable row level security;

create policy "pannes_select_same_tenant_or_super"
  on public.pannes for select
  to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "pannes_insert_same_tenant"
  on public.pannes for insert
  to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "pannes_update_same_tenant"
  on public.pannes for update
  to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "pannes_delete_manager_or_super"
  on public.pannes for delete
  to authenticated
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

grant select, insert, update, delete on public.pannes to authenticated;

-- =============================================================================
-- 5. Synchronisation automatique de materiel_roulant.etat
-- =============================================================================
-- Le trigger recalcule l'état du MR après chaque insertion / mise à jour /
-- suppression de panne :
--   • Au moins 1 panne ouverte (Déclarée OU En réparation) → MR.etat = EN_PANNE
--     (sauf si l'état actuel est INDISPONIBLE / HORS_SERVICE / VENDU, qui
--     priment).
--   • Plus aucune panne ouverte → si MR.etat = EN_PANNE, le repasser en
--     EN_SERVICE.
-- Sur UPDATE qui change le matériel_roulant_id (rare), on synchronise les deux
-- MR concernés (ancien et nouveau).
-- =============================================================================

create or replace function public.sync_materiel_etat_for_panne(p_mr_id uuid)
returns void
language plpgsql
as $$
declare
  v_open_count int;
  v_current_etat public.materiel_etat;
begin
  if p_mr_id is null then return; end if;

  select etat into v_current_etat from public.materiel_roulant where id = p_mr_id;
  if v_current_etat is null then return; end if; -- MR supprimé

  select count(*) into v_open_count
    from public.pannes
   where materiel_roulant_id = p_mr_id
     and statut in ('DECLAREE', 'EN_REPARATION');

  if v_open_count > 0 then
    if v_current_etat not in ('INDISPONIBLE', 'HORS_SERVICE', 'VENDU') then
      update public.materiel_roulant set etat = 'EN_PANNE' where id = p_mr_id;
    end if;
  else
    if v_current_etat = 'EN_PANNE' then
      update public.materiel_roulant set etat = 'EN_SERVICE' where id = p_mr_id;
    end if;
  end if;
end;
$$;

create or replace function public.sync_materiel_etat_from_pannes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sync_materiel_etat_for_panne(new.materiel_roulant_id);
  elsif tg_op = 'DELETE' then
    perform public.sync_materiel_etat_for_panne(old.materiel_roulant_id);
  elsif tg_op = 'UPDATE' then
    perform public.sync_materiel_etat_for_panne(new.materiel_roulant_id);
    if old.materiel_roulant_id is distinct from new.materiel_roulant_id then
      perform public.sync_materiel_etat_for_panne(old.materiel_roulant_id);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger pannes_sync_materiel_etat
  after insert or update or delete on public.pannes
  for each row execute function public.sync_materiel_etat_from_pannes();

comment on function public.sync_materiel_etat_for_panne(uuid) is
  'Recalcule materiel_roulant.etat selon les pannes ouvertes. INDISPONIBLE/HORS_SERVICE/VENDU priment sur EN_PANNE.';
