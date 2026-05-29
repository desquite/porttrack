-- =============================================================================
-- PORTTRACK — Migration #10 : durcir jwt_tenant_id() (fallback claim vide)
-- =============================================================================
-- Bug : la version d'origine appliquait nullif APRÈS le coalesce :
--
--   nullif(coalesce(jwt->>'tenant_id', jwt->'app_metadata'->>'tenant_id'), '')
--
-- Si le hook custom_access_token_hook a injecté un claim `tenant_id` VIDE
-- (cas d'un jeton émis quand public.users.tenant_id était encore null — ex.
-- juste après une invitation), le coalesce retient cette chaîne vide (non
-- nulle) et NE retombe JAMAIS sur app_metadata → jwt_tenant_id() = null →
-- la RLS refuse l'accès au tenant ("Entreprise introuvable") tant que
-- l'utilisateur ne se reconnecte pas.
--
-- Correctif : appliquer nullif à CHAQUE source avant le coalesce, pour que le
-- claim vide bascule sur app_metadata.tenant_id (source de vérité fiable).
-- =============================================================================

create or replace function public.jwt_tenant_id()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'tenant_id', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')
  )::uuid
$$;

comment on function public.jwt_tenant_id() is
  'Extrait le tenant_id du JWT (claim custom du hook, sinon app_metadata). nullif par source pour que les claims vides retombent sur app_metadata.';
