'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// Doit correspondre exactement au nom de cache utilisé par le service worker
// (frontend/public/sw.js, PAGES_CACHE = `margopro-pages-${VERSION}`) — à
// mettre à jour si VERSION change un jour dans sw.js.
const PAGES_CACHE = 'margopro-pages-v1';

const PAGES_A_PRECACHER = ['/', '/stock', '/ventes', '/marges', '/parametres', '/alertes', '/sauvegarde'];

// Précharge les pages principales dans le cache hors ligne dès la connexion,
// pour qu'un commerçant n'ait jamais besoin de visiter/recharger chaque page
// manuellement avant de pouvoir l'utiliser sans réseau.
export function PrecachePages() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('caches' in window)) return;

    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      try {
        const cache = await caches.open(PAGES_CACHE);
        await Promise.all(
          PAGES_A_PRECACHER.map(async (page) => {
            try {
              const reponse = await fetch(page);
              if (reponse.ok) await cache.put(page, reponse);
            } catch {
              // Page individuelle indisponible : pas grave, elle sera mise
              // en cache normalement dès que l'utilisateur la visite.
            }
          })
        );
      } catch {
        // Cache Storage indisponible (navigation privée, quota dépassé...) :
        // pas grave, l'appli reste utilisable en ligne comme d'habitude.
      }
    })();
  }, []);

  return null;
}
