-- =====================================================================
-- MargoPro — Migration 2026-07-11
-- device_sessions : remise en place complète des policies RLS
--
-- Bug : la section "Appareils connectés" de Paramètres n'affiche aucun
-- appareil (ni "Aucun appareil enregistré" à raison, ni les appareils
-- existants) alors que des lignes existent bien dans la table (vérifié
-- dans Table Editor). Cause probable : la policy SELECT n'a jamais été
-- appliquée en prod (seule la policy DELETE avait été écrite comme
-- migration séparée) -> RLS active bloque silencieusement toute lecture.
--
-- Cette migration remplace supabase-migration-2026-07-10b-device-delete.sql
-- (inutile de l'exécuter séparément si celle-ci est exécutée).
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

alter table public.device_sessions enable row level security;

drop policy if exists "device_sessions_select" on public.device_sessions;
create policy "device_sessions_select" on public.device_sessions
  for select using (auth.uid() = user_id);

drop policy if exists "device_sessions_insert" on public.device_sessions;
create policy "device_sessions_insert" on public.device_sessions
  for insert with check (auth.uid() = user_id);

drop policy if exists "device_sessions_update" on public.device_sessions;
create policy "device_sessions_update" on public.device_sessions
  for update using (auth.uid() = user_id);

drop policy if exists "device_sessions_delete" on public.device_sessions;
create policy "device_sessions_delete" on public.device_sessions
  for delete using (auth.uid() = user_id);
