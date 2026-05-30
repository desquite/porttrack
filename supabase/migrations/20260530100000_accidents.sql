-- =============================================================================
-- PORTTRACK — Migration #13 : module Accidents & Sinistres (cahier v7 §5.2)
-- =============================================================================
-- Un accident sur un matériel roulant entraîne automatiquement :
--   1) la création d'un Ordre de Réparation (OR) dans la table `pannes`,
--      lié à l'accident via accidents.panne_id ;
--   2) le passage du matériel en statut INDISPONIBLE (priorité absolue —
--      ne peut être écrasé par EN_PANNE, voir trigger sync_materiel_etat des
--      pannes).
--
-- À la clôture de l'accident (statut CLOTURE), si plus aucun accident ouvert
-- ET aucune panne ouverte pour ce matériel → retour automatique en EN_SERVICE.
-- =============================================================================

-- 1. Enum statut accident
create type public.accident_statut as enum (
  'DECLARE',
  'EN_COURS_TRAITEMENT',
  'CLOTURE'
);

-- 2. Table accidents
create table public.accidents (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete restrict,
  materiel_roulant_id         uuid not null references public.materiel_roulant(id) on delete restrict,
  chauffeur_id                uuid references public.chauffeurs(id) on delete set null,

  date_accident               timestamptz not null,
  lieu_accident               text,
  circonstances               text not null,
  tiers_implique              boolean not null default false,

  -- Documents (uploads)
  constat_url                 text,
  constat_nom                 text,
  quittance_url               text,
  quittance_nom               text,

  -- Suivi assurance
  assurance_ref               text,
  date_declaration_assurance  date,
  franchise_fcfa              numeric(12, 0),
  remboursement_fcfa          numeric(12, 0),

  -- Lien vers l'Ordre de Réparation (créé automatiquement)
  panne_id                    uuid references public.pannes(id) on delete set null,

  statut                      public.accident_statut not null default 'DECLARE',

  notes                       text,
  created_by                  uuid references public.users(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index accidents_tenant_idx        on public.accidents (tenant_id);
create index accidents_tenant_statut_idx on public.accidents (tenant_id, statut);
create index accidents_materiel_idx      on public.accidents (materiel_roulant_id);
create index accidents_chauffeur_idx     on public.accidents (chauffeur_id) where chauffeur_id is not null;
create index accidents_tenant_date_idx   on public.accidents (tenant_id, date_accident desc);

comment on table public.accidents is
  'Accidents et sinistres impliquant un matériel roulant. Crée auto un OR (pannes) et passe le MR en INDISPONIBLE.';

-- 3. Table accident_photos (un accident peut avoir plusieurs photos de dégâts)
create table public.accident_photos (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,
  accident_id  uuid not null references public.accidents(id) on delete cascade,
  photo_url    text not null,
  photo_nom    text,
  uploaded_by  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index accident_photos_accident_idx on public.accident_photos (accident_id);
create index accident_photos_tenant_idx   on public.accident_photos (tenant_id);

-- 4. Triggers updated_at
create trigger accidents_set_updated_at
  before update on public.accidents
  for each row execute function public.set_updated_at();

-- 5. RLS
alter table public.accidents       enable row level security;
alter table public.accident_photos enable row level security;

-- accidents
create policy "accidents_select_same_tenant_or_super"
  on public.accidents for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "accidents_insert_same_tenant"
  on public.accidents for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "accidents_update_same_tenant"
  on public.accidents for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "accidents_delete_manager_or_super"
  on public.accidents for delete to authenticated
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

-- accident_photos
create policy "accident_photos_select_same_tenant_or_super"
  on public.accident_photos for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "accident_photos_insert_same_tenant"
  on public.accident_photos for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());
create policy "accident_photos_delete_same_tenant"
  on public.accident_photos for delete to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

grant select, insert, update, delete on public.accidents       to authenticated;
grant select, insert, delete         on public.accident_photos to authenticated;

-- =============================================================================
-- 6. Création automatique de l'OR à la déclaration d'un accident
-- =============================================================================
-- Trigger BEFORE INSERT : si new.panne_id est null, on crée une panne
-- (Ordre de Réparation) liée et on assigne new.panne_id avant écriture.
-- L'insertion dans `pannes` déclenchera son propre trigger qui passera le MR
-- en EN_PANNE — qu'on écrase ensuite en INDISPONIBLE (état prioritaire).
-- =============================================================================

create or replace function public.accident_create_or()
returns trigger
language plpgsql
as $$
declare
  v_panne_id uuid;
begin
  if new.panne_id is null then
    insert into public.pannes (
      tenant_id, materiel_roulant_id, date_declaration,
      description, type_panne, statut, created_by
    ) values (
      new.tenant_id,
      new.materiel_roulant_id,
      coalesce(new.date_accident::date, current_date),
      'Réparation suite accident — ' || coalesce(new.circonstances, 'détails dans le dossier accident'),
      'Accident',
      'DECLAREE',
      new.created_by
    )
    returning id into v_panne_id;
    new.panne_id := v_panne_id;
  end if;

  -- Le matériel passe en INDISPONIBLE (priorité sur EN_PANNE et EN_SERVICE)
  update public.materiel_roulant
     set etat = 'INDISPONIBLE'
   where id = new.materiel_roulant_id
     and etat not in ('INDISPONIBLE', 'HORS_SERVICE', 'VENDU');

  return new;
end;
$$;

create trigger accidents_create_or_before_insert
  before insert on public.accidents
  for each row execute function public.accident_create_or();

-- =============================================================================
-- 7. Synchronisation de l'état matériel sur changement de statut accident
-- =============================================================================

create or replace function public.accident_sync_materiel_etat()
returns trigger
language plpgsql
as $$
declare
  v_open_accidents int;
  v_open_pannes    int;
  v_current_etat   public.materiel_etat;
begin
  -- Passage à CLOTURE : tenter de remettre en EN_SERVICE si plus rien d'ouvert
  if new.statut = 'CLOTURE' and old.statut is distinct from 'CLOTURE' then
    select count(*) into v_open_accidents
      from public.accidents
     where materiel_roulant_id = new.materiel_roulant_id
       and statut in ('DECLARE', 'EN_COURS_TRAITEMENT')
       and id <> new.id;

    select count(*) into v_open_pannes
      from public.pannes
     where materiel_roulant_id = new.materiel_roulant_id
       and statut in ('DECLAREE', 'EN_REPARATION');

    if v_open_accidents = 0 and v_open_pannes = 0 then
      select etat into v_current_etat from public.materiel_roulant where id = new.materiel_roulant_id;
      if v_current_etat in ('INDISPONIBLE', 'EN_PANNE') then
        update public.materiel_roulant set etat = 'EN_SERVICE' where id = new.materiel_roulant_id;
      end if;
    end if;
  end if;

  -- Ré-ouverture d'un accident clos : remettre INDISPONIBLE
  if old.statut = 'CLOTURE' and new.statut in ('DECLARE', 'EN_COURS_TRAITEMENT') then
    update public.materiel_roulant
       set etat = 'INDISPONIBLE'
     where id = new.materiel_roulant_id
       and etat not in ('INDISPONIBLE', 'HORS_SERVICE', 'VENDU');
  end if;

  return new;
end;
$$;

create trigger accidents_sync_materiel_etat
  after update on public.accidents
  for each row execute function public.accident_sync_materiel_etat();
