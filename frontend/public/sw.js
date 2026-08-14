// Service worker MargoPro — écrit à la main (aucune dépendance Workbox/next-pwa,
// incompatibles avec Turbopack). Voir docs/superpowers/specs/2026-08-14-service-worker-hors-ligne-design.md

const VERSION = 'v1';
const PAGES_CACHE = `margopro-pages-${VERSION}`;
const ASSETS_CACHE = `margopro-assets-${VERSION}`;
const CACHES_ACTUELS = [PAGES_CACHE, ASSETS_CACHE];

// Fichiers essentiels mis en cache dès l'installation, pour qu'ils soient
// disponibles hors ligne même si l'utilisateur n'a jamais eu l'occasion de
// les charger individuellement.
const FICHIERS_A_PRECACHER = [
  '/manifest.json',
  '/logo-margopro.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then((cache) => cache.addAll(FICHIERS_A_PRECACHER))
  );
  // Ne pas attendre la fermeture de tous les onglets ouverts avant de prendre
  // le relais : mise à jour automatique dès que possible (choix de Juanita).
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(
          noms
            .filter((nom) => nom.startsWith('margopro-') && !CACHES_ACTUELS.includes(nom))
            .map((nom) => caches.delete(nom))
        )
      )
      .then(() => self.clients.claim())
  );
});

function estRequeteApi(url) {
  return url.pathname.startsWith('/api/');
}

function estFichierStatique(url) {
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image')) {
    return true;
  }
  return /\.(svg|png|jpe?g|webp|ico|woff2?|json)$/.test(url.pathname);
}

// Pages de navigation : toujours essayer le réseau en premier pour avoir la
// dernière version publiée ; si hors ligne, servir la dernière copie connue.
async function reseauPuisCache(request, cache) {
  try {
    const reponse = await fetch(request);
    if (reponse.ok && reponse.type === 'basic') cache.put(request, reponse.clone());
    return reponse;
  } catch {
    const enCache = await cache.match(request);
    if (enCache) return enCache;
    throw new Error('Hors ligne et rien en cache pour cette page');
  }
}

// Fichiers statiques (hash unique par build, donc jamais périmés) : servir
// depuis le cache si présent, sinon réseau puis mise en cache pour la suite.
async function cachePuisReseau(request, cache) {
  const enCache = await cache.match(request);
  if (enCache) return enCache;
  const reponse = await fetch(request);
  if (reponse.ok && reponse.type === 'basic') cache.put(request, reponse.clone());
  return reponse;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (estRequeteApi(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches
        .open(PAGES_CACHE)
        .then((cache) => reseauPuisCache(event.request, cache))
        .catch(() => fetch(event.request))
    );
    return;
  }

  if (estFichierStatique(url)) {
    event.respondWith(
      caches
        .open(ASSETS_CACHE)
        .then((cache) => cachePuisReseau(event.request, cache))
        .catch(() => fetch(event.request))
    );
  }
});
