-- =============================================================================
-- PORTTRACK — Migration #23 : matching tolérant des numéros du bot WhatsApp
-- =============================================================================
-- Contexte Côte d'Ivoire : passage récent de 8 → 10 chiffres. Les opérateurs
-- (Orange 07, MTN 05, Moov 01) ont préfixé les anciens numéros 8 chiffres.
-- Selon l'ancienneté du compte WhatsApp, le provider envoie soit l'ancien
-- format (225 + 8 chiffres), soit le nouveau (225 + 10 chiffres). Et l'admin
-- peut saisir le numéro avec ou sans 0, avec ou sans indicatif pays.
--
-- La partie STABLE commune à toutes ces variantes = les 8 derniers chiffres
-- (le cœur de l'abonné, inchangé lors de la migration). On matche dessus.
-- =============================================================================

-- Colonne générée : 8 derniers chiffres du numéro (chiffres seuls).
alter table public.bot_whatsapp_numeros
  add column numero_core text
  generated always as (right(regexp_replace(numero, '\D', '', 'g'), 8)) stored;

create index bot_whatsapp_numeros_core_idx
  on public.bot_whatsapp_numeros (numero_core, actif);

comment on column public.bot_whatsapp_numeros.numero_core is
  '8 derniers chiffres (cœur abonné CI) — clé de matching tolérante aux formats 8/10 chiffres et à l''indicatif.';
