-- =====================================================================
-- MargoPro — Migration 2026-08-09
-- Corrige le programme de parrainage : depuis le lancement (10 juillet),
-- AUCUN parrainage n'a jamais pu être enregistré. `consumeReferralCode`
-- (frontend/lib/parrainage.ts) cherchait l'affilié par son code directement
-- dans la table `affiliates`, mais la seule policy RLS de cette table
-- (affiliates_owner) n'autorise un utilisateur qu'à voir SA PROPRE fiche —
-- la recherche par code d'un tiers échouait silencieusement (0 ligne, pas
-- d'erreur visible), donc la fonction abandonnait avant même de tenter
-- d'insérer le parrainage. Le code a été corrigé pour passer par la vue
-- `affiliates_public` (déjà créée en 2026-07-10c) à la place.
--
-- Cette migration ajoute la policy manquante permettant à un nouveau
-- compte de vérifier s'il a déjà été parrainé (même angle mort RLS,
-- affectait uniquement la vérification anti-doublon, pas le blocage
-- principal).
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

drop policy if exists "parrainages_select_self" on public.parrainages;
create policy "parrainages_select_self" on public.parrainages
  for select using (auth.uid() = filleul_user_id);
