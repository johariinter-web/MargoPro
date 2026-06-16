-- =====================================================================
-- MargoPro — Schéma de synchronisation cloud (local-first)
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- Projet : qkyvzvehqmjjepkaihte
--
-- Reset propre : supprime d'éventuelles tables incomplètes d'un essai
-- précédent, puis recrée la bonne structure. Sûr tant qu'il n'y a pas
-- encore de vraies données en production.
-- =====================================================================

drop table if exists public.produits cascade;
drop table if exists public.ventes   cascade;
drop table if exists public.config   cascade;

-- ------------------------------------------------------------------
-- TABLE : produits
-- ------------------------------------------------------------------
create table public.produits (
  id                     uuid    primary key,
  user_id                uuid    not null references auth.users(id) on delete cascade,
  nom                    text    not null,
  quantite               numeric not null default 0,
  prix_achat             numeric not null default 0,
  prix_vente             numeric not null default 0,
  seuil_alerte           numeric not null default 0,
  code_barres            text,
  categorie              text,
  taille_conditionnement numeric,
  created_at             bigint  not null,
  updated_at             bigint  not null,
  deleted                boolean not null default false
);
create index if not exists produits_user_id_idx on public.produits (user_id);

-- ------------------------------------------------------------------
-- TABLE : ventes
-- ------------------------------------------------------------------
create table if not exists public.ventes (
  id          uuid    primary key,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  produit_id  uuid    not null,
  produit_nom text    not null,
  quantite    numeric not null,
  prix_vente  numeric not null,
  prix_achat  numeric not null,
  total       numeric not null,
  benefice    numeric not null,
  date        bigint  not null,
  updated_at  bigint  not null,
  deleted     boolean not null default false
);
create index if not exists ventes_user_id_idx on public.ventes (user_id);

-- ------------------------------------------------------------------
-- TABLE : config (une ligne par utilisateur)
-- ------------------------------------------------------------------
create table if not exists public.config (
  user_id             uuid    primary key references auth.users(id) on delete cascade,
  nom_commerce        text,
  devise              text,
  symbole_devise      text,
  onboarding_complete boolean not null default false,
  date_abonnement     bigint,
  updated_at          bigint  not null
);

-- ------------------------------------------------------------------
-- ROW LEVEL SECURITY : chaque utilisateur ne voit/modifie que ses lignes
-- ------------------------------------------------------------------
alter table public.produits enable row level security;
alter table public.ventes   enable row level security;
alter table public.config   enable row level security;

drop policy if exists "produits_owner" on public.produits;
create policy "produits_owner" on public.produits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "ventes_owner" on public.ventes;
create policy "ventes_owner" on public.ventes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "config_owner" on public.config;
create policy "config_owner" on public.config
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
