-- =============================================================================
-- Migration #35 — Géolocalisation temps réel des chauffeurs (via PWA)
-- =============================================================================
-- Le chauffeur partage sa position depuis la PWA (API Geolocation du navigateur)
-- tant que l'app est ouverte au premier plan pendant son service. Le bureau voit
-- une carte live des camions en mouvement + une trace légère pour rejouer un
-- trajet a posteriori (preuve de passage / litige).
--
-- Modèle « append-only » : un ping = une ligne. Pas de mise à jour, pas de
-- suppression côté chauffeur. Volumétrie maîtrisée (1 point / ~60 s, app ouverte
-- seulement). Le bureau lit la dernière position par chauffeur (≈ en ligne si
-- récente) et la trace d'une journée.
-- =============================================================================

create table public.chauffeur_positions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  chauffeur_id  uuid not null references public.chauffeurs(id) on delete cascade,
  -- Snapshot du camion désigné au moment du ping (facultatif, pour la carte).
  materiel_id   uuid references public.materiel_roulant(id) on delete set null,
  latitude      double precision not null,
  longitude     double precision not null,
  -- Précision GPS en mètres (rapportée par le navigateur), pour filtrer le bruit.
  accuracy_m    double precision,
  captured_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  constraint chauffeur_positions_lat_valid check (latitude between -90 and 90),
  constraint chauffeur_positions_lng_valid check (longitude between -180 and 180)
);

-- Dernière position par chauffeur + parcours d'une journée (tri desc).
create index chauffeur_positions_tenant_chauffeur_idx
  on public.chauffeur_positions (tenant_id, chauffeur_id, captured_at desc);
-- Vue « live » : positions récentes du tenant.
create index chauffeur_positions_tenant_captured_idx
  on public.chauffeur_positions (tenant_id, captured_at desc);

comment on table public.chauffeur_positions is
  'Positions GPS des chauffeurs (PWA, app ouverte). Append-only : 1 ping = 1 ligne. Migration #35.';

alter table public.chauffeur_positions enable row level security;

-- Bureau : lecture des positions de son tenant.
create policy "chauffeur_positions_select_same_tenant_or_super"
  on public.chauffeur_positions for select
  using (public.is_super_admin() or tenant_id = public.jwt_tenant_id());

-- Chauffeur : insère SES positions (et les relit).
create policy "chauffeur_positions_driver_insert_own"
  on public.chauffeur_positions for insert
  with check (
    chauffeur_id = public.current_chauffeur_id()
    and tenant_id = public.current_chauffeur_tenant()
  );

create policy "chauffeur_positions_driver_select_own"
  on public.chauffeur_positions for select
  using (chauffeur_id = public.current_chauffeur_id());

-- Manager : purge éventuelle (RGPD / nettoyage).
create policy "chauffeur_positions_delete_manager_or_super"
  on public.chauffeur_positions for delete
  using (
    public.is_super_admin()
    or (public.jwt_user_role() = 'MANAGER' and tenant_id = public.jwt_tenant_id())
  );
