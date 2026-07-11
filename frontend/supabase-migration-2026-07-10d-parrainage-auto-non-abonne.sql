-- =====================================================================
-- MargoPro — Migration 2026-07-10d
-- Inscription automatique des affiliés non-abonnés
--
-- Le formulaire d'affiliation sur eidma-landing (section Affiliation)
-- insère désormais directement une ligne dans affiliates depuis le
-- navigateur (clé anon), sans passer par Juanita. Cette policy autorise
-- cet insert, mais UNIQUEMENT pour type = 'non_abonne' et user_id null —
-- impossible de créer une ligne 'abonne' ou de s'attacher à un compte
-- existant par ce chemin.
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

drop policy if exists "affiliates_insert_non_abonne" on public.affiliates;
create policy "affiliates_insert_non_abonne" on public.affiliates
  for insert with check (type = 'non_abonne' and user_id is null);
