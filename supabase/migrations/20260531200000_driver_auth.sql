-- =============================================================================
-- PORTTRACK — Migration #25 : Fondation auth chauffeur (PWA Phase 5)
-- =============================================================================
-- Les chauffeurs se connectent à la PWA par téléphone + OTP (envoyé via
-- WhatsApp). Ils ne sont PAS des utilisateurs "métier" (public.users) : leur
-- accès passe par un lien direct chauffeurs.auth_user_id → auth.users.
--
-- Matching téléphone : on réutilise la logique du bot (8 derniers chiffres,
-- cœur abonné CI), car le format saisi (0709…) ≠ format Supabase (+22507…).
--
-- RLS : un chauffeur ne voit QUE ses désignations, ses livraisons, son
-- matériel/tenant et ses collègues d'équipe. Les policies sont ADDITIVES :
-- pour un user métier (manager), les helpers renvoient NULL → aucun accès
-- supplémentaire accordé.
-- =============================================================================

-- 1. Lien chauffeur ↔ compte auth
alter table public.chauffeurs
  add column auth_user_id uuid references auth.users(id) on delete set null;

create unique index chauffeurs_auth_user_id_key
  on public.chauffeurs (auth_user_id) where auth_user_id is not null;

comment on column public.chauffeurs.auth_user_id is
  'Compte auth (connexion PWA par téléphone/OTP). Lié automatiquement au 1er login par matching du cœur téléphone.';

-- =============================================================================
-- 2. handle_new_user : ignorer les signups SANS email (chauffeurs par phone)
--    car public.users.email est NOT NULL → un signup phone casserait le trigger.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_role      public.user_role;
begin
  -- Connexion chauffeur (téléphone, pas d'email) → pas de ligne public.users.
  -- Son accès se fait via chauffeurs.auth_user_id.
  if new.email is null then
    return new;
  end if;

  v_tenant_id := nullif(new.raw_app_meta_data ->> 'tenant_id', '')::uuid;
  v_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role,
    'CUSTOM'
  );

  insert into public.users (id, tenant_id, email, role)
  values (new.id, v_tenant_id, new.email, v_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- =============================================================================
-- 3. Lien automatique chauffeur ↔ auth au signup par téléphone
-- =============================================================================

create or replace function public.link_chauffeur_on_phone_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_core text;
begin
  if new.phone is null then
    return new;
  end if;
  v_core := right(regexp_replace(new.phone, '\D', '', 'g'), 8);

  update public.chauffeurs
     set auth_user_id = new.id
   where auth_user_id is null
     and (
       right(regexp_replace(telephone, '\D', '', 'g'), 8) = v_core
       or right(regexp_replace(coalesce(telephone_secondaire, ''), '\D', '', 'g'), 8) = v_core
     );

  return new;
end;
$$;

drop trigger if exists on_auth_phone_signup on auth.users;
create trigger on_auth_phone_signup
  after insert on auth.users
  for each row execute function public.link_chauffeur_on_phone_signup();

comment on function public.link_chauffeur_on_phone_signup() is
  'Au 1er login téléphone, relie le compte auth au chauffeur dont le cœur téléphone (8 derniers chiffres) correspond.';

-- =============================================================================
-- 4. Helpers RLS chauffeur (security definer pour lire chauffeurs sans récursion)
-- =============================================================================

create or replace function public.current_chauffeur_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.chauffeurs where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_chauffeur_tenant()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.chauffeurs where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_chauffeur_equipe()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select equipe_id_defaut from public.chauffeurs where auth_user_id = auth.uid() limit 1;
$$;

grant execute on function public.current_chauffeur_id()     to authenticated;
grant execute on function public.current_chauffeur_tenant()  to authenticated;
grant execute on function public.current_chauffeur_equipe()  to authenticated;

-- =============================================================================
-- 5. Policies RLS chauffeur (lecture seule pour cette fondation)
-- =============================================================================

-- 5.1 chauffeurs : soi-même + collègues de la même équipe (même tenant)
create policy "chauffeurs_driver_self_and_team"
  on public.chauffeurs for select to authenticated
  using (
    auth_user_id = auth.uid()
    or (
      tenant_id = public.current_chauffeur_tenant()
      and equipe_id_defaut is not distinct from public.current_chauffeur_equipe()
    )
  );

-- 5.2 designations : ses propres désignations
create policy "designations_driver_own"
  on public.designations for select to authenticated
  using (chauffeur_id = public.current_chauffeur_id());

-- 5.3 equipes : les équipes de son tenant (nom + horaires)
create policy "equipes_driver_tenant"
  on public.equipes for select to authenticated
  using (tenant_id = public.current_chauffeur_tenant());

-- 5.4 materiel_roulant : le matériel de son tenant (son camion + docs)
create policy "materiel_driver_tenant"
  on public.materiel_roulant for select to authenticated
  using (tenant_id = public.current_chauffeur_tenant());

-- 5.5 affectations : ses propres affectations
create policy "affectations_driver_own"
  on public.affectations for select to authenticated
  using (chauffeur_id = public.current_chauffeur_id());

-- 5.6 conteneurs : ceux qui lui sont affectés (ses livraisons)
create policy "conteneurs_driver_assigned"
  on public.conteneurs for select to authenticated
  using (
    id in (
      select conteneur_id from public.affectations
       where chauffeur_id = public.current_chauffeur_id()
    )
  );

-- 5.7 eir_archives : les EIR de ses livraisons
create policy "eir_driver_own"
  on public.eir_archives for select to authenticated
  using (
    chauffeur_id = public.current_chauffeur_id()
    or affectation_id in (
      select id from public.affectations where chauffeur_id = public.current_chauffeur_id()
    )
  );

-- 5.8 checklists_depart : les siennes (lecture + écriture pour la saisie PWA)
create policy "checklists_driver_select_own"
  on public.checklists_depart for select to authenticated
  using (chauffeur_id = public.current_chauffeur_id());
create policy "checklists_driver_insert_own"
  on public.checklists_depart for insert to authenticated
  with check (chauffeur_id = public.current_chauffeur_id());
create policy "checklists_driver_update_own"
  on public.checklists_depart for update to authenticated
  using (chauffeur_id = public.current_chauffeur_id())
  with check (chauffeur_id = public.current_chauffeur_id());

-- 5.9 checklist_items_config : items actifs de son tenant (pour le formulaire)
create policy "checklist_items_driver_tenant"
  on public.checklist_items_config for select to authenticated
  using (tenant_id = public.current_chauffeur_tenant());

-- 5.10 checklist_responses : les réponses de ses check-lists (lecture + écriture)
create policy "checklist_responses_driver_select"
  on public.checklist_responses for select to authenticated
  using (tenant_id = public.current_chauffeur_tenant()
         and checklist_id in (select id from public.checklists_depart where chauffeur_id = public.current_chauffeur_id()));
create policy "checklist_responses_driver_insert"
  on public.checklist_responses for insert to authenticated
  with check (tenant_id = public.current_chauffeur_tenant()
              and checklist_id in (select id from public.checklists_depart where chauffeur_id = public.current_chauffeur_id()));
