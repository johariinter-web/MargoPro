# Service worker hors ligne — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire fonctionner MargoPro hors ligne après une première ouverture en ligne, via un service worker écrit à la main (le paquet PWA installé étant incompatible avec Turbopack).

**Architecture:** Un fichier `public/sw.js` (JavaScript brut, aucune dépendance) enregistré au montage de l'appli. Stratégie réseau-d'abord pour les pages (toujours la dernière version si internet, la dernière connue sinon), cache-d'abord pour les fichiers statiques (images, polices, JS/CSS buildés — jamais périmés une fois en cache car nommés avec un hash unique par build).

**Tech Stack:** Service Worker API native du navigateur (Cache API, `fetch` event), aucune librairie. Next.js 16 App Router / Turbopack.

**Spec:** `docs/superpowers/specs/2026-08-14-service-worker-hors-ligne-design.md`

## Global Constraints

- Aucune dépendance externe pour le service worker (JavaScript brut uniquement — `@ducanh2912/next-pwa` confirmé incompatible avec Turbopack).
- Mise à jour automatique et silencieuse, sans écran "Nouvelle version disponible" (décision produit de Juanita).
- Ne touche pas à `frontend/lib/syncController.ts` ni à la synchro des données (IndexedDB reste la seule source de vérité pour les données métier).
- Ne cache jamais les routes `/api/*` (paiement, webhooks — nécessitent internet de toute façon).
- Pas de bouton d'installation personnalisé — le mécanisme natif du navigateur (déjà fonctionnel via `manifest.json`) reste inchangé.

---

## Task 1: Retirer la dépendance PWA inutilisable

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json` (généré automatiquement)

**Interfaces:**
- Consumes: rien
- Produces: rien (nettoyage seul)

- [ ] **Step 1: Désinstaller le paquet**

Run (depuis `frontend/`): `npm uninstall @ducanh2912/next-pwa`

- [ ] **Step 2: Vérifier que `package.json` ne le liste plus**

Ouvrir `frontend/package.json`, confirmer qu'il n'y a plus de ligne `"@ducanh2912/next-pwa"`.

- [ ] **Step 3: Vérifier que le build fonctionne toujours**

Run (depuis `frontend/`): `npm run build`
Expected: build réussi (ce paquet n'était de toute façon jamais utilisé dans le code, donc rien ne doit changer).

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: retirer next-pwa (incompatible avec Turbopack, jamais utilise)"
```

---

## Task 2: Écrire le service worker

**Files:**
- Create: `frontend/public/sw.js`

**Interfaces:**
- Consumes: rien
- Produces: un fichier servi statiquement sur `/sw.js` par Next.js (tout fichier dans `public/` est servi tel quel à la racine). Task 3 s'enregistre contre ce chemin exact : `/sw.js`.

- [ ] **Step 1: Créer le fichier avec le contenu complet**

Créer `frontend/public/sw.js` :

```js
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
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom.startsWith('margopro-') && !CACHES_ACTUELS.includes(nom))
          .map((nom) => caches.delete(nom))
      )
    )
  );
  self.clients.claim();
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
    cache.put(request, reponse.clone());
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
  cache.put(request, reponse.clone());
  return reponse;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (estRequeteApi(url)) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(PAGES_CACHE).then((cache) => reseauPuisCache(event.request, cache))
    );
    return;
  }

  if (estFichierStatique(url)) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then((cache) => cachePuisReseau(event.request, cache))
    );
  }
});
```

- [ ] **Step 2: Vérifier que le build n'est pas cassé**

Run (depuis `frontend/`): `npm run build`
Expected: build réussi (un fichier dans `public/` n'est jamais traité par le build, donc ce step confirme juste qu'on n'a rien cassé ailleurs par erreur).

- [ ] **Step 3: Commit**

```bash
git add frontend/public/sw.js
git commit -m "feat: ecrire le service worker pour le fonctionnement hors ligne"
```

---

## Task 3: Enregistrer le service worker au démarrage de l'appli

**Files:**
- Create: `frontend/components/ServiceWorkerRegister.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: le chemin `/sw.js` produit par Task 2.
- Produces: rien consommé par une tâche suivante (dernière pièce du puzzle).

- [ ] **Step 1: Créer le composant d'enregistrement**

Créer `frontend/components/ServiceWorkerRegister.tsx` :

```tsx
'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Echec silencieux : l'appli reste utilisable en ligne, juste sans
        // le confort hors ligne. Pas la peine de bloquer ni d'alerter.
      });
    }
  }, []);

  return null;
}
```

- [ ] **Step 2: Monter le composant dans le layout racine**

Dans `frontend/app/layout.tsx`, ajouter l'import en haut du fichier avec les autres imports de composants :

```tsx
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
```

Puis, dans le JSX du `<body>`, ajouter `<ServiceWorkerRegister />` aux côtés des autres "starters" déjà présents (`<SyncStarter />`, `<DeviceSessionStarter />`, `<ReferralCapture />`, `<PlanCapture />`) :

```tsx
        <SyncStarter />
        <DeviceSessionStarter />
        <ReferralCapture />
        <PlanCapture />
        <ServiceWorkerRegister />
```

- [ ] **Step 3: Vérifier types, lint et tests**

Run (depuis `frontend/`) :
```bash
npx tsc --noEmit
npx eslint app/layout.tsx components/ServiceWorkerRegister.tsx
npx vitest run
```
Expected: aucune erreur TypeScript, aucune erreur ESLint (avertissements pré-existants sans rapport acceptables), tous les tests existants passent toujours.

- [ ] **Step 4: Vérifier l'enregistrement dans un vrai navigateur**

Run (depuis `frontend/`):
```bash
npm run build
npm run start
```
Ouvrir `http://localhost:3000` dans un navigateur. Ouvrir les outils de développement → onglet **Application** (Chrome) ou **Stockage** (Firefox) → **Service Workers**.
Expected: un service worker listé avec le statut "activated and running", aucune erreur dans la console.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ServiceWorkerRegister.tsx frontend/app/layout.tsx
git commit -m "feat: enregistrer le service worker au demarrage de l'appli"
```

---

## Task 4: Vérifier le comportement hors ligne de bout en bout

**Files:** aucun (vérification uniquement, pas de code)

**Interfaces:**
- Consumes: le service worker enregistré et fonctionnel produit par Task 3.
- Produces: rien (dernière tâche du plan)

- [ ] **Step 1: Charger l'appli en ligne, avec un vrai rechargement complet par page**

Avec `npm run start` toujours actif, ouvrir `http://localhost:3000` puis, pour chaque page qui compte (`/`, `/stock`, `/ventes`, `/marges`), faire un **rechargement complet** (F5 / Ctrl+R, pas un clic sur un onglet de la barre du bas). Chaque page a besoin de son propre rechargement complet pour entrer réellement dans le cache de pages : cliquer dans la barre de navigation du bas ne suffit pas, car ça déclenche une navigation côté client Next.js (récupération d'un fragment RSC, pas un vrai chargement de page), que le service worker ne met jamais en cache.

- [ ] **Step 2: Simuler une coupure réseau**

Dans les outils de développement → onglet **Network** (Réseau), changer le menu déroulant de débit de "No throttling" à **"Offline"** (ou activer le mode avion sur un vrai appareil).

- [ ] **Step 3: Fermer complètement l'appli et la rouvrir**

Fermer complètement l'onglet/l'appli, puis la rouvrir hors ligne.
Expected: elle se charge normalement (c'est la garantie de base de ce chantier).

- [ ] **Step 4: Naviguer entre les onglets hors ligne (étape qui distingue le vrai du faux positif)**

Toujours hors ligne, cliquer dans la barre de navigation du bas pour passer d'un onglet à l'autre (Accueil, Stock, Ventes, Marges).
Expected: les pages rechargées complètement à l'étape 1 s'affichent normalement. Si une page rechargée complètement à l'étape 1 échoue à se charger hors ligne, c'est une vraie régression à investiguer. Si une page qu'on n'a jamais rechargée complètement échoue, c'est la limitation connue et acceptée (voir la spec, section "Hors scope"), pas un bug.

- [ ] **Step 5: Rétablir le réseau et confirmer la fraîcheur**

Remettre le débit réseau à "No throttling" (ou "Online"), recharger la page.
Expected: la page se recharge normalement depuis le réseau (comportement réseau-d'abord confirmé).

- [ ] **Step 6: Rapporter le résultat**

Si tout fonctionne comme attendu aux steps 3, 4 et 5 : le chantier est prêt à être testé par Juanita en conditions réelles sur son téléphone (mode avion), avant fusion dans `main`.
Si un problème apparaît à l'étape 3 ou 4 (page rechargée complètement à l'étape 1 non servie hors ligne) : vérifier dans l'onglet Application → Cache Storage que les caches `margopro-pages-v1` et `margopro-assets-v1` contiennent bien les fichiers attendus — un cache vide indique que `fetch` n'a pas été intercepté correctement (revoir les conditions dans le gestionnaire `fetch` de `frontend/public/sw.js`, Task 2).
