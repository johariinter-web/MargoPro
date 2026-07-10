-- =====================================================================
-- MargoPro — Migration 2026-07-10c
-- Programme de parrainage / affiliation
--
-- Crée les tables affiliates / parrainages / parrainage_paiements et
-- leurs policies RLS. Voir docs/superpowers/specs/2026-07-10-parrainage-design.md
-- pour le design complet.
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

create table if not exists public.affiliates (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  nom          text not null,
  contact      text,
  type         text not null check (type in ('abonne', 'non_abonne')),
  user_id      uuid references auth.users(id) on delete set null,
  recompense   text check (recompense in ('mois_gratuit', 'commission')),
  mois_gratuits_accordes integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists affiliates_user_id_idx on public.affiliates(user_id);

create table if not exists public.parrainages (
  id               uuid primary key default gen_random_uuid(),
  affiliate_id     uuid not null references public.affiliates(id) on delete cascade,
  filleul_nom      text not null,
  filleul_contact  text,
  filleul_user_id  uuid references auth.users(id) on delete set null,
  code_utilise     text not null,
  date_inscription timestamptz not null default now()
);
create index if not exists parrainages_affiliate_id_idx on public.parrainages(affiliate_id);

create table if not exists public.parrainage_paiements (
  id                 uuid primary key default gen_random_uuid(),
  parrainage_id      uuid not null references public.parrainages(id) on delete cascade,
  mois               text not null,           -- format 'YYYY-MM'
  montant_paye       numeric not null,        -- montant payé par le filleul ce mois-là
  commission_versee  boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (parrainage_id, mois)
);

alter table public.affiliates enable row level security;
alter table public.parrainages enable row level security;
alter table public.parrainage_paiements enable row level security;

-- Un abonné gère sa propre ligne affilié
drop policy if exists "affiliates_owner" on public.affiliates;
create policy "affiliates_owner" on public.affiliates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lecture publique par code (page de suivi, sans login) — l'app ne
-- sélectionne jamais `contact` depuis ce canal public
drop policy if exists "affiliates_public_read" on public.affiliates;
create policy "affiliates_public_read" on public.affiliates
  for select using (true);

drop policy if exists "parrainages_public_read" on public.parrainages;
create policy "parrainages_public_read" on public.parrainages
  for select using (true);

drop policy if exists "parrainage_paiements_public_read" on public.parrainage_paiements;
create policy "parrainage_paiements_public_read" on public.parrainage_paiements
  for select using (true);

-- Écriture (nouveau filleul) réservée à l'utilisateur qui vient de
-- s'inscrire, pour rattacher son propre user_id
drop policy if exists "parrainages_insert_self" on public.parrainages;
create policy "parrainages_insert_self" on public.parrainages
  for insert with check (auth.uid() = filleul_user_id);

-- parrainage_paiements : aucune policy insert/update publique — Juanita
-- gère via l'éditeur Supabase (accès service role, ignore RLS)
