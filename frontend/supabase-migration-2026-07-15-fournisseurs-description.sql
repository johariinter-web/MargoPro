-- =====================================================================
-- MargoPro — Migration 2026-07-15
-- Ajoute description + quantite aux commandes fournisseur
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

alter table public.commandes
  add column if not exists description text,
  add column if not exists quantite numeric;
