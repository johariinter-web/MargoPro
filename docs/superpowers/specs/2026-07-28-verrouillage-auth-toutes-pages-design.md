# Verrouillage de connexion sur toutes les pages

**Date :** 2026-07-28
**Statut :** Approuvé
**Contexte :** Juanita s'inquiète de ne voir aucune interaction sur MargoPro malgré des semaines de promotion. Investigation : seule la page `/` vérifie qu'un compte est connecté (redirection vers `/auth` sinon) ; aucune autre page ne le fait, y compris `/onboarding` qui écrit directement dans IndexedDB. Quelqu'un qui ouvre `margopro.eidma.co/onboarding` directement (lien partagé, favori, URL tapée) peut configurer son commerce et utiliser Stock/Ventes/Marges indéfiniment en local sans jamais créer de compte Supabase — donc invisible dans Authentication > Users, sans aucun autre système de suivi en place.

## Problème

`frontend/app/page.tsx:34-43` fait le seul contrôle d'auth de toute l'app, en `useEffect` côté client (`supabase.auth.getUser()` → redirection `/auth` si absent). `frontend/middleware.ts:3-5` est un passe-plat qui ne fait rien. Aucune des autres pages (`/onboarding`, `/stock`, `/ventes`, `/marges`, `/parametres`, `/alertes`, `/sauvegarde`, `/abonnement`, `/aide`) ne revérifie — ce contrôle page-par-page est fragile par nature : il suffit d'oublier de l'ajouter à une nouvelle page pour rouvrir la brèche (ce qui est déjà arrivé).

## Design

### Verrou central dans middleware.ts

`frontend/middleware.ts` utilise l'infrastructure Supabase SSR déjà présente dans le projet (`frontend/lib/supabase/server.ts`, basée sur `@supabase/ssr` + cookies — jamais branchée jusqu'ici) pour vérifier la session à chaque requête, avant que la page ne se charge :

- Si aucune session valide ET la route n'est pas publique → redirection vers `/auth`.
- Si une session valide existe → la requête continue normalement (aucun changement de comportement pour les utilisateurs déjà connectés).

### Routes publiques (exclues du verrou)

- `/auth` et ses sous-pages (`/auth/nouveau-mot-de-passe`) — c'est là qu'on se connecte/inscrit.
- `/cgu` — lié depuis le formulaire d'inscription (case à cocher CGU) *avant* que le compte existe ; doit rester lisible sans connexion.
- Les fichiers statiques déjà exclus par le matcher actuel (`_next/static`, `_next/image`, `favicon.ico`, `manifest.json`, `icons`).

Toutes les autres pages (`/`, `/onboarding`, `/stock`, `/ventes`, `/marges`, `/parametres`, `/alertes`, `/sauvegarde`, `/abonnement`, `/aide`) exigent désormais une session valide.

### Nettoyage

Le contrôle d'auth dans `frontend/app/page.tsx` (lignes 34-43, état `authChecked`) devient redondant une fois le middleware en place — retiré pour simplifier (la page part du principe qu'un utilisateur non connecté n'atteint jamais ce code).

### Hors-ligne

Aucun changement pour les utilisateurs déjà connectés hors-ligne : le middleware ne s'exécute que pour les requêtes qui atteignent réellement le serveur. Une session déjà ouverte reste valide (cookie Supabase) et n'est jamais redemandée tant qu'il n'y a pas de déconnexion explicite. La connexion initiale nécessite toujours internet, comme aujourd'hui.

## Ce qui change dans le code

- **`frontend/middleware.ts`** — remplace le passe-plat par une vérification de session Supabase (pattern officiel `@supabase/ssr` pour Next.js middleware), redirection vers `/auth` si absente, sauf sur les routes publiques listées ci-dessus.
- **`frontend/app/page.tsx`** — retire le `useEffect` de vérification d'auth (lignes 34-43) et l'état `authChecked` associé, devenus redondants.

## Étape manuelle (hors code)

Aucune — pas de migration Supabase, pas de config dashboard à changer (les cookies de session Supabase existent déjà via `createBrowserClient`).
