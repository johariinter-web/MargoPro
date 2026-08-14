# Service worker pour un vrai fonctionnement hors ligne

**Date :** 2026-08-14
**Statut :** Approuvé
**Contexte :** Juanita a remarqué que MargoPro affiche "Vous êtes hors connexion" quand on l'ouvre sans internet, alors que le principe fondateur du projet (`CLAUDE.md`) est "Offline-first : tout fonctionne sans internet."

## Problème

- Aucun service worker n'a jamais été enregistré, depuis le tout premier commit du projet. `frontend/public/manifest.json` existe et permet d'installer l'icône sur l'écran d'accueil, mais rien ne met l'application en cache pour un vrai usage hors ligne.
- Le paquet `@ducanh2912/next-pwa` est installé (`package.json`) mais n'a jamais été branché dans `next.config.ts`.
- **Le brancher ne suffirait pas** : ce paquet génère son service worker via un plugin webpack (Workbox). Ce projet utilise Turbopack (`turbopack: {}` dans `next.config.ts`, confirmé par la doc officielle Next.js dans `node_modules/next/dist/docs/.../08-turbopack.md` : *"Turbopack does not support webpack plugins"*). Le service worker doit donc être écrit à la main, sans dépendre d'un outil de génération incompatible.
- Conséquence concrète pour les commerçants (le public cible, connexion instable ou inexistante par définition) : impossible de rouvrir l'appli sans réseau, même après l'avoir déjà utilisée — alors que les données (produits, ventes) sont déjà 100% locales via IndexedDB/Dexie et n'ont, elles, jamais eu ce problème.

## Design

### Portée confirmée avec Juanita

- La toute première ouverture sur un appareil nécessite internet (télécharger l'appli une première fois — vrai pour toute PWA, non contournable).
- Une fois ouverte au moins une fois en ligne, l'appli doit s'ouvrir et fonctionner hors ligne à volonté par la suite.
- Une mise à jour publiée doit atteindre les appareils déjà installés **automatiquement dès qu'ils ont internet**, sans action de l'utilisateur.

### Fichiers nouveaux

- **`frontend/public/sw.js`** — le service worker, écrit en JavaScript brut (pas de dépendance Workbox/next-pwa). Trois responsabilités :
  1. **`install`** : met en cache la petite liste de fichiers statiques toujours nécessaires au démarrage (logo, icônes, `manifest.json`). Appelle `self.skipWaiting()` pour ne jamais attendre la fermeture de tous les onglets avant de prendre le relais.
  2. **`activate`** : supprime les caches d'une version précédente (nom de cache incluant un numéro de version, ex: `margopro-shell-v1`) pour ne jamais accumuler de fichiers obsolètes. Appelle `self.clients.claim()` pour prendre le contrôle immédiatement.
  3. **`fetch`** : intercepte chaque requête et choisit une stratégie selon le type :
     - **Pages de navigation** (`/`, `/stock`, `/ventes`, etc.) : *réseau d'abord* — essaie internet, met la réponse à jour dans un cache "pages" au passage ; si le réseau échoue (hors ligne), sert la dernière version en cache. Garantit qu'un appareil en ligne voit toujours la dernière version publiée, et qu'un appareil hors ligne voit la dernière version qu'il a réussi à charger.
     - **Fichiers statiques versionnés** (`_next/static/*`, polices, images) : *cache d'abord* — ces fichiers ont un nom unique par build (hash), donc jamais périmés une fois en cache ; sert depuis le cache si présent, sinon va sur le réseau et met en cache pour la prochaine fois.
     - **Routes `/api/*`** (paiement, webhooks) : jamais mises en cache, toujours le réseau — ces fonctionnalités nécessitent de toute façon une connexion (payer, recevoir un SMS), inutile de faire semblant de les faire marcher hors ligne.

- **`frontend/components/ServiceWorkerRegister.tsx`** — petit composant client, monté une fois dans `frontend/app/layout.tsx` (aux côtés de `SyncStarter`, `ReferralCapture`, etc.), qui appelle `navigator.serviceWorker.register('/sw.js')` au montage. Ignore silencieusement si le navigateur ne supporte pas les service workers (aucun navigateur ciblé par MargoPro ne devrait être dans ce cas, mais reste défensif).

### Nettoyage inclus

- Retrait de la dépendance `@ducanh2912/next-pwa` de `package.json` — confirmée inutilisable avec Turbopack, elle ne fait donc rien d'utile aujourd'hui et n'en fera jamais tant que le projet reste sur Turbopack. La retirer évite toute confusion future ("pourquoi ce paquet est installé mais jamais utilisé ?").

### Hors scope

- Pas d'écran "Nouvelle version disponible" avec bouton de rechargement — Juanita a choisi la mise à jour automatique et silencieuse.
- Pas de notification push, pas de synchronisation en arrière-plan (Background Sync API) — seule la mise en cache de l'appli elle-même est concernée. `frontend/lib/syncController.ts` (synchro des données avec Supabase) n'est pas touché.
- Pas de bouton d'installation personnalisé ("Ajouter à l'écran d'accueil") — le mécanisme natif du navigateur (déjà fonctionnel grâce à `manifest.json`) reste tel quel.
- Pas de retrait des icônes SVG inutilisées déjà présentes dans `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`, restes du template de départ) — sans rapport avec ce chantier.

## Test avant mise en ligne

1. `npm run build && npm run start` en local, ouvrir dans un navigateur, confirmer que le service worker s'enregistre (onglet Application/Service Workers des outils de développement).
2. Simuler une coupure réseau dans le navigateur (mode "Offline" des outils de développement), recharger la page : l'appli doit toujours s'afficher et fonctionner.
3. Une fois déployé, Juanita confirme en conditions réelles sur son téléphone (mode avion, après avoir ouvert l'appli au moins une fois avec le réseau actif).
