-- =============================================================================
-- PORTTRACK — Migration #20 : Traçabilité & historique des modifications (§9)
-- =============================================================================
-- Toute modification d'une donnée opérationnelle sensible (lieu de livraison,
-- type de visite douane, mode de livraison, date BADT, etc.) doit :
--   1) être justifiée par un fichier documentaire (PDF/JPG/PNG/HEIC, 10 Mo max)
--   2) être accompagnée d'un motif texte
--   3) générer une entrée d'historique IMMUABLE
--
-- Règle d'immuabilité (cahier §8.4 RÈGLE 3) : personne — y compris le
-- SUPER_ADMIN — ne peut modifier ou supprimer une entrée d'historique.
-- On la garantit à deux niveaux :
--   * RLS : aucune policy UPDATE ni DELETE (donc bloqué pour `authenticated`)
--   * Triggers BEFORE UPDATE/DELETE qui lèvent une exception (bloque même
--     le service_role / propriétaire de table — défense en profondeur)
-- =============================================================================

create table public.modifications_historique (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete restrict,

  -- Cible de la modification (générique, pilotée par un registre côté code)
  table_cible        text not null,   -- ex. 'conteneurs'
  enregistrement_id  uuid not null,   -- id de la ligne modifiée
  champ              text not null,   -- nom technique de la colonne (ex. 'date_badt')
  champ_label        text not null,   -- libellé humain figé au moment de la modif

  -- Valeurs (stockées en texte pour rester génériques)
  valeur_avant       text,
  valeur_apres       text,

  -- Justification obligatoire
  motif              text not null check (length(trim(motif)) > 0),
  justificatif_url   text not null,   -- chemin Storage (bucket documents)
  justificatif_nom   text,

  -- Auteur (snapshot de l'email pour rester lisible si l'utilisateur est supprimé)
  user_id            uuid references public.users(id) on delete set null,
  user_email         text,

  -- Horodatage serveur, non modifiable côté client
  created_at         timestamptz not null default now()
);

create index modifications_historique_tenant_date_idx
  on public.modifications_historique (tenant_id, created_at desc);
create index modifications_historique_cible_idx
  on public.modifications_historique (table_cible, enregistrement_id, created_at desc);

comment on table public.modifications_historique is
  'Journal IMMUABLE des modifications de données sensibles (cahier v7 §9). Append-only : aucun UPDATE/DELETE possible.';

-- =============================================================================
-- Immuabilité : triggers qui bloquent toute mutation
-- =============================================================================

create or replace function public.block_historique_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Historique immuable : modification et suppression interdites (cahier §8.4 RÈGLE 3).';
end;
$$;

create trigger modifications_historique_block_update
  before update on public.modifications_historique
  for each row execute function public.block_historique_mutation();

create trigger modifications_historique_block_delete
  before delete on public.modifications_historique
  for each row execute function public.block_historique_mutation();

-- =============================================================================
-- RLS — lecture pour le tenant (tous rôles), insertion pour le tenant.
-- PAS de policy UPDATE/DELETE → mutations refusées par défaut.
-- =============================================================================

alter table public.modifications_historique enable row level security;

create policy "modifications_historique_select_same_tenant_or_super"
  on public.modifications_historique for select to authenticated
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

create policy "modifications_historique_insert_same_tenant"
  on public.modifications_historique for insert to authenticated
  with check (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

-- On accorde uniquement select + insert (jamais update/delete)
grant select, insert on public.modifications_historique to authenticated;
