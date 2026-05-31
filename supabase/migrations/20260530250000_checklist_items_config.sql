-- =============================================================================
-- PORTTRACK — Migration #19 : Items de check-list configurables par tenant
-- =============================================================================
-- Évolution de V3c : les 6 items figés (huile/pneus/feux/freins/rétros/docs)
-- deviennent configurables par chaque entreprise. Cas d'usage : un sous-traitant
-- peut ajouter « Pneu de secours », « Ridelles », ou retirer un item peu utile.
--
-- Conception :
--   * Table `checklist_items_config` (par tenant) : liste les items disponibles
--   * Table `checklist_responses` (par check-list) : 1 ligne par item répondu
--   * Drop des 6 colonnes `item_*` et de la colonne `statut_global` générée
--     (remplacée par une colonne texte normale + triggers de recalcul)
--   * Soft delete : `actif boolean` — les items retirés restent en DB et
--     référencés par les check-lists historiques (label préservé)
--   * Seed : chaque tenant existant et futur reçoit automatiquement les
--     6 items officiels du cahier §7.3
-- =============================================================================

-- 1. Table de configuration des items par tenant
create table public.checklist_items_config (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete restrict,

  -- Slug stable (ex. 'huile') — sert d'identifiant fonctionnel pour mapper
  -- les 6 items historiques du cahier vers leur config par tenant.
  code         text not null check (length(trim(code)) > 0 and length(code) <= 50),
  label        text not null check (length(trim(label)) > 0 and length(label) <= 150),

  -- Ordre d'affichage (numérique simple — pas de drag-and-drop).
  ordre        smallint not null default 100,

  -- Soft delete : un item retiré reste pour l'historique mais n'apparaît plus
  -- dans les nouveaux formulaires.
  actif        boolean not null default true,

  created_by   uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Le code est unique au sein d'un tenant (actif ou non — on ne ré-utilise
  -- pas un code supprimé). Comparaison insensible à la casse.
  constraint checklist_items_config_code_unique unique (tenant_id, code)
);

create index checklist_items_config_tenant_actif_idx
  on public.checklist_items_config (tenant_id, actif, ordre);

comment on table public.checklist_items_config is
  'Items de check-list configurables par tenant (cahier v7 §7.3 — version V3c-bis).';

create trigger checklist_items_config_set_updated_at
  before update on public.checklist_items_config
  for each row execute function public.set_updated_at();

-- 2. Table des réponses (1 ligne par item répondu pour une check-list)
create table public.checklist_responses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete restrict,
  checklist_id    uuid not null references public.checklists_depart(id) on delete cascade,
  -- RESTRICT : on ne hard-delete jamais un item utilisé. La table config
  -- utilise soft delete via `actif=false`.
  item_config_id  uuid not null references public.checklist_items_config(id) on delete restrict,
  etat            public.checklist_item_etat not null default 'OK',

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Au plus 1 réponse par (checklist, item)
  constraint checklist_responses_unique_par_item unique (checklist_id, item_config_id)
);

create index checklist_responses_checklist_idx on public.checklist_responses (checklist_id);
create index checklist_responses_item_idx      on public.checklist_responses (item_config_id);
create index checklist_responses_tenant_idx    on public.checklist_responses (tenant_id);

comment on table public.checklist_responses is
  'Réponses (OK / ANOMALIE) à chaque item d''une check-list de départ.';

create trigger checklist_responses_set_updated_at
  before update on public.checklist_responses
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. Refonte de `checklists_depart` : drop des 6 colonnes item_* et de la
--    colonne générée statut_global, remplacée par une colonne maintenue par
--    trigger.
-- =============================================================================

-- La colonne générée stored doit être droppée AVANT les colonnes qu'elle
-- référence.
alter table public.checklists_depart drop column statut_global;

alter table public.checklists_depart drop column item_huile;
alter table public.checklists_depart drop column item_pneus;
alter table public.checklists_depart drop column item_feux;
alter table public.checklists_depart drop column item_freins;
alter table public.checklists_depart drop column item_retros;
alter table public.checklists_depart drop column item_documents;

-- Nouvelle colonne statut_global maintenue par trigger
alter table public.checklists_depart
  add column statut_global text not null default 'FAITE'
  check (statut_global in ('FAITE', 'REMARQUE'));

-- L'index ancien sur statut_global est resté en place (même nom de colonne),
-- pas besoin de le recréer.

comment on column public.checklists_depart.statut_global is
  'FAITE ou REMARQUE — maintenu par triggers sur checklist_responses et sur la colonne remarque. NON_FAITE = absence de ligne.';

-- =============================================================================
-- 4. Fonction et triggers — maintien automatique de statut_global
-- =============================================================================

create or replace function public.recompute_checklist_statut(p_checklist_id uuid)
returns void
language plpgsql
as $$
declare
  v_has_anomalie boolean := false;
  v_has_remarque boolean := false;
begin
  select exists (
    select 1 from public.checklist_responses
     where checklist_id = p_checklist_id
       and etat = 'ANOMALIE'
  ) into v_has_anomalie;

  select (remarque is not null and length(trim(remarque)) > 0)
    into v_has_remarque
    from public.checklists_depart
   where id = p_checklist_id;

  -- Si la check-list a été supprimée (cascade), v_has_remarque restera NULL
  -- et l'UPDATE ne touchera rien.
  update public.checklists_depart
     set statut_global = case
       when coalesce(v_has_anomalie, false) or coalesce(v_has_remarque, false)
         then 'REMARQUE'
       else 'FAITE'
     end
   where id = p_checklist_id;
end;
$$;

-- 4.a Trigger sur checklist_responses : recalcul à chaque insert/update/delete
create or replace function public.tg_checklist_responses_recompute()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_checklist_statut(old.checklist_id);
    return old;
  else
    perform public.recompute_checklist_statut(new.checklist_id);
    return new;
  end if;
end;
$$;

create trigger checklist_responses_recompute_after_insert
  after insert on public.checklist_responses
  for each row execute function public.tg_checklist_responses_recompute();

create trigger checklist_responses_recompute_after_update
  after update on public.checklist_responses
  for each row execute function public.tg_checklist_responses_recompute();

create trigger checklist_responses_recompute_after_delete
  after delete on public.checklist_responses
  for each row execute function public.tg_checklist_responses_recompute();

-- 4.b Trigger sur checklists_depart : recalcul si remarque change
create or replace function public.tg_checklist_remarque_recompute()
returns trigger
language plpgsql
as $$
begin
  -- Seulement si remarque a effectivement changé
  if (new.remarque is distinct from old.remarque) then
    perform public.recompute_checklist_statut(new.id);
  end if;
  return new;
end;
$$;

create trigger checklists_depart_remarque_recompute
  after update of remarque on public.checklists_depart
  for each row execute function public.tg_checklist_remarque_recompute();

-- =============================================================================
-- 5. Seed des 6 items du cahier §7.3 pour un tenant
-- =============================================================================

create or replace function public.seed_checklist_items_for_tenant(p_tenant_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.checklist_items_config (tenant_id, code, label, ordre) values
    (p_tenant_id, 'huile',     'Niveau d''huile',                          10),
    (p_tenant_id, 'pneus',     'État visuel des pneus',                    20),
    (p_tenant_id, 'feux',      'Feux avant et arrière',                    30),
    (p_tenant_id, 'freins',    'Freins',                                   40),
    (p_tenant_id, 'retros',    'Rétroviseurs',                             50),
    (p_tenant_id, 'documents', 'Documents à bord (permis, carte grise…)',  60)
  on conflict on constraint checklist_items_config_code_unique do nothing;
end;
$$;

-- Seed initial des tenants existants
do $$
declare
  t record;
begin
  for t in select id from public.tenants loop
    perform public.seed_checklist_items_for_tenant(t.id);
  end loop;
end;
$$;

-- Trigger AFTER INSERT sur tenants : seed automatique des nouveaux tenants
create or replace function public.tg_tenants_seed_checklist_items()
returns trigger
language plpgsql
as $$
begin
  perform public.seed_checklist_items_for_tenant(new.id);
  return new;
end;
$$;

create trigger tenants_seed_checklist_items_after_insert
  after insert on public.tenants
  for each row execute function public.tg_tenants_seed_checklist_items();

-- =============================================================================
-- 6. RLS — isolement tenant
-- =============================================================================

alter table public.checklist_items_config enable row level security;
alter table public.checklist_responses    enable row level security;

-- checklist_items_config — lecture pour tous les users du tenant,
-- écriture réservée MANAGER + SUPER_ADMIN
create policy "checklist_items_config_select_same_tenant_or_super"
  on public.checklist_items_config for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklist_items_config_insert_manager_or_super"
  on public.checklist_items_config for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

create policy "checklist_items_config_update_manager_or_super"
  on public.checklist_items_config for update to authenticated
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  )
  with check (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

create policy "checklist_items_config_delete_manager_or_super"
  on public.checklist_items_config for delete to authenticated
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );

-- checklist_responses — mêmes droits que sur checklists_depart
create policy "checklist_responses_select_same_tenant_or_super"
  on public.checklist_responses for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklist_responses_insert_same_tenant"
  on public.checklist_responses for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklist_responses_update_same_tenant"
  on public.checklist_responses for update to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id())
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "checklist_responses_delete_same_tenant"
  on public.checklist_responses for delete to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

grant select, insert, update, delete on public.checklist_items_config to authenticated;
grant select, insert, update, delete on public.checklist_responses    to authenticated;
