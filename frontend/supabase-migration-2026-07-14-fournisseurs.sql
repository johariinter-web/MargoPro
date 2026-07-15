-- =====================================================================
-- MargoPro — Migration 2026-07-14b
-- Fournisseurs et commandes fournisseur
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

create table if not exists public.fournisseurs (
  id               uuid    primary key,
  user_id          uuid    not null references auth.users(id) on delete cascade,
  nom              text    not null,
  contact          text,
  delai_habituel   integer,
  montant_minimum  numeric,
  mode_paiement    text,
  created_at       bigint  not null,
  updated_at       bigint  not null,
  deleted          boolean not null default false
);
create index if not exists fournisseurs_user_id_idx on public.fournisseurs (user_id);

alter table public.fournisseurs enable row level security;
drop policy if exists "fournisseurs_owner" on public.fournisseurs;
create policy "fournisseurs_owner" on public.fournisseurs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.commandes (
  id              uuid    primary key,
  user_id         uuid    not null references auth.users(id) on delete cascade,
  fournisseur_id  uuid    not null,
  date_commande   bigint  not null,
  delai_jours     integer not null,
  montant         numeric not null default 0,
  recue           boolean not null default false,
  created_at      bigint  not null,
  updated_at      bigint  not null,
  deleted         boolean not null default false
);
create index if not exists commandes_user_id_idx on public.commandes (user_id);
create index if not exists commandes_fournisseur_id_idx on public.commandes (fournisseur_id);

alter table public.commandes enable row level security;
drop policy if exists "commandes_owner" on public.commandes;
create policy "commandes_owner" on public.commandes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
