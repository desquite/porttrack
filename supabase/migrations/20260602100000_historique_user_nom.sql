-- =============================================================================
-- Migration #29 — modifications_historique : snapshot du NOM de l'auteur
-- =============================================================================
-- Jusqu'ici l'historique ne figeait que l'email de l'auteur (user_email).
-- Maintenant que les membres ont un nom (users.nom/prenoms), on snapshote aussi
-- le nom affichable au moment de la modif — cohérent avec la philosophie
-- IMMUABLE de la table (la valeur reste figée même si l'utilisateur est
-- renommé ou supprimé plus tard).
--
-- Nullable : les entrées existantes (et les auteurs sans nom renseigné) gardent
-- user_nom = NULL → l'affichage retombe sur l'email.
--
-- Note : les triggers d'immuabilité bloquent UPDATE/DELETE de LIGNES, pas le
-- DDL ALTER TABLE — l'ajout de colonne passe normalement.
-- =============================================================================

alter table public.modifications_historique
  add column if not exists user_nom text;

comment on column public.modifications_historique.user_nom is
  'Nom affichable de l''auteur, figé au moment de la modification (snapshot). NULL = retombe sur user_email à l''affichage.';
