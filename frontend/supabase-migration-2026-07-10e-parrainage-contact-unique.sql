-- =====================================================================
-- MargoPro — Migration 2026-07-10e
-- Un numéro WhatsApp = un seul code d'affilié non-abonné
--
-- Empêche qu'une même personne obtienne plusieurs codes en soumettant le
-- formulaire d'affiliation plusieurs fois. Index unique partiel : ne
-- s'applique qu'aux lignes type = 'non_abonne' (les abonnés n'ont pas de
-- contact renseigné), et ignore les valeurs NULL (comportement standard
-- Postgres pour un index unique).
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

create unique index if not exists affiliates_contact_non_abonne_key
  on public.affiliates(contact)
  where type = 'non_abonne';
