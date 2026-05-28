-- =============================================================================
-- PORTTRACK — Migration #6 : table conteneurs
-- =============================================================================
-- Cœur opérationnel : le suivi des conteneurs depuis leur arrivée au Port
-- d'Abidjan jusqu'à leur livraison chez le client / dans l'hinterland.
--
-- Référence les catalogues partagés (shipping_lines, types_conteneur,
-- port_codes) en clé étrangère pour garantir des données propres et
-- permettre les agrégations.
--
-- Dates clés métier PAA :
--   - date_do    : Délivrance de l'Ordre (douane)
--   - date_badt  : Bon À Délivrer Transitaire — JALON CRITIQUE. Une fois le
--                  BADT émis, le conteneur DOIT sortir du port dans un délai
--                  imparti sinon surestaries (penalités). D'où les alertes.
--   - livraison  : prévue vs réelle
-- =============================================================================

-- =============================================================================
-- 1. Enum statut conteneur
-- =============================================================================

create type public.conteneur_statut as enum (
  'EN_ATTENTE',   -- Arrivé au port, en attente de traitement
  'EN_COURS',     -- BADT émis / en cours d'acheminement
  'LIVRE',        -- Livré au client / destination finale
  'ANNULE'        -- Annulé / retourné
);

-- =============================================================================
-- 2. Table conteneurs
-- =============================================================================

create table public.conteneurs (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete restrict,

  -- Identification ISO 6346 (ex. MSCU1234567)
  numero                 text not null,
  type_conteneur_id      uuid references public.types_conteneur(id) on delete set null,
  shipping_line_id       uuid references public.shipping_lines(id) on delete set null,

  -- Documents commerciaux / douaniers
  numero_bl              text,            -- Bill of Lading
  num_declaration        text,            -- numéro de déclaration en douane
  type_visite            text,            -- circuit douanier (vert/jaune/rouge…)

  -- Acteurs
  client                 text,            -- importateur / exportateur final
  transitaire            text,            -- commissionnaire en douane

  -- Logistique
  origine_id             uuid references public.port_codes(id) on delete set null,
  destination_id         uuid references public.port_codes(id) on delete set null,
  destination_libre      text,            -- si destination hors catalogue port_codes
  marchandise            text,
  poids_kg               numeric(10, 2),
  plomb                  text,            -- numéro de plomb / seal
  navire_voyage          text,            -- nom du navire + n° voyage

  -- Dates critiques
  date_do                date,            -- Délivrance Ordre (douane)
  date_badt              timestamptz,     -- Bon À Délivrer Transitaire (jalon critique)
  date_livraison_prevue  date,
  date_livraison_reelle  date,

  -- Statut
  statut                 public.conteneur_statut not null default 'EN_ATTENTE',

  -- Métadonnées
  notes                  text,
  created_by             uuid references public.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- Le numéro de conteneur est unique par tenant
  constraint conteneurs_numero_unique_per_tenant unique (tenant_id, numero)
);

-- =============================================================================
-- 3. Index
-- =============================================================================

-- RLS : toutes les policies filtrent sur tenant_id
create index conteneurs_tenant_id_idx on public.conteneurs (tenant_id);

-- Filtrage liste par statut
create index conteneurs_tenant_statut_idx
  on public.conteneurs (tenant_id, statut);

-- Alertes BADT : conteneurs avec BADT émis mais pas encore livrés, triés par
-- ancienneté du BADT (les plus vieux = risque de surestaries imminent)
create index conteneurs_badt_idx
  on public.conteneurs (tenant_id, date_badt)
  where statut in ('EN_ATTENTE', 'EN_COURS') and date_badt is not null;

-- Jointures fréquentes
create index conteneurs_shipping_line_idx on public.conteneurs (shipping_line_id);
create index conteneurs_destination_idx on public.conteneurs (destination_id);

-- Recherche tolérante (numéro, BL, client, déclaration)
create extension if not exists pg_trgm;
create extension if not exists unaccent;

alter table public.conteneurs
  add column search_text text
  generated always as (
    public.immutable_unaccent(lower(
      coalesce(numero, '') || ' ' ||
      coalesce(numero_bl, '') || ' ' ||
      coalesce(num_declaration, '') || ' ' ||
      coalesce(client, '') || ' ' ||
      coalesce(transitaire, '') || ' ' ||
      coalesce(marchandise, '') || ' ' ||
      coalesce(destination_libre, '')
    ))
  ) stored;

create index conteneurs_search_text_trgm_idx
  on public.conteneurs using gin (search_text gin_trgm_ops);

comment on table public.conteneurs is
  'Conteneurs suivis depuis l''arrivée au PAA jusqu''à la livraison. FK vers les catalogues partagés.';

-- =============================================================================
-- 4. Trigger updated_at
-- =============================================================================

create trigger conteneurs_set_updated_at
  before update on public.conteneurs
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 5. RLS — isolement tenant
-- =============================================================================

alter table public.conteneurs enable row level security;

create policy "conteneurs_select_same_tenant_or_super"
  on public.conteneurs for select
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "conteneurs_insert_same_tenant"
  on public.conteneurs for insert
  to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "conteneurs_update_same_tenant"
  on public.conteneurs for update
  to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.jwt_tenant_id()
  );

create policy "conteneurs_delete_manager_or_super"
  on public.conteneurs for delete
  to authenticated
  using (
    public.is_super_admin()
    or (
      public.jwt_user_role() = 'MANAGER'
      and tenant_id = public.jwt_tenant_id()
    )
  );

-- =============================================================================
-- 6. Grants
-- =============================================================================

grant select, insert, update, delete on public.conteneurs to authenticated;
