# Verrouillage de connexion sur toutes les pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exiger une session Supabase valide pour accéder à toute page de l'app, sauf `/auth` et `/cgu`, en centralisant le contrôle dans `middleware.ts` au lieu de le répéter page par page.

**Architecture:** Le middleware Next.js utilise le client Supabase SSR (`@supabase/ssr`) pour lire la session depuis les cookies de la requête, avant que la page ne se charge. Une fonction pure `isPublicPath` décide quelles routes échappent au contrôle ; elle est testée unitairement. Le middleware lui-même n'est pas unit-testé (aucune convention de test middleware/route dans ce repo — voir `frontend/lib/__tests__/`, qui ne couvre que de la logique pure) ; il est vérifié manuellement dans le navigateur, comme les autres flux d'auth de ce projet (mot de passe oublié, appareils connectés).

**Tech Stack:** Next.js 16 App Router, `@supabase/ssr`, TypeScript, Vitest.

## Global Constraints

- Routes publiques (sans session requise) : `/auth`, `/auth/*`, `/cgu` — exactement ces deux préfixes, rien d'autre.
- Les fichiers statiques déjà exclus par le matcher actuel (`_next/static`, `_next/image`, `favicon.ico`, `manifest.json`, `icons`) restent exclus.
- Un utilisateur déjà connecté ne doit voir aucun changement de comportement (pas de redirection surprise, pas de nouvelle demande de connexion).
- Pas de migration Supabase, pas de changement de config dashboard.

---

### Task 1: Fonction `isPublicPath`

**Files:**
- Create: `frontend/lib/authGate.ts`
- Test: `frontend/lib/__tests__/authGate.test.ts`

**Interfaces:**
- Produces: `isPublicPath(pathname: string): boolean` — utilisée par le middleware (Task 2) pour décider si une route échappe au contrôle de session.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `frontend/lib/__tests__/authGate.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { isPublicPath } from '../authGate';

describe('isPublicPath', () => {
  it('autorise /auth', () => {
    expect(isPublicPath('/auth')).toBe(true);
  });

  it('autorise les sous-pages de /auth', () => {
    expect(isPublicPath('/auth/nouveau-mot-de-passe')).toBe(true);
  });

  it('autorise /cgu', () => {
    expect(isPublicPath('/cgu')).toBe(true);
  });

  it('bloque la racine', () => {
    expect(isPublicPath('/')).toBe(false);
  });

  it('bloque /onboarding', () => {
    expect(isPublicPath('/onboarding')).toBe(false);
  });

  it('bloque /stock', () => {
    expect(isPublicPath('/stock')).toBe(false);
  });

  it('ne fait pas de faux positif sur un prefixe partiel', () => {
    expect(isPublicPath('/cguelquechose')).toBe(false);
    expect(isPublicPath('/authentification')).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

Run: `cd frontend && npx vitest run lib/__tests__/authGate.test.ts`
Expected: FAIL — `Cannot find module '../authGate'`

- [ ] **Step 3: Écrire l'implémentation minimale**

Créer `frontend/lib/authGate.ts` :

```ts
const PUBLIC_PATHS = ['/auth', '/cgu'];

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

Run: `cd frontend && npx vitest run lib/__tests__/authGate.test.ts`
Expected: PASS — 7 tests réussis

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/authGate.ts frontend/lib/__tests__/authGate.test.ts
git commit -m "feat: fonction isPublicPath pour le verrou d'auth central"
```

---

### Task 2: Verrou de session dans middleware.ts

**Files:**
- Modify: `frontend/middleware.ts` (remplace le passe-plat actuel)

**Interfaces:**
- Consumes: `isPublicPath(pathname: string): boolean` de la Task 1 (import `@/lib/authGate`).

- [ ] **Step 1: Remplacer le contenu de `frontend/middleware.ts`**

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isPublicPath } from '@/lib/authGate';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)'],
};
```

- [ ] **Step 2: Vérification manuelle — accès refusé sans session**

Run: `cd frontend && npm run dev`

Dans une fenêtre de navigation privée (aucune session Supabase existante) :
- Ouvrir `http://localhost:3000/stock` → doit rediriger vers `http://localhost:3000/auth`.
- Ouvrir `http://localhost:3000/onboarding` → doit rediriger vers `http://localhost:3000/auth`.
- Ouvrir `http://localhost:3000/` → doit rediriger vers `http://localhost:3000/auth`.

Expected: les trois redirigent vers `/auth`, aucune n'affiche son propre contenu.

- [ ] **Step 3: Vérification manuelle — routes publiques accessibles sans session**

Toujours en navigation privée :
- Ouvrir `http://localhost:3000/auth` → doit s'afficher normalement (pas de redirection).
- Ouvrir `http://localhost:3000/auth/nouveau-mot-de-passe` → doit s'afficher normalement.
- Ouvrir `http://localhost:3000/cgu` → doit s'afficher normalement.

Expected: les trois s'affichent sans redirection.

- [ ] **Step 4: Vérification manuelle — session valide inchangée**

Toujours dans le navigateur privé, se connecter avec un compte de test existant sur `/auth`, puis :
- Vérifier l'arrivée sur `/` (ou `/onboarding` si la config n'est pas terminée).
- Naviguer manuellement vers `/stock`, `/ventes`, `/marges`, `/parametres` → chacune doit s'afficher normalement, sans redirection ni reconnexion demandée.

Expected: aucune interruption pour un utilisateur connecté.

- [ ] **Step 5: Commit**

```bash
git add frontend/middleware.ts
git commit -m "feat: exiger une session Supabase sur toutes les pages sauf /auth et /cgu"
```

---

### Task 3: Nettoyage du contrôle redondant dans app/page.tsx

**Files:**
- Modify: `frontend/app/page.tsx:1-51`

**Interfaces:**
- Consumes: rien de nouveau — le middleware (Task 2) garantit désormais qu'aucun utilisateur non connecté n'atteint ce composant.

- [ ] **Step 1: Retirer l'import devenu inutile**

Dans `frontend/app/page.tsx`, supprimer la ligne :

```ts
import { createClient } from '@/lib/supabase/client';
```

- [ ] **Step 2: Retirer l'état `authChecked`**

Supprimer la ligne :

```ts
const [authChecked, setAuthChecked] = useState(false);
```

- [ ] **Step 3: Retirer le `useEffect` de vérification d'auth**

Supprimer entièrement ce bloc (lignes 34-43 avant modification) :

```ts
useEffect(() => {
  const supabase = createClient();
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) {
      router.replace('/auth');
    } else {
      setAuthChecked(true);
    }
  });
}, [router]);
```

- [ ] **Step 4: Simplifier le `useEffect` de redirection vers onboarding**

Remplacer :

```ts
useEffect(() => {
  if (authChecked && isReady && (!config || !config.onboardingComplete)) {
    router.replace('/onboarding');
  }
}, [authChecked, isReady, config, router]);
```

Par :

```ts
useEffect(() => {
  if (isReady && (!config || !config.onboardingComplete)) {
    router.replace('/onboarding');
  }
}, [isReady, config, router]);
```

- [ ] **Step 5: Simplifier la condition d'écran de chargement**

Remplacer :

```ts
if (!authChecked || !isReady || !config) {
```

Par :

```ts
if (!isReady || !config) {
```

- [ ] **Step 6: Vérification — types et build**

Run: `cd frontend && npm run type-check`
Expected: aucune erreur (en particulier, aucune référence orpheline à `authChecked` ou `createClient`).

Run: `cd frontend && npm run build`
Expected: build réussi.

- [ ] **Step 7: Vérification manuelle finale**

Avec `npm run dev`, dans le navigateur déjà connecté (Task 2, Step 4) :
- Recharger `/` → le tableau de bord s'affiche normalement, sans écran de chargement qui reste bloqué.
- Se déconnecter (`/parametres`), puis retenter `/` → doit rediriger vers `/auth` (géré par le middleware, plus par cette page).

Expected : comportement identique à avant le nettoyage, du point de vue de l'utilisateur.

- [ ] **Step 8: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "refactor: retirer le controle d'auth redondant dans page.tsx"
```
