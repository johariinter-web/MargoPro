-- Compteur anonyme de visites du simulateur de prix (/simulateur-de-prix).
-- Aucune donnee personnelle : une ligne par visite, juste un horodatage.
create table if not exists simulateur_visites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

alter table simulateur_visites enable row level security;

-- Aucune policy pour anon/authenticated : seule la cle de service (route API
-- serveur) peut lire ou ecrire dans cette table.
