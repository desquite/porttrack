-- =============================================================================
-- PORTTRACK — Migration #24 : unicité du bot WhatsApp sur le CŒUR du numéro
-- =============================================================================
-- La contrainte d'unicité existait sur `numero` (chaîne exacte), mais le
-- matching se fait sur `numero_core` (8 derniers chiffres). Conséquence : le
-- même numéro physique écrit dans deux formats (+2250709646096 vs 0709646096)
-- pouvait être enregistré dans deux tenants différents → ambiguïté du bot.
--
-- On garantit donc l'invariant « 1 numéro physique = 1 tenant » au niveau du
-- cœur. On conserve aussi l'unicité sur `numero` (anti-doublon exact).
-- =============================================================================

alter table public.bot_whatsapp_numeros
  add constraint bot_whatsapp_numeros_core_unique unique (numero_core);
