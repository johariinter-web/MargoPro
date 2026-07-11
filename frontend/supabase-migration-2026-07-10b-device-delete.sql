-- =====================================================================
-- MargoPro — Migration 2026-07-10b
-- device_sessions : policy RLS DELETE manquante
--
-- Bug : la suppression d'un appareil dans Paramètres retirait la ligne
-- localement mais ne supprimait rien côté Supabase (RLS bloquait le
-- DELETE en silence, sans erreur) -> l'appareil revenait au prochain
-- chargement de la liste.
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

drop policy if exists "device_sessions_delete" on public.device_sessions;
create policy "device_sessions_delete" on public.device_sessions
  for delete using (auth.uid() = user_id);
