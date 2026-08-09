-- =====================================================================
-- MargoPro — Migration 2026-08-09
-- Ajoute la colonne essai_etendu a config : distingue les comptes arrives
-- via le bouton "Pro" d'eidma.co (essai de 30 jours) des comptes arrives
-- via le bouton "Gratuit" ou directement dans l'app (essai de 15 jours,
-- comportement par defaut). Voir frontend/lib/hooks/usePlan.ts.
--
-- A executer dans Supabase : Dashboard -> SQL Editor -> New query -> coller -> Run
-- =====================================================================

alter table public.config add column if not exists essai_etendu boolean not null default false;
