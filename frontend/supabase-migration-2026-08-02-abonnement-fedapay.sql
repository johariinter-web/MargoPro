-- =====================================================================
-- MargoPro — Migration 2026-08-02
-- Abonnement Premium FedaPay — colonne premium_expires_at + protection
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

-- Ajoute la date d'expiration Premium (distincte de date_abonnement, qui ne
-- sert qu'a l'affichage d'un compteur independant du vrai statut Premium).
alter table public.config
  add column if not exists premium_expires_at bigint;

-- Protection : seule une requete authentifiee avec la cle de service
-- Supabase (utilisee uniquement par le webhook/serveur FedaPay, jamais par
-- l'app cliente) peut modifier is_premium ou premium_expires_at. Sans ce
-- trigger, n'importe quel client pourrait se donner Premium gratuitement
-- via une simple synchronisation locale (push()).
create or replace function public.proteger_colonnes_premium()
returns trigger
language plpgsql
as $$
begin
  -- auth.role() est l'assistant historique de Supabase (base sur
  -- request.jwt.claims) : il renvoie NULL au lieu de 'service_role' pour
  -- les projets recents utilisant les cles service_role au format
  -- sb_secret_... (non-JWT), car PostgREST change alors de role Postgres
  -- directement sans peupler request.jwt.claims. current_user est fixe
  -- correctement par PostgREST dans les deux cas et ne peut pas renvoyer
  -- NULL silencieusement : on verifie les deux pour ne jamais bloquer le
  -- webhook a tort.
  if current_user = 'service_role' or auth.role() = 'service_role' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.is_premium := false;
    new.premium_expires_at := null;
  else
    new.is_premium := old.is_premium;
    new.premium_expires_at := old.premium_expires_at;
  end if;

  return new;
end;
$$;

drop trigger if exists config_proteger_premium on public.config;
create trigger config_proteger_premium
  before insert or update on public.config
  for each row
  execute function public.proteger_colonnes_premium();

-- Force PostgREST a recharger son cache de schema : sans ca, l'ajout de
-- colonne et le nouveau trigger ci-dessus peuvent ne pas etre pris en
-- compte immediatement par les requetes API (comportement connu de
-- PostgREST apres une migration DDL).
notify pgrst, 'reload schema';
