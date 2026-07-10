-- =====================================================================
-- MargoPro — Migration 2026-07-10
-- Colonnes manquantes pour le carnet de crédit, les packs et la sync photos
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

-- --- ventes : carnet de crédit + packs ---
alter table public.ventes
  add column if not exists mode_reglement text,
  add column if not exists client_nom     text,
  add column if not exists client_tel     text,
  add column if not exists montant_recu   numeric,
  add column if not exists type           text;

-- --- produits : photos cloud + archivage ---
alter table public.produits
  add column if not exists photo_path text,
  add column if not exists archived   boolean not null default false;

-- --- config : période d'essai et abonnement premium ---
alter table public.config
  add column if not exists trial_start bigint,
  add column if not exists is_premium  boolean not null default false;

-- --- table packs ---
create table if not exists public.packs (
  id         uuid    primary key,
  user_id    uuid    not null references auth.users(id) on delete cascade,
  nom        text    not null,
  composants jsonb   not null default '[]',
  prix_vente numeric not null default 0,
  created_at bigint  not null,
  updated_at bigint  not null,
  deleted    boolean not null default false
);
create index if not exists packs_user_id_idx on public.packs (user_id);

alter table public.packs enable row level security;
drop policy if exists "packs_owner" on public.packs;
create policy "packs_owner" on public.packs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
