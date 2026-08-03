import { createClient } from '@supabase/supabase-js';

// Client à clé de service : contourne les policies RLS. Réservé aux
// routes serveur qui doivent modifier des données au nom d'un utilisateur
// autre que celui de la requête entrante (ex: webhook FedaPay). Ne jamais
// utiliser cette clé côté navigateur.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
