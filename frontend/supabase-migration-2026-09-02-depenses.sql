-- =====================================================================
-- MargoPro — Migration 2026-09-02
-- Journal de depenses (charges de la boutique)
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

create table if not exists public.depenses (
  id          uuid    primary key,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  nom         text    not null,
  montant     numeric not null,
  date        bigint  not null,
  created_at  bigint  not null,
  updated_at  bigint  not null,
  deleted     boolean not null default false
);
create index if not exists depenses_user_id_idx on public.depenses (user_id);

alter table public.depenses enable row level security;
drop policy if exists "depenses_owner" on public.depenses;
create policy "depenses_owner" on public.depenses
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
