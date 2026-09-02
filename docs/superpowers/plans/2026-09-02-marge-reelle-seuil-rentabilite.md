# Vraie marge et seuil de rentabilité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'onglet unique "Marge" (calculateur + liste) par trois onglets — "Prix de vente" (calculateur, connecté au plancher), "Marge" (marge plancher + repère de marché + liste par catégorie) et "Seuil de rentabilité" (journal de dépenses + objectif de vente) — pour que Juanita sache quelle marge appliquer et combien vendre pour couvrir les charges de sa boutique.

**Architecture:** Nouvelle entité `Depense` suivant exactement le pattern déjà établi par `Produit`/`Vente`/`Fournisseur` dans ce projet : logique pure et testable dans `frontend/backend/`, stockage local Dexie (offline-first), synchronisation cloud Supabase (RLS par `user_id`), hook React pour le CRUD, deux nouveaux composants montés dans `frontend/app/marges/page.tsx`. Le calcul du "plancher" (marge minimum pour couvrir les charges) réutilise les statistiques mensuelles déjà calculées par `calculerStats()` (`@backend/ventes`) — aucune nouvelle agrégation de ventes n'est nécessaire.

**Tech Stack:** Next.js 15 App Router, TypeScript, Dexie.js (IndexedDB), Supabase (Postgres + RLS), Vitest

**Spec:** `docs/superpowers/specs/2026-09-02-marge-reelle-seuil-rentabilite-design.md`

## Global Constraints

- `'use client'` obligatoire sur tout fichier utilisant `localStorage`, hooks React, ou router Next.js
- Inline styles uniquement (aucune classe Tailwind) — suivre le pattern existant de `frontend/app/marges/page.tsx` et `frontend/components/Fournisseurs.tsx`
- Police : `fontFamily: 'Manrope, sans-serif'` (`'"Space Grotesk", sans-serif'` pour les montants/chiffres)
- Couleurs via `useColors()` de `@/lib/hooks/useColors` — ne jamais coder les couleurs en dur
- Taille de police minimum 12px ; boutons minimum 44px de hauteur
- Tout champ numérique : `type="number"` avec `onWheel={e => e.currentTarget.blur()}` (jamais sans ce handler)
- Une dépense a 3 champs : nom, montant, date — pas de récurrence automatique (les charges de Juanita varient trop d'un mois à l'autre, décidé explicitement pendant le brainstorm)
- L'achat de marchandise à revendre n'est **jamais** une dépense — déjà compté via `Vente.benefice`. Ne pas ajouter de champ ou de logique qui le permettrait
- Période de référence partout : mois calendaire en cours (1er du mois à aujourd'hui)
- Accès Premium (`accesFonctionnalitesPremium` de `usePlan()`) requis pour les onglets "Marge" et "Seuil de rentabilité" uniquement — l'onglet "Prix de vente" reste en accès libre pour tous, comme l'actuel `%Marge`
- Le "repère de marché" (x1,3–x2 / x3–x5) est un texte fixe, non calculé, non personnalisé — ne jamais le présenter comme dérivé des charges de Juanita
- L'onglet "Pluriels" existe dans le code (`tab === 'Pluriels'`) mais n'est volontairement pas dans le sélecteur de tabs affiché (`tabs` array) — comportement préexistant, ne pas y toucher, ne pas le "corriger"
- Pas de commentaires de code sauf si le WHY est non-évident
- Tests : Vitest (`cd frontend && npm test`) — tester uniquement les fonctions pures de `backend/`
- Après chaque tâche touchant le code : `cd frontend && npx tsc --noEmit` doit rendre 0 erreur

---

## Fichiers à créer ou modifier

| Action | Fichier | Rôle |
|---|---|---|
| Modifier | `frontend/backend/types.ts` | Ajoute l'interface `Depense` |
| Créer | `frontend/backend/depenses.ts` | Logique pure : validation, filtrage par mois, plancher, conversion coefficient, objectif de vente |
| Créer | `frontend/backend/__tests__/depenses.test.ts` | Tests unitaires |
| Modifier | `frontend/lib/db.ts` | Nouvelle table Dexie `depenses` + `clearLocalData()` mise à jour |
| Créer | `frontend/supabase-migration-2026-09-02-depenses.sql` | Table Supabase + RLS |
| Modifier | `frontend/lib/sync.ts` | Mappers + pull/push pour `depenses` |
| Créer | `frontend/lib/hooks/useDepenses.ts` | Hook CRUD dépenses |
| Créer | `frontend/components/MargeTab.tsx` | Marge plancher + repère de marché + liste des produits par catégorie |
| Créer | `frontend/components/SeuilRentabilite.tsx` | Journal de dépenses + progression + objectif de vente |
| Modifier | `frontend/app/marges/page.tsx` | Renomme l'onglet calculateur, retire la liste (déplacée), monte les 2 nouveaux onglets, connecte le plancher au calculateur |

---

## Task 1 : Types + logique pure `backend/depenses.ts` (TDD)

**Files:**
- Modify: `frontend/backend/types.ts`
- Create: `frontend/backend/depenses.ts`
- Create: `frontend/backend/__tests__/depenses.test.ts`

**Interfaces:**
- Produces:
  - `interface Depense { id: string; nom: string; montant: number; date: number; createdAt: number; updatedAt: number; deleted?: boolean; }`
  - `validerDepense(data: Partial<Depense>): string | null`
  - `depensesDuMois(depenses: Depense[], now?: number): Depense[]`
  - `totalDepenses(depenses: Depense[]): number`
  - `joursRestantsDansLeMois(now?: number): number`
  - `margePlancher(chargesDuMois: number, caDuMois: number): number | null`
  - `coefficientDepuisPlancher(plancherPct: number): number`
  - `interface ObjectifRentabilite { beneficeRestant: number; seuilAtteint: boolean; ventesParJour: number | null; }`
  - `objectifVenteParJour(chargesDuMois: number, beneficeDuMois: number, nombreVentesDuMois: number, now?: number): ObjectifRentabilite`

- [ ] **Step 1 : Ajouter le type dans `frontend/backend/types.ts`**

Ajouter à la fin du fichier :

```typescript
export interface Depense {
  id: string;
  nom: string;
  montant: number;
  date: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

- [ ] **Step 2 : Écrire les tests (ils vont échouer)**

Créer `frontend/backend/__tests__/depenses.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import {
  validerDepense,
  depensesDuMois,
  totalDepenses,
  joursRestantsDansLeMois,
  margePlancher,
  coefficientDepuisPlancher,
  objectifVenteParJour,
} from '../depenses';
import type { Depense } from '../types';

function creerDepense(overrides: Partial<Depense> = {}): Depense {
  const now = Date.now();
  return {
    id: 'd1',
    nom: 'Loyer',
    montant: 50000,
    date: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('validerDepense', () => {
  it('refuse un nom vide', () => {
    expect(validerDepense({ nom: '', montant: 100, date: Date.now() })).toBe('Le nom est obligatoire');
  });

  it('refuse un nom absent', () => {
    expect(validerDepense({ montant: 100, date: Date.now() })).toBe('Le nom est obligatoire');
  });

  it('refuse un montant absent', () => {
    expect(validerDepense({ nom: 'Loyer', date: Date.now() })).toBe('Le montant doit être supérieur à 0');
  });

  it('refuse un montant à 0 ou négatif', () => {
    expect(validerDepense({ nom: 'Loyer', montant: 0, date: Date.now() })).toBe('Le montant doit être supérieur à 0');
    expect(validerDepense({ nom: 'Loyer', montant: -10, date: Date.now() })).toBe('Le montant doit être supérieur à 0');
  });

  it('refuse une date absente', () => {
    expect(validerDepense({ nom: 'Loyer', montant: 100 })).toBe('La date est obligatoire');
  });

  it('accepte une dépense valide', () => {
    expect(validerDepense({ nom: 'Loyer', montant: 50000, date: Date.now() })).toBeNull();
  });
});

describe('depensesDuMois', () => {
  it('ne garde que les dépenses du mois calendaire en cours', () => {
    const now = new Date(2026, 8, 15).getTime(); // 15 septembre 2026
    const cetteMois = creerDepense({ id: 'd1', date: new Date(2026, 8, 1).getTime() });
    const cetteMoisAussi = creerDepense({ id: 'd2', date: now });
    const moisDernier = creerDepense({ id: 'd3', date: new Date(2026, 7, 31).getTime() });
    expect(depensesDuMois([cetteMois, cetteMoisAussi, moisDernier], now)).toEqual([cetteMois, cetteMoisAussi]);
  });
});

describe('totalDepenses', () => {
  it('additionne les montants', () => {
    const depenses = [creerDepense({ montant: 50000 }), creerDepense({ montant: 20000 })];
    expect(totalDepenses(depenses)).toBe(70000);
  });

  it('retourne 0 pour une liste vide', () => {
    expect(totalDepenses([])).toBe(0);
  });
});

describe('joursRestantsDansLeMois', () => {
  it('calcule les jours restants jusqu\'à la fin du mois', () => {
    const now = new Date(2026, 8, 2).getTime(); // 2 septembre 2026 (septembre = 30 jours)
    expect(joursRestantsDansLeMois(now)).toBe(28);
  });

  it('retourne au minimum 1, même le dernier jour du mois', () => {
    const now = new Date(2026, 8, 30).getTime(); // 30 septembre 2026
    expect(joursRestantsDansLeMois(now)).toBe(1);
  });
});

describe('margePlancher', () => {
  it('calcule le pourcentage de charges sur le CA', () => {
    expect(margePlancher(70000, 500000)).toBe(14);
  });

  it('retourne null si le CA du mois est à 0', () => {
    expect(margePlancher(70000, 0)).toBeNull();
  });
});

describe('coefficientDepuisPlancher', () => {
  it('convertit un plancher basé sur le prix de vente en marge basée sur le prix d\'achat', () => {
    expect(coefficientDepuisPlancher(14)).toBe(16.3);
  });

  it('plafonne à 1000 si le plancher atteint ou dépasse 100%', () => {
    expect(coefficientDepuisPlancher(100)).toBe(1000);
  });
});

describe('objectifVenteParJour', () => {
  const now = new Date(2026, 8, 2).getTime(); // 2 septembre 2026, 28 jours restants

  it('signale le seuil atteint si le bénéfice du mois couvre déjà les charges', () => {
    expect(objectifVenteParJour(50000, 60000, 40, now)).toEqual({
      beneficeRestant: 0,
      seuilAtteint: true,
      ventesParJour: null,
    });
  });

  it('retourne ventesParJour à null si aucune vente ce mois', () => {
    expect(objectifVenteParJour(50000, 0, 0, now)).toEqual({
      beneficeRestant: 50000,
      seuilAtteint: false,
      ventesParJour: null,
    });
  });

  it('retourne ventesParJour à null si le bénéfice moyen par vente est nul ou négatif', () => {
    expect(objectifVenteParJour(50000, -1000, 5, now)).toEqual({
      beneficeRestant: 51000,
      seuilAtteint: false,
      ventesParJour: null,
    });
  });

  it('calcule un objectif de ventes par jour dans le cas normal', () => {
    // charges 70000, bénéfice déjà généré 20000 (40 ventes -> 500/vente en moyenne)
    // reste à générer 50000 -> 100 ventes -> 100/28 jours -> arrondi au-dessus = 4
    expect(objectifVenteParJour(70000, 20000, 40, now)).toEqual({
      beneficeRestant: 50000,
      seuilAtteint: false,
      ventesParJour: 4,
    });
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

Run: `cd frontend && npx vitest run backend/__tests__/depenses.test.ts`
Expected: FAIL — `Cannot find module '../depenses'`

- [ ] **Step 4 : Créer `frontend/backend/depenses.ts`**

```typescript
import type { Depense } from './types';

export function validerDepense(data: Partial<Depense>): string | null {
  if (!data.nom || data.nom.trim() === '') return 'Le nom est obligatoire';
  if (data.montant === undefined || data.montant <= 0) return 'Le montant doit être supérieur à 0';
  if (data.date === undefined) return 'La date est obligatoire';
  return null;
}

function debutMois(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function depensesDuMois(depenses: Depense[], now: number = Date.now()): Depense[] {
  const debut = debutMois(now);
  return depenses.filter((d) => d.date >= debut);
}

export function totalDepenses(depenses: Depense[]): number {
  return depenses.reduce((sum, d) => sum + d.montant, 0);
}

export function joursRestantsDansLeMois(now: number = Date.now()): number {
  const d = new Date(now);
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(1, dernierJour - d.getDate());
}

export function margePlancher(chargesDuMois: number, caDuMois: number): number | null {
  if (caDuMois <= 0) return null;
  return Math.round((chargesDuMois / caDuMois) * 1000) / 10;
}

export function coefficientDepuisPlancher(plancherPct: number): number {
  if (plancherPct >= 100) return 1000;
  return Math.round((plancherPct / (100 - plancherPct)) * 1000) / 10;
}

export interface ObjectifRentabilite {
  beneficeRestant: number;
  seuilAtteint: boolean;
  ventesParJour: number | null;
}

export function objectifVenteParJour(
  chargesDuMois: number,
  beneficeDuMois: number,
  nombreVentesDuMois: number,
  now: number = Date.now()
): ObjectifRentabilite {
  const beneficeRestant = Math.max(0, chargesDuMois - beneficeDuMois);
  if (beneficeRestant === 0) {
    return { beneficeRestant: 0, seuilAtteint: true, ventesParJour: null };
  }
  if (nombreVentesDuMois === 0) {
    return { beneficeRestant, seuilAtteint: false, ventesParJour: null };
  }
  const beneficeMoyenParVente = beneficeDuMois / nombreVentesDuMois;
  if (beneficeMoyenParVente <= 0) {
    return { beneficeRestant, seuilAtteint: false, ventesParJour: null };
  }
  const ventesRestantes = beneficeRestant / beneficeMoyenParVente;
  const jours = joursRestantsDansLeMois(now);
  return { beneficeRestant, seuilAtteint: false, ventesParJour: Math.ceil(ventesRestantes / jours) };
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

Run: `cd frontend && npx vitest run backend/__tests__/depenses.test.ts`
Expected: tous les tests passent

- [ ] **Step 6 : Vérifier les types et la suite complète**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

Run: `cd frontend && npm test`
Expected: tous les fichiers de test passent (celui-ci + les existants)

- [ ] **Step 7 : Commit**

```bash
git add frontend/backend/types.ts frontend/backend/depenses.ts frontend/backend/__tests__/depenses.test.ts
git commit -m "feat: logique depenses - validation, plancher de marge, objectif de vente"
```

---

## Task 2 : Stockage local (Dexie) + migration Supabase + synchronisation cloud

**Files:**
- Modify: `frontend/lib/db.ts`
- Create: `frontend/supabase-migration-2026-09-02-depenses.sql`
- Modify: `frontend/lib/sync.ts`

**Interfaces:**
- Consumes: `Depense` de `@backend/types` (Task 1)
- Produces:
  - `db.depenses: EntityTable<Depense, 'id'>` (Dexie, exportée via `db` déjà exporté par `lib/db.ts`)
  - `clearLocalData()` (déjà existante, étendue pour vider aussi cette table)
  - Table Supabase `depenses` avec RLS par `user_id`
  - `pull()`/`push()` de `lib/sync.ts` (déjà exportées via `fullSync`) synchronisent désormais aussi cette table

- [ ] **Step 1 : Mettre à jour `frontend/lib/db.ts`**

Remplacer la ligne d'import :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande } from '@backend/types';
```

par :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande, Depense } from '@backend/types';
```

Dans la classe `MargoDB`, ajouter un champ après `commandes!: EntityTable<Commande, 'id'>;` :

```typescript
  depenses!: EntityTable<Depense, 'id'>;
```

Ajouter une nouvelle version de schéma après le bloc `this.version(6).stores({...});` existant (à l'intérieur du constructeur) :

```typescript
    // v7 - journal de depenses (charges de la boutique) pour le seuil de rentabilite
    this.version(7).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      fournisseurs: 'id, nom, updatedAt, deleted',
      commandes: 'id, fournisseurId, dateCommande, updatedAt, deleted',
      depenses: 'id, date, updatedAt, deleted',
      config: 'id',
    });
```

Mettre à jour `clearLocalData()` (déjà existante dans ce fichier) pour vider aussi cette nouvelle table :

```typescript
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [db.produits, db.ventes, db.packs, db.fournisseurs, db.commandes, db.depenses, db.config], async () => {
    await db.produits.clear();
    await db.ventes.clear();
    await db.packs.clear();
    await db.fournisseurs.clear();
    await db.commandes.clear();
    await db.depenses.clear();
    await db.config.clear();
  });
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Créer la migration SQL `frontend/supabase-migration-2026-09-02-depenses.sql`**

```sql
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
```

- [ ] **Step 4 : Mettre à jour `frontend/lib/sync.ts` — imports et mappers**

Remplacer la ligne d'import :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande } from '@backend/types';
```

par :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande, Depense } from '@backend/types';
```

Repérer la fonction `rowToCommande` (elle se termine juste avant le commentaire `// ---------------------------------------------------------------------\n// Helpers`). Juste après sa fermeture, avant ce commentaire `// Helpers`, ajouter :

```typescript
type DepenseRow = {
  id: string;
  user_id: string;
  nom: string;
  montant: number;
  date: number;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

function depenseToRow(d: Depense, userId: string): DepenseRow {
  return {
    id: d.id,
    user_id: userId,
    nom: d.nom,
    montant: d.montant,
    date: d.date,
    created_at: d.createdAt ?? Date.now(),
    updated_at: d.updatedAt ?? Date.now(),
    deleted: d.deleted ?? false,
  };
}

function rowToDepense(r: DepenseRow): Depense {
  return {
    id: r.id,
    nom: r.nom,
    montant: Number(r.montant),
    date: Number(r.date),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}
```

- [ ] **Step 5 : Étendre `pull()` dans `frontend/lib/sync.ts`**

Repérer le bloc `// --- commandes (non-fatal : si la table n'existe pas encore, on continue) ---` à l'intérieur de la fonction `pull`, juste avant sa fermeture (`}` qui suit son `catch`). Juste après ce bloc commandes, ajouter :

```typescript
  // --- depenses (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const { data: depensesRows, error: depErr } = await supabase
      .from('depenses')
      .select('*')
      .eq('user_id', userId);
    if (depErr) throw depErr;

    for (const row of (depensesRows ?? []) as DepenseRow[]) {
      const remote = rowToDepense(row);
      const local = await db.depenses.get(remote.id);
      if (!local || remote.updatedAt > (local.updatedAt ?? 0)) {
        await db.depenses.put(remote);
      }
    }
  } catch (err) {
    console.warn('[sync] pull depenses ignoré :', err);
  }
```

- [ ] **Step 6 : Étendre `push()` dans `frontend/lib/sync.ts`**

Repérer le bloc `// --- commandes (non-fatal : si la table n'existe pas encore, on continue) ---` à l'intérieur de la fonction `push`, juste avant sa fermeture (`}` qui précède le commentaire `// FULL SYNC`). Juste après ce bloc commandes, ajouter :

```typescript
  // --- depenses (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const depenses = await db.depenses.toArray();
    if (depenses.length > 0) {
      const rows = depenses.map((d) => depenseToRow(d, userId));
      const { error } = await supabase.from('depenses').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (err) {
    console.warn('[sync] push depenses ignoré :', err);
  }
```

- [ ] **Step 7 : Vérifier les types et les tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

Run: `cd frontend && npm test`
Expected: tous les tests passent

- [ ] **Step 8 : Commit**

```bash
git add frontend/lib/db.ts frontend/lib/sync.ts frontend/supabase-migration-2026-09-02-depenses.sql
git commit -m "feat: stockage local + sync cloud pour le journal de depenses"
```

---

## Task 3 : Hook `useDepenses`

**Files:**
- Create: `frontend/lib/hooks/useDepenses.ts`

**Interfaces:**
- Consumes: `db.depenses`, `genId` de `../db` (Task 2) ; `validerDepense` de `@backend/depenses` (Task 1) ; `requestSync` de `../syncController` (déjà existant)
- Produces: `useDepenses()` retournant `{ depenses: Depense[]; ajouterDepense(data): Promise<string|null>; modifierDepense(id, data): Promise<string|null>; supprimerDepense(id): Promise<void>; }`

- [ ] **Step 1 : Créer `frontend/lib/hooks/useDepenses.ts`**

```typescript
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerDepense } from '@backend/depenses';
import { requestSync } from '../syncController';
import type { Depense } from '@backend/types';

export function useDepenses() {
  const depenses = useLiveQuery(
    () => db.depenses.orderBy('date').reverse().filter((d) => !d.deleted).toArray()
  ) ?? [];

  async function ajouterDepense(
    data: Omit<Depense, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> {
    const erreur = validerDepense(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.depenses.add({ ...data, id: genId(), createdAt: now, updatedAt: now, deleted: false });
    requestSync();
    return null;
  }

  async function modifierDepense(
    id: string,
    data: Partial<Omit<Depense, 'id' | 'createdAt'>>
  ): Promise<string | null> {
    const erreur = validerDepense(data);
    if (erreur) return erreur;
    await db.depenses.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerDepense(id: string) {
    await db.depenses.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  return { depenses, ajouterDepense, modifierDepense, supprimerDepense };
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/hooks/useDepenses.ts
git commit -m "feat: hook useDepenses - CRUD journal de depenses"
```

---

## Task 4 : Composant `MargeTab.tsx` (marge plancher, repère de marché, liste par catégorie)

**Files:**
- Create: `frontend/components/MargeTab.tsx`

**Interfaces:**
- Consumes: `useStock()`, `useConfig()`, `useColors()` (déjà existants) ; `useDepenses()` (Task 3) ; `useVentes` de `@/lib/hooks/useVentes` (déjà existant) ; `usePlan()` (déjà existant) ; `depensesDuMois`, `totalDepenses`, `margePlancher` de `@backend/depenses` (Task 1) ; `AccesPremiumRequis` de `./AccesPremiumRequis` (déjà existant)
- Produces: `MargeTab` (composant, export nommé, sans props) — consommé par `marges/page.tsx` (Task 6)

- [ ] **Step 1 : Créer `frontend/components/MargeTab.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { depensesDuMois, totalDepenses, margePlancher } from '@backend/depenses';
import { AccesPremiumRequis } from './AccesPremiumRequis';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const PLANCHER_DEFAUT = 25;

export function MargeTab() {
  const T = useColors();
  const { produits } = useStock();
  const { config } = useConfig();
  const { depenses } = useDepenses();
  const { stats } = useVentes('mois');
  const { accesFonctionnalitesPremium } = usePlan();
  const [catsOuvertes, setCatsOuvertes] = useState<Record<string, boolean>>({});

  const symbole = config?.symboleDevise ?? 'FCFA';

  if (!accesFonctionnalitesPremium) {
    return (
      <div style={{ padding: '0 16px' }}>
        <AccesPremiumRequis titre="Marge" description="Connais ta vraie marge, celle qui couvre aussi les charges de ta boutique." />
      </div>
    );
  }

  const chargesDuMois = totalDepenses(depensesDuMois(depenses));
  const plancherPct = margePlancher(chargesDuMois, stats.chiffreAffaires);
  const seuilAffichage = plancherPct ?? PLANCHER_DEFAUT;

  const produitsAvecMarges = produits.map(p => ({
    ...p,
    pct: p.prixVente > 0 ? Math.round((p.prixVente - p.prixAchat) / p.prixVente * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  const avgPct = produitsAvecMarges.length > 0
    ? Math.round(produitsAvecMarges.reduce((s, p) => s + p.pct, 0) / produitsAvecMarges.length)
    : 0;

  return (
    <div style={{ padding: '0 16px' }}>
      {/* MARGE PLANCHER */}
      <div style={{ background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
          Marge plancher
        </div>
        {plancherPct === null ? (
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Pas encore assez de ventes ce mois pour calculer ta marge plancher.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.red, fontFamily: '"Space Grotesk", sans-serif', marginBottom: 6 }}>
              {plancherPct}%
            </div>
            <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.5 }}>
              En dessous de {plancherPct}%, tu ne gagnes rien une fois tes charges payées.
            </div>
          </>
        )}
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, lineHeight: 1.5 }}>
          💡 Repère : produits courants x1,3 à x2 le prix d&apos;achat, produits à forte valeur (cosmétique, habillement...) x3 à x5.
        </div>
      </div>

      {/* LISTE GROUPÉE PAR CATÉGORIE */}
      {produitsAvecMarges.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M3 3v18h18" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 14l3-3 3 3 4-5" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun produit à analyser</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Ajoutez des produits dans l&apos;onglet Stock</div>
        </div>
      ) : (() => {
        const groupes = new Map<string, typeof produitsAvecMarges>();
        for (const p of produitsAvecMarges) {
          const cle = p.categorie?.trim() || 'Sans catégorie';
          if (!groupes.has(cle)) groupes.set(cle, []);
          groupes.get(cle)!.push(p);
        }
        const listeGroupes = Array.from(groupes.entries()).sort((a, b) => {
          if (a[0] === 'Sans catégorie') return 1;
          if (b[0] === 'Sans catégorie') return -1;
          return a[0].localeCompare(b[0]);
        });
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listeGroupes.map(([cat, items]) => {
              const ouvert = catsOuvertes[cat] ?? false;
              const moyenneCat = Math.round(items.reduce((s, p) => s + p.pct, 0) / items.length);
              const catOk = moyenneCat >= seuilAffichage;
              return (
                <div key={cat} style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
                  <button onClick={() => setCatsOuvertes(o => ({ ...o, [cat]: !ouvert }))}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                      <path d="M9 6l6 6-6 6" stroke={T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
                    <span style={{ fontSize: 12, color: T.textMuted }}>{items.length} produit{items.length > 1 ? 's' : ''}</span>
                    <span style={{ background: catOk ? T.greenBg : T.redBg, color: catOk ? T.green : T.red, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '3px 8px', fontFamily: '"Space Grotesk", sans-serif', flexShrink: 0 }}>
                      {moyenneCat}%
                    </span>
                  </button>
                  {ouvert && (
                    <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map(p => {
                        const isGood = p.pct >= seuilAffichage;
                        const delta = p.pct - avgPct;
                        return (
                          <div key={p.id} style={{ background: T.bgSubtle, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: isGood ? T.greenBg : T.redBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontSize: 18, fontWeight: 800, color: isGood ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif', lineHeight: 1 }}>{p.pct}</span>
                              <span style={{ fontSize: 9, fontWeight: 700, color: isGood ? T.green : T.red }}>%</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nom}</div>
                              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: '"Space Grotesk", sans-serif' }}>
                                {fmtF(p.prixVente)} {symbole} · {p.quantite} unités
                              </div>
                            </div>
                            {delta !== 0 && (
                              <span style={{ fontSize: 12, fontWeight: 700, color: delta > 0 ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif', flexShrink: 0 }}>
                                {delta > 0 ? '+' : ''}{delta}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/MargeTab.tsx
git commit -m "feat: composant MargeTab - plancher, repere de marche, liste par categorie"
```

Note : ce composant n'est pas encore monté nulle part (Task 6) — le test manuel bout-en-bout se fait à la fin de la Task 6.

---

## Task 5 : Composant `SeuilRentabilite.tsx` (journal de dépenses, progression, objectif)

**Files:**
- Create: `frontend/components/SeuilRentabilite.tsx`

**Interfaces:**
- Consumes: `useConfig()`, `useColors()` (déjà existants) ; `useDepenses()` (Task 3) ; `useVentes` de `@/lib/hooks/useVentes` (déjà existant) ; `usePlan()` (déjà existant) ; `depensesDuMois`, `totalDepenses`, `objectifVenteParJour` de `@backend/depenses` (Task 1) ; `AccesPremiumRequis` de `./AccesPremiumRequis` (déjà existant) ; `Depense` de `@backend/types` (Task 1)
- Produces: `SeuilRentabilite` (composant, export nommé, sans props) — consommé par `marges/page.tsx` (Task 6)

- [ ] **Step 1 : Créer `frontend/components/SeuilRentabilite.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { depensesDuMois, totalDepenses, objectifVenteParJour } from '@backend/depenses';
import { AccesPremiumRequis } from './AccesPremiumRequis';
import type { Depense } from '@backend/types';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function dateInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function parseDateLocale(iso: string): number {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour).getTime();
}

const champsVides = () => ({ nom: '', montant: '', date: dateInputValue(Date.now()) });

export function SeuilRentabilite() {
  const T = useColors();
  const { config } = useConfig();
  const { depenses, ajouterDepense, modifierDepense, supprimerDepense } = useDepenses();
  const { stats } = useVentes('mois');
  const { accesFonctionnalitesPremium } = usePlan();
  const symbole = config?.symboleDevise ?? 'FCFA';

  const [showForm, setShowForm] = useState(false);
  const [champs, setChamps] = useState(champsVides());
  const [erreur, setErreur] = useState('');
  const [depenseEnEdition, setDepenseEnEdition] = useState<Depense | null>(null);

  if (!accesFonctionnalitesPremium) {
    return (
      <div style={{ padding: '0 16px' }}>
        <AccesPremiumRequis titre="Seuil de rentabilité" description="Sais combien vendre par jour pour couvrir tes charges et être vraiment rentable." />
      </div>
    );
  }

  const depensesMois = depensesDuMois(depenses);
  const chargesDuMois = totalDepenses(depensesMois);
  const objectif = objectifVenteParJour(chargesDuMois, stats.benefice, stats.nombreVentes);
  const progression = chargesDuMois > 0 ? Math.min(100, Math.round((stats.benefice / chargesDuMois) * 100)) : 0;

  async function handleAjouter() {
    setErreur('');
    const err = await ajouterDepense({
      nom: champs.nom.trim(),
      montant: Number(champs.montant),
      date: parseDateLocale(champs.date),
    });
    if (err) { setErreur(err); return; }
    setChamps(champsVides());
    setShowForm(false);
  }

  function ouvrirEdition(d: Depense) {
    setShowForm(false);
    setErreur('');
    setDepenseEnEdition(d);
    setChamps({ nom: d.nom, montant: String(d.montant), date: dateInputValue(d.date) });
  }

  async function handleModifier() {
    if (!depenseEnEdition) return;
    setErreur('');
    const err = await modifierDepense(depenseEnEdition.id, {
      nom: champs.nom.trim(),
      montant: Number(champs.montant),
      date: parseDateLocale(champs.date),
    });
    if (err) { setErreur(err); return; }
    setDepenseEnEdition(null);
    setChamps(champsVides());
  }

  const inputStyle = {
    width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
    fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ padding: '0 16px' }}>
      {/* CHARGES DU MOIS */}
      <div style={{ background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Charges du mois
          </div>
          <button
            onClick={() => { setDepenseEnEdition(null); setChamps(champsVides()); setShowForm(true); }}
            style={{ height: 32, padding: '0 12px', borderRadius: 8, background: T.accentLight, color: T.accent, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}
          >
            + Dépense
          </button>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif', marginBottom: 4 }}>
          {fmtF(chargesDuMois)} <span style={{ fontSize: 15 }}>{symbole}</span>
        </div>

        {(showForm || depenseEnEdition) && (
          <div style={{ background: T.bgSubtle, borderRadius: 14, padding: 14, marginTop: 12 }}>
            {erreur && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreur}
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom (ex : Loyer, Transport)</label>
              <input type="text" value={champs.nom} onChange={e => setChamps(c => ({ ...c, nom: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Montant ({symbole})</label>
              <input type="number" onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()} value={champs.montant} onChange={e => setChamps(c => ({ ...c, montant: e.target.value }))} placeholder="0" min="0" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Date</label>
              <input type="date" value={champs.date} onChange={e => setChamps(c => ({ ...c, date: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowForm(false); setDepenseEnEdition(null); setErreur(''); }}
                style={{ flex: 1, height: 44, borderRadius: 12, background: T.surface, border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={depenseEnEdition ? handleModifier : handleAjouter}
                style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}
              >
                {depenseEnEdition ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
            {depenseEnEdition && (
              <button
                onClick={() => { supprimerDepense(depenseEnEdition.id); setDepenseEnEdition(null); setChamps(champsVides()); }}
                style={{ width: '100%', height: 40, marginTop: 8, borderRadius: 12, background: 'none', border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textMuted, fontFamily: 'Manrope, sans-serif' }}
              >
                Supprimer cette dépense
              </button>
            )}
          </div>
        )}

        {depensesMois.length > 0 && !showForm && !depenseEnEdition && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {depensesMois.map(d => (
              <button
                key={d.id}
                onClick={() => ouvrirEdition(d)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgSubtle, borderRadius: 10, padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Manrope, sans-serif' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.nom}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.textSub, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(d.montant)} {symbole}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PROGRESSION ET OBJECTIF */}
      <div style={{ background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
          Progression ce mois
        </div>

        {chargesDuMois === 0 ? (
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Ajoute tes charges pour voir ta progression vers la rentabilité.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textSub, marginBottom: 6 }}>
              <span>{fmtF(stats.benefice)} {symbole} générés</span>
              <span>{fmtF(chargesDuMois)} {symbole} à couvrir</span>
            </div>
            <div style={{ width: '100%', height: 10, borderRadius: 6, background: T.bgSubtle, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ width: `${progression}%`, height: '100%', background: progression >= 100 ? T.green : T.accent, borderRadius: 6 }} />
            </div>

            {objectif.seuilAtteint ? (
              <div style={{ background: T.greenBg, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 600, color: T.green }}>
                Tu as couvert tes charges ce mois, tout bénéfice supplémentaire est net pour toi.
              </div>
            ) : objectif.ventesParJour === null ? (
              <div style={{ fontSize: 13, color: T.textMuted }}>
                Pas encore assez de ventes ce mois pour calculer ton objectif.
              </div>
            ) : (
              <div style={{ background: T.accentLight, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, color: T.textSub, marginBottom: 4 }}>Objectif</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                  ≈ {objectif.ventesParJour} vente{objectif.ventesParJour > 1 ? 's' : ''}/jour
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>jusqu&apos;à la fin du mois</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/SeuilRentabilite.tsx
git commit -m "feat: composant SeuilRentabilite - journal de depenses, progression, objectif"
```

Note : ce composant n'est pas encore monté nulle part (Task 6) — le test manuel bout-en-bout se fait à la fin de la Task 6.

---

## Task 6 : Intégration dans la page Marges

**Files:**
- Modify: `frontend/app/marges/page.tsx`

**Note de mise à jour (constat pré-vol) :** ce fichier a évolué depuis l'écriture initiale de ce plan — l'onglet "Meilleurs vendeurs" (avec `useVentes`, `usePlan`, `PERIODES`, etc.) a été ajouté entre-temps sur la branche réelle. Les étapes ci-dessous ont été corrigées pour refléter le fichier tel qu'il existe réellement (vérifié dans le worktree avant dispatch). Ne pas re-déduire ces blocs depuis une version plus ancienne du fichier.

**Interfaces:**
- Consumes: `MargeTab` de `@/components/MargeTab` (Task 4) ; `SeuilRentabilite` de `@/components/SeuilRentabilite` (Task 5) ; `useDepenses` de `@/lib/hooks/useDepenses` (Task 3) ; `calculerStats` de `@backend/ventes` (déjà existant, déjà utilisé pour les stats jour/semaine/mois ailleurs dans l'app) ; `depensesDuMois`, `totalDepenses`, `margePlancher`, `coefficientDepuisPlancher` de `@backend/depenses` (Task 1)

- [ ] **Step 1 : Ajouter les imports**

En haut de `frontend/app/marges/page.tsx`, repérer :

```typescript
import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { meilleursProduits, filtrerParPeriode } from '@backend/ventes';
import type { Periode } from '@backend/types';
import { AccesPremiumRequis } from '@/components/AccesPremiumRequis';
```

Remplacer par :

```typescript
import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { useDepenses } from '@/lib/hooks/useDepenses';
import { meilleursProduits, filtrerParPeriode, calculerStats } from '@backend/ventes';
import { depensesDuMois, totalDepenses, margePlancher, coefficientDepuisPlancher } from '@backend/depenses';
import type { Periode } from '@backend/types';
import { AccesPremiumRequis } from '@/components/AccesPremiumRequis';
import { MargeTab } from '@/components/MargeTab';
import { SeuilRentabilite } from '@/components/SeuilRentabilite';
```

Ne pas ajouter un second import de `useVentes` — il est déjà importé et déjà appelé plus bas dans le fichier (`const { ventes } = useVentes();`) pour l'onglet "Meilleurs vendeurs". On réutilise ce même tableau `ventes` avec `calculerStats(ventes, 'mois')` plutôt que d'appeler `useVentes('mois')` une seconde fois (évite un deuxième abonnement Dexie redondant).

- [ ] **Step 2 : Renommer le type d'onglets et l'état initial, ajouter le calcul du plancher**

Repérer ce bloc (le tout début du composant, avant `PERIODES`) :

```typescript
type TabMode = '%Marge' | 'Pluriels' | 'Catalogue' | 'Meilleurs vendeurs';

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'jour', label: "Aujourd'hui" },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'tout', label: 'Tout' },
];

export default function MargesPage() {
  const T = useColors();
  const { produits } = useStock();
  const { config } = useConfig();
  const { accesFonctionnalitesPremium } = usePlan();
  const [tab, setTab] = useState<TabMode>('%Marge');
  const [periodeVendeurs, setPeriodeVendeurs] = useState<Periode>('semaine');
  const [triVendeurs, setTriVendeurs] = useState<'quantite' | 'benefice'>('quantite');
  const [voirTousVendeurs, setVoirTousVendeurs] = useState(false);
  const { ventes } = useVentes();
  const [prixAchat, setPrixAchat] = useState('');
  const [margePctStr, setMargePctStr] = useState('30');
  const margePct = Math.min(1000, Math.max(0, Number(margePctStr) || 0));
  const [simProduitId, setSimProduitId] = useState('');
  const [simQte, setSimQte] = useState('');
  const [simPrixGros, setSimPrixGros] = useState('');
  const [catsOuvertes, setCatsOuvertes] = useState<Record<string, boolean>>({});
  const [catalogueMsg, setCatalogueMsg] = useState('');
  const [genEnCours, setGenEnCours] = useState(false);
  const [produitVitrine, setProduitVitrine] = useState<typeof produits[number] | null>(null);
```

Remplacer par :

```typescript
type TabMode = 'Prix de vente' | 'Marge' | 'Seuil de rentabilité' | 'Pluriels' | 'Catalogue' | 'Meilleurs vendeurs';

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'jour', label: "Aujourd'hui" },
  { value: 'semaine', label: 'Semaine' },
  { value: 'mois', label: 'Mois' },
  { value: 'tout', label: 'Tout' },
];

export default function MargesPage() {
  const T = useColors();
  const { produits } = useStock();
  const { config } = useConfig();
  const { accesFonctionnalitesPremium } = usePlan();
  const { depenses } = useDepenses();
  const [tab, setTab] = useState<TabMode>('Prix de vente');
  const [periodeVendeurs, setPeriodeVendeurs] = useState<Periode>('semaine');
  const [triVendeurs, setTriVendeurs] = useState<'quantite' | 'benefice'>('quantite');
  const [voirTousVendeurs, setVoirTousVendeurs] = useState(false);
  const { ventes } = useVentes();
  const [prixAchat, setPrixAchat] = useState('');
  const [margePctOverride, setMargePctOverride] = useState<string | null>(null);
  const [simProduitId, setSimProduitId] = useState('');
  const [simQte, setSimQte] = useState('');
  const [simPrixGros, setSimPrixGros] = useState('');
  const [catalogueMsg, setCatalogueMsg] = useState('');
  const [genEnCours, setGenEnCours] = useState(false);
  const [produitVitrine, setProduitVitrine] = useState<typeof produits[number] | null>(null);

  const statsMoisCourant = calculerStats(ventes, 'mois');
  const chargesDuMoisCourant = totalDepenses(depensesDuMois(depenses));
  const plancherPct = margePlancher(chargesDuMoisCourant, statsMoisCourant.chiffreAffaires);
  const plancherCoefficient = plancherPct !== null ? coefficientDepuisPlancher(plancherPct) : null;
  const margePctStr = margePctOverride ?? (plancherCoefficient !== null ? String(plancherCoefficient) : '30');
  const margePct = Math.min(1000, Math.max(0, Number(margePctStr) || 0));
```

Note : l'état `catsOuvertes` (juste après `produitVitrine` dans le bloc d'origine) a été retiré ici volontairement — il ne sert plus dans `page.tsx`, sa seule utilisation (liste par catégorie) est déplacée dans `MargeTab` (Task 4), qui déclare son propre état `catsOuvertes` local.

- [ ] **Step 3 : Retirer la liste `produitsAvecMarges`/`avgPct` devenue inutile ici (déplacée dans `MargeTab`)**

Repérer ce bloc, juste avant le calcul du calculateur :

```typescript
  const produitsAvecMarges = produits.map(p => ({
    ...p,
    pct: p.prixVente > 0 ? Math.round((p.prixVente - p.prixAchat) / p.prixVente * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  const avgPct = produitsAvecMarges.length > 0
    ? Math.round(produitsAvecMarges.reduce((s, p) => s + p.pct, 0) / produitsAvecMarges.length)
    : 0;

  const prixAchatNum = parseFloat(prixAchat) || 0;
```

Remplacer par :

```typescript
  const prixAchatNum = parseFloat(prixAchat) || 0;
```

- [ ] **Step 4 : Mettre à jour le tableau `tabs` affiché par le sélecteur**

Repérer :

```typescript
  const tabs: TabMode[] = ['%Marge', 'Meilleurs vendeurs', 'Catalogue'];
```

Remplacer par :

```typescript
  const tabs: TabMode[] = ['Prix de vente', 'Marge', 'Seuil de rentabilité', 'Meilleurs vendeurs', 'Catalogue'];
```

(`'Pluriels'` reste volontairement absent de ce tableau — comportement préexistant inchangé. `'Meilleurs vendeurs'` reste à sa place, fonctionnalité déjà en production, non concernée par ce plan.)

- [ ] **Step 5 : Remplacer le bloc `{tab === '%Marge' && (...)}` — calculateur seul + alerte, plus montage des 2 nouveaux onglets**

(Ce remplacement inclut déjà les `onChange` corrigés vers `setMargePctOverride` sur l'input numérique et le curseur — pas besoin de les éditer séparément avant.)

Repérer le bloc qui commence par `{tab === '%Marge' && (` et se termine par le `)}` juste avant `{tab === 'Pluriels' && (() => {`. Ce bloc contient actuellement le "CALCULATOR" suivi de la "LISTE GROUPÉE PAR CATÉGORIE". Le remplacer intégralement par :

```typescript
      {tab === 'Prix de vente' && (
        <div style={{ margin: '0 16px 16px', background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
            Calculateur
          </div>

          {/* Prix d'achat */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>
              Prix d&apos;achat ({symbole})
            </div>
            <div style={{ background: T.bgSubtle, borderRadius: 12, padding: '12px 16px' }}>
              <input
                type="number" onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()}
                value={prixAchat}
                onChange={e => setPrixAchat(e.target.value)}
                placeholder="0"
                min="0"
                style={{
                  width: '100%', border: 'none', background: 'transparent',
                  fontSize: 28, fontWeight: 800, color: T.text,
                  outline: 'none', fontFamily: '"Space Grotesk", sans-serif',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Marge souhaitée */}
          <div style={{ marginBottom: prixVenteCalc > 0 ? 14 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Marge souhaitée</div>
              <div style={{
                background: T.bgSubtle, borderRadius: 10, padding: '6px 12px',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <input
                  type="number" onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()}
                  min={0}
                  max={1000}
                  value={margePctStr}
                  onChange={e => setMargePctOverride(e.target.value)}
                  style={{
                    width: 52, border: 'none', background: 'transparent',
                    fontSize: 16, fontWeight: 800, color: T.accent,
                    fontFamily: '"Space Grotesk", sans-serif',
                    outline: 'none', textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={margePct}
              onChange={e => setMargePctOverride(e.target.value)}
              style={{ width: '100%', accentColor: T.accent }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textMuted, marginTop: 4 }}>
              <span>0%</span>
              <span>250%</span>
              <span>500%</span>
              <span>1000%+</span>
            </div>
          </div>

          {/* Résultat */}
          {prixVenteCalc > 0 && (
            <>
              <div style={{ background: T.accentLight, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Prix de vente conseillé</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                    {fmtF(prixVenteCalc)} <span style={{ fontSize: 13 }}>{symbole}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Bénéfice par unité</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: T.green, fontFamily: '"Space Grotesk", sans-serif' }}>
                    +{fmtF(beneficeCalc)} <span style={{ fontSize: 13 }}>{symbole}</span>
                  </div>
                </div>
              </div>
              {plancherPct !== null && plancherCoefficient !== null && margePct < plancherCoefficient && (
                <div style={{ marginTop: 10, background: T.redBg, borderRadius: 12, padding: '10px 14px', fontSize: 12, fontWeight: 600, color: T.red, lineHeight: 1.5 }}>
                  En dessous de {plancherPct}%, tu ne gagnes rien une fois tes charges payées.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'Marge' && <MargeTab />}

      {tab === 'Seuil de rentabilité' && <SeuilRentabilite />}

```

Ne pas toucher aux blocs `{tab === 'Pluriels' && (...)}` et `{tab === 'Catalogue' && (...)}` qui suivent — ils restent identiques.

- [ ] **Step 6 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 7 : Lancer le dev server et tester manuellement**

Run: `cd frontend && npm run dev`

1. Ouvrir `http://localhost:3000/marges`
2. Vérifier que le sélecteur affiche 5 onglets : Prix de vente / Marge / Seuil de rentabilité / Meilleurs vendeurs / Catalogue ("Pluriels" absent comme avant)
3. Sur "Prix de vente" : le calculateur fonctionne comme avant (accessible sans Premium). Taper un prix d'achat, vérifier que le résultat s'affiche
4. Sur "Meilleurs vendeurs" : vérifier que cet onglet existant fonctionne toujours exactement comme avant (filtres de période, tri quantité/bénéfice) — non concerné par ce plan, juste vérifier l'absence de régression
5. Sur "Marge" et "Seuil de rentabilité" sans compte Premium : le message "fonctionnalité Premium" s'affiche
6. Passer le compte de test en Premium (ou utiliser un compte déjà Premium)
7. Sur "Seuil de rentabilité" : ajouter une dépense test (ex. "Loyer", 50000, aujourd'hui), vérifier qu'elle apparaît dans la liste et dans "Charges du mois", vérifier la barre de progression et l'objectif si des ventes existent ce mois-ci
8. Sur "Marge" : vérifier que la marge plancher s'affiche (ou le message "pas assez de ventes" si aucune vente ce mois), que le repère de marché s'affiche, et que la liste de produits par catégorie (déplacée depuis l'ancien onglet) fonctionne comme avant
9. Retourner sur "Prix de vente" : vérifier que le champ "Marge souhaitée" est maintenant pré-rempli avec une valeur cohérente avec le plancher (pas 30% par défaut), et que taper une marge en dessous du plancher affiche l'alerte rouge
10. Arrêter le serveur dev (Ctrl+C)

- [ ] **Step 8 : Commit**

```bash
git add frontend/app/marges/page.tsx
git commit -m "feat: separe Prix de vente / Marge / Seuil de rentabilite en 3 onglets"
```

---

## Task 7 : Migration Supabase (étape manuelle, hors code)

**Files:** aucun — étape à effectuer par Juanita dans le dashboard Supabase.

- [ ] **Step 1 : Exécuter la migration**

Dans Supabase Dashboard → SQL Editor → New query, coller le contenu de `frontend/supabase-migration-2026-09-02-depenses.sql` (créé à la Task 2) → Run.

- [ ] **Step 2 : Test de bout en bout par Juanita**

Une fois toutes les tâches déployées en production et la migration exécutée :
1. Ajouter une vraie dépense (ex. loyer réel) dans "Seuil de rentabilité"
2. Vérifier que la marge plancher dans l'onglet "Marge" reflète bien cette charge
3. Vérifier que le calculateur dans "Prix de vente" propose une marge par défaut cohérente
4. Se déconnecter/reconnecter (ou ouvrir sur un autre appareil) pour confirmer que la dépense est bien synchronisée dans le cloud
