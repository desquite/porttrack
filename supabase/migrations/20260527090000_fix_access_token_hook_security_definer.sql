-- =============================================================================
-- Fix : custom_access_token_hook doit s'exécuter avec SECURITY DEFINER
-- =============================================================================
-- Bug constaté : après upgrade d'un user en SUPER_ADMIN dans public.users,
-- le claim JWT user_role restait coincé à 'CUSTOM' (la valeur fallback).
--
-- Cause : le hook fait `select role from public.users where id = v_user_id`,
-- mais il est appelé par `supabase_auth_admin` pendant l'émission du JWT,
-- AVANT qu'il n'y ait d'`auth.uid()` dans le contexte d'exécution. Toutes
-- les policies RLS de public.users (qui s'appuient sur jwt_user_role(),
-- auth.uid() etc.) renvoient donc faux → le SELECT retourne 0 ligne →
-- v_role est NULL → coalesce(..., 'CUSTOM') s'applique.
--
-- Correctif : SECURITY DEFINER fait tourner la fonction avec les droits
-- de son owner (postgres = superuser, qui bypasse RLS). Le SELECT lit
-- alors la ligne sans filtre. On verrouille aussi search_path pour
-- éviter toute injection via le résolveur de noms.
-- =============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user_id     uuid;
  v_tenant_id   uuid;
  v_role        public.user_role;
  v_claims      jsonb;
begin
  v_user_id := (event ->> 'user_id')::uuid;

  select tenant_id, role
    into v_tenant_id, v_role
  from public.users
  where id = v_user_id;

  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  v_claims := jsonb_set(
    v_claims,
    '{tenant_id}',
    to_jsonb(coalesce(v_tenant_id::text, ''))
  );
  v_claims := jsonb_set(
    v_claims,
    '{user_role}',
    to_jsonb(coalesce(v_role::text, 'CUSTOM'))
  );

  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Les grants restent identiques (idempotents).
grant execute on function public.custom_access_token_hook(jsonb)
  to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

comment on function public.custom_access_token_hook(jsonb) is
  'Injecte tenant_id et user_role dans le JWT. SECURITY DEFINER pour bypasser RLS de public.users pendant l''émission du token.';
