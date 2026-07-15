# Fournisseurs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à Juanita de gérer une liste de fournisseurs, suivre l'historique de ses commandes auprès de chacun, et être alertée quand une livraison attendue est en retard.

**Architecture:** Deux nouvelles entités (`Fournisseur`, `Commande`) suivant exactement le pattern déjà établi par `Produit`/`Vente`/`Pack` dans ce projet : logique pure et testable dans `backend/`, stockage local Dexie (offline-first), synchronisation cloud Supabase (RLS par `user_id`), hooks React pour le CRUD, composants dédiés montés dans un nouvel onglet de la page Stock. La date de livraison prévue n'est jamais stockée : elle est toujours calculée (`dateCommande + delaiJours`).

**Tech Stack:** Next.js 15 App Router, TypeScript, Dexie.js (IndexedDB), Supabase (Postgres + RLS), Vitest

## Global Constraints

- `'use client'` obligatoire sur tout fichier utilisant `localStorage`, hooks React, ou router Next.js
- Inline styles uniquement (aucune classe Tailwind) — suivre le pattern existant de `frontend/app/stock/page.tsx` et `frontend/components/Appareils.tsx`
- Police : `fontFamily: 'Manrope, sans-serif'` (`"Space Grotesk", sans-serif'` pour les montants/chiffres, comme ailleurs dans l'app)
- Couleurs via `useColors()` de `@/lib/hooks/useColors` — ne jamais coder les couleurs en dur, sauf les rouges/verts spécifiques déjà utilisés en dur ailleurs dans le projet pour les badges d'urgence (`#EF4444`, `#F97316`, `#EFECEA`... suivre le pattern exact du Carnet dans `frontend/app/ventes/page.tsx`)
- Taille de police minimum 12px ; boutons minimum 44px de hauteur
- Tout champ numérique : `type="text" inputMode="decimal"` OU `type="number"` avec `onWheel={e => e.currentTarget.blur()}` (jamais `type="number"` sans ce handler — bug corrigé le 2026-07-11, la molette de souris change sinon la valeur au focus)
- Le `montantMinimum` du fournisseur est informationnel seulement — ne jamais bloquer la création d'une commande en dessous de ce montant
- Seul `nom` est obligatoire pour créer un fournisseur ; `contact` doit rester optionnel (beaucoup de commerçants hésitent à donner le vrai numéro de leur fournisseur)
- Pas de commentaires de code sauf si le WHY est non-évident
- Tests : Vitest (`cd frontend && npm test`) — tester uniquement les fonctions pures de `backend/`
- Après chaque tâche touchant le code : `cd frontend && npx tsc --noEmit` doit rendre 0 erreur

---

## Fichiers à créer ou modifier

| Action | Fichier | Rôle |
|---|---|---|
| Modifier | `frontend/backend/types.ts` | Ajoute les interfaces `Fournisseur` et `Commande` |
| Créer | `frontend/backend/fournisseurs.ts` | Logique pure : validation, calcul de date de livraison, détection de retard |
| Créer | `frontend/backend/__tests__/fournisseurs.test.ts` | Tests unitaires |
| Modifier | `frontend/lib/db.ts` | Nouvelles tables Dexie `fournisseurs`/`commandes` + `clearLocalData()` mise à jour |
| Créer | `frontend/supabase-migration-2026-07-14-fournisseurs.sql` | Tables Supabase + RLS |
| Modifier | `frontend/lib/sync.ts` | Mappers + pull/push pour les deux nouvelles tables |
| Créer | `frontend/lib/hooks/useFournisseurs.ts` | Hook CRUD fournisseurs + commandes |
| Créer | `frontend/components/Fournisseurs.tsx` | Liste des fournisseurs + formulaire d'ajout |
| Créer | `frontend/components/FournisseurFiche.tsx` | Fiche détail (modale) : infos éditables, nouvelle commande, historique |
| Modifier | `frontend/app/stock/page.tsx` | Ajoute l'onglet "Fournisseurs", renomme "Mes produits" → "Produits" |
| Modifier | `frontend/app/page.tsx` | Bandeau d'alerte sur le tableau de bord si commande(s) en retard |

---

## Task 1 : Types + logique pure `backend/fournisseurs.ts` (TDD)

**Files:**
- Modify: `frontend/backend/types.ts`
- Create: `frontend/backend/fournisseurs.ts`
- Create: `frontend/backend/__tests__/fournisseurs.test.ts`

**Interfaces:**
- Produces:
  - `interface Fournisseur { id: string; nom: string; contact?: string; delaiHabituel?: number; montantMinimum?: number; modePaiement?: string; createdAt: number; updatedAt: number; deleted?: boolean; }`
  - `interface Commande { id: string; fournisseurId: string; dateCommande: number; delaiJours: number; montant: number; recue: boolean; createdAt: number; updatedAt: number; deleted?: boolean; }`
  - `validerFournisseur(data: Partial<Fournisseur>): string | null`
  - `validerCommande(data: Partial<Commande>): string | null`
  - `dateLivraisonPrevue(commande: Commande): number`
  - `estEnRetard(commande: Commande, now?: number): boolean`
  - `commandesEnRetard(commandes: Commande[], now?: number): Commande[]`
  - `fournisseurAUneCommandeEnRetard(commandes: Commande[], fournisseurId: string, now?: number): boolean`

- [ ] **Step 1 : Ajouter les types dans `frontend/backend/types.ts`**

Ajouter à la fin du fichier :

```typescript
export interface Fournisseur {
  id: string;
  nom: string;
  contact?: string;
  delaiHabituel?: number;   // jours
  montantMinimum?: number;
  modePaiement?: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Commande {
  id: string;
  fournisseurId: string;
  dateCommande: number;
  delaiJours: number;
  montant: number;
  recue: boolean;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

- [ ] **Step 2 : Écrire les tests (ils vont échouer)**

Créer `frontend/backend/__tests__/fournisseurs.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import {
  validerFournisseur,
  validerCommande,
  dateLivraisonPrevue,
  estEnRetard,
  commandesEnRetard,
  fournisseurAUneCommandeEnRetard,
} from '../fournisseurs';
import type { Commande } from '../types';

const JOUR_MS = 24 * 60 * 60 * 1000;

function creerCommande(overrides: Partial<Commande> = {}): Commande {
  const now = Date.now();
  return {
    id: 'c1',
    fournisseurId: 'f1',
    dateCommande: now,
    delaiJours: 7,
    montant: 100000,
    recue: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('validerFournisseur', () => {
  it('refuse un nom vide', () => {
    expect(validerFournisseur({ nom: '' })).toBe('Le nom est obligatoire');
  });

  it('refuse un nom absent', () => {
    expect(validerFournisseur({})).toBe('Le nom est obligatoire');
  });

  it('accepte un nom valide sans aucun autre champ', () => {
    expect(validerFournisseur({ nom: 'Grossiste Koné' })).toBeNull();
  });
});

describe('validerCommande', () => {
  it('refuse un fournisseurId absent', () => {
    expect(validerCommande({ dateCommande: Date.now(), delaiJours: 7, montant: 100 })).toBe('Fournisseur introuvable');
  });

  it('refuse un délai négatif', () => {
    expect(validerCommande({ fournisseurId: 'f1', dateCommande: Date.now(), delaiJours: -1, montant: 100 })).toBe('Le délai de livraison ne peut pas être négatif');
  });

  it('refuse un montant négatif', () => {
    expect(validerCommande({ fournisseurId: 'f1', dateCommande: Date.now(), delaiJours: 7, montant: -1 })).toBe('Le montant ne peut pas être négatif');
  });

  it('accepte une commande valide', () => {
    expect(validerCommande({ fournisseurId: 'f1', dateCommande: Date.now(), delaiJours: 7, montant: 100000 })).toBeNull();
  });
});

describe('dateLivraisonPrevue', () => {
  it('ajoute le délai en jours à la date de commande', () => {
    const base = new Date('2026-07-01T00:00:00Z').getTime();
    const commande = creerCommande({ dateCommande: base, delaiJours: 7 });
    expect(dateLivraisonPrevue(commande)).toBe(base + 7 * JOUR_MS);
  });

  it('gère un délai de 0 jour (livraison le jour même)', () => {
    const base = new Date('2026-07-01T00:00:00Z').getTime();
    const commande = creerCommande({ dateCommande: base, delaiJours: 0 });
    expect(dateLivraisonPrevue(commande)).toBe(base);
  });
});

describe('estEnRetard', () => {
  it("n'est pas en retard si la date prévue n'est pas encore passée", () => {
    const now = Date.now();
    const commande = creerCommande({ dateCommande: now, delaiJours: 7 });
    expect(estEnRetard(commande, now)).toBe(false);
  });

  it('est en retard si la date prévue est dépassée et pas reçue', () => {
    const now = Date.now();
    const commande = creerCommande({ dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: false });
    expect(estEnRetard(commande, now)).toBe(true);
  });

  it("n'est jamais en retard si déjà marquée reçue", () => {
    const now = Date.now();
    const commande = creerCommande({ dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: true });
    expect(estEnRetard(commande, now)).toBe(false);
  });
});

describe('commandesEnRetard', () => {
  it('filtre uniquement les commandes en retard, pas les autres', () => {
    const now = Date.now();
    const enRetard = creerCommande({ id: 'c1', dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: false });
    const aTemps = creerCommande({ id: 'c2', dateCommande: now, delaiJours: 7, recue: false });
    const recue = creerCommande({ id: 'c3', dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: true });
    expect(commandesEnRetard([enRetard, aTemps, recue], now)).toEqual([enRetard]);
  });
});

describe('fournisseurAUneCommandeEnRetard', () => {
  it('détecte une commande en retard pour le bon fournisseur uniquement', () => {
    const now = Date.now();
    const enRetard = creerCommande({ id: 'c1', fournisseurId: 'f1', dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: false });
    expect(fournisseurAUneCommandeEnRetard([enRetard], 'f1', now)).toBe(true);
    expect(fournisseurAUneCommandeEnRetard([enRetard], 'f2', now)).toBe(false);
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

Run: `cd frontend && npx vitest run backend/__tests__/fournisseurs.test.ts`
Expected: FAIL — `Cannot find module '../fournisseurs'`

- [ ] **Step 4 : Créer `frontend/backend/fournisseurs.ts`**

```typescript
import type { Fournisseur, Commande } from './types';

const JOUR_MS = 24 * 60 * 60 * 1000;

export function validerFournisseur(data: Partial<Fournisseur>): string | null {
  if (!data.nom || data.nom.trim() === '') return 'Le nom est obligatoire';
  return null;
}

export function validerCommande(data: Partial<Commande>): string | null {
  if (!data.fournisseurId) return 'Fournisseur introuvable';
  if (data.dateCommande === undefined) return 'La date de commande est obligatoire';
  if (data.delaiJours === undefined || data.delaiJours < 0) return 'Le délai de livraison ne peut pas être négatif';
  if (data.montant === undefined || data.montant < 0) return 'Le montant ne peut pas être négatif';
  return null;
}

export function dateLivraisonPrevue(commande: Commande): number {
  return commande.dateCommande + commande.delaiJours * JOUR_MS;
}

export function estEnRetard(commande: Commande, now: number = Date.now()): boolean {
  return !commande.recue && now > dateLivraisonPrevue(commande);
}

export function commandesEnRetard(commandes: Commande[], now: number = Date.now()): Commande[] {
  return commandes.filter((c) => estEnRetard(c, now));
}

export function fournisseurAUneCommandeEnRetard(
  commandes: Commande[],
  fournisseurId: string,
  now: number = Date.now()
): boolean {
  return commandes.some((c) => c.fournisseurId === fournisseurId && estEnRetard(c, now));
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

Run: `cd frontend && npx vitest run backend/__tests__/fournisseurs.test.ts`
Expected: `12 passed (12)` (ou similaire — toutes les assertions ci-dessus au vert)

- [ ] **Step 6 : Vérifier les types et la suite complète**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

Run: `cd frontend && npm test`
Expected: tous les fichiers de test passent (celui-ci + les existants)

- [ ] **Step 7 : Commit**

```bash
git add frontend/backend/types.ts frontend/backend/fournisseurs.ts frontend/backend/__tests__/fournisseurs.test.ts
git commit -m "feat: logique fournisseurs/commandes - validation, calcul retard"
```

---

## Task 2 : Stockage local (Dexie) + migration Supabase + synchronisation cloud

**Files:**
- Modify: `frontend/lib/db.ts`
- Create: `frontend/supabase-migration-2026-07-14-fournisseurs.sql`
- Modify: `frontend/lib/sync.ts`

**Interfaces:**
- Consumes: `Fournisseur`, `Commande` de `@backend/types` (Task 1)
- Produces:
  - `db.fournisseurs: EntityTable<Fournisseur, 'id'>`, `db.commandes: EntityTable<Commande, 'id'>` (Dexie, exportées via `db` déjà exporté par `lib/db.ts`)
  - `clearLocalData()` (déjà existante, étendue pour vider ces deux tables aussi)
  - Tables Supabase `fournisseurs` et `commandes` avec RLS par `user_id`
  - `pull()`/`push()` de `lib/sync.ts` (déjà exportées via `fullSync`) synchronisent désormais aussi ces deux tables

- [ ] **Step 1 : Mettre à jour `frontend/lib/db.ts`**

Remplacer la ligne d'import :

```typescript
import type { Produit, Vente, Config, Pack } from '@backend/types';
```

par :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande } from '@backend/types';
```

Dans la classe `MargoDB`, ajouter deux champs après `packs!: EntityTable<Pack, 'id'>;` :

```typescript
  fournisseurs!: EntityTable<Fournisseur, 'id'>;
  commandes!: EntityTable<Commande, 'id'>;
```

Ajouter une nouvelle version de schéma après le bloc `this.version(5).stores({...});` existant (à l'intérieur du constructeur, avant la fermeture de la méthode) :

```typescript
    // v6 - fournisseurs et commandes fournisseur
    this.version(6).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      fournisseurs: 'id, nom, updatedAt, deleted',
      commandes: 'id, fournisseurId, dateCommande, updatedAt, deleted',
      config: 'id',
    });
```

Mettre à jour `clearLocalData()` (déjà existante dans ce fichier) pour vider aussi ces deux nouvelles tables :

```typescript
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.produits, db.ventes, db.packs, db.fournisseurs, db.commandes, db.config, async () => {
    await db.produits.clear();
    await db.ventes.clear();
    await db.packs.clear();
    await db.fournisseurs.clear();
    await db.commandes.clear();
    await db.config.clear();
  });
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Créer la migration SQL `frontend/supabase-migration-2026-07-14-fournisseurs.sql`**

```sql
-- =====================================================================
-- MargoPro — Migration 2026-07-14b
-- Fournisseurs et commandes fournisseur
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

create table if not exists public.fournisseurs (
  id               uuid    primary key,
  user_id          uuid    not null references auth.users(id) on delete cascade,
  nom              text    not null,
  contact          text,
  delai_habituel   integer,
  montant_minimum  numeric,
  mode_paiement    text,
  created_at       bigint  not null,
  updated_at       bigint  not null,
  deleted          boolean not null default false
);
create index if not exists fournisseurs_user_id_idx on public.fournisseurs (user_id);

alter table public.fournisseurs enable row level security;
drop policy if exists "fournisseurs_owner" on public.fournisseurs;
create policy "fournisseurs_owner" on public.fournisseurs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.commandes (
  id              uuid    primary key,
  user_id         uuid    not null references auth.users(id) on delete cascade,
  fournisseur_id  uuid    not null,
  date_commande   bigint  not null,
  delai_jours     integer not null,
  montant         numeric not null default 0,
  recue           boolean not null default false,
  created_at      bigint  not null,
  updated_at      bigint  not null,
  deleted         boolean not null default false
);
create index if not exists commandes_user_id_idx on public.commandes (user_id);
create index if not exists commandes_fournisseur_id_idx on public.commandes (fournisseur_id);

alter table public.commandes enable row level security;
drop policy if exists "commandes_owner" on public.commandes;
create policy "commandes_owner" on public.commandes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Note : pas de contrainte `references` sur `fournisseur_id` vers `fournisseurs.id` — le projet n'utilise pas de clés étrangères entre ces tables (voir `packs.composants` qui ne référence pas `produits` en base non plus), la cohérence est gérée côté app pour rester compatible avec la création hors-ligne.

- [ ] **Step 4 : Mettre à jour `frontend/lib/sync.ts` — imports et mappers**

Remplacer la ligne d'import :

```typescript
import type { Produit, Vente, Config, Pack } from '@backend/types';
```

par :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande } from '@backend/types';
```

Ajouter ces types et fonctions après le bloc `rowToPack` existant (avant le commentaire `// ---------------------------------------------------------------------\n// Helpers`) :

```typescript
type FournisseurRow = {
  id: string;
  user_id: string;
  nom: string;
  contact: string | null;
  delai_habituel: number | null;
  montant_minimum: number | null;
  mode_paiement: string | null;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

type CommandeRow = {
  id: string;
  user_id: string;
  fournisseur_id: string;
  date_commande: number;
  delai_jours: number;
  montant: number;
  recue: boolean;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

function fournisseurToRow(f: Fournisseur, userId: string): FournisseurRow {
  return {
    id: f.id,
    user_id: userId,
    nom: f.nom,
    contact: f.contact ?? null,
    delai_habituel: f.delaiHabituel ?? null,
    montant_minimum: f.montantMinimum ?? null,
    mode_paiement: f.modePaiement ?? null,
    created_at: f.createdAt ?? Date.now(),
    updated_at: f.updatedAt ?? Date.now(),
    deleted: f.deleted ?? false,
  };
}

function rowToFournisseur(r: FournisseurRow): Fournisseur {
  return {
    id: r.id,
    nom: r.nom,
    contact: r.contact ?? undefined,
    delaiHabituel: r.delai_habituel ?? undefined,
    montantMinimum: r.montant_minimum ?? undefined,
    modePaiement: r.mode_paiement ?? undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}

function commandeToRow(c: Commande, userId: string): CommandeRow {
  return {
    id: c.id,
    user_id: userId,
    fournisseur_id: c.fournisseurId,
    date_commande: c.dateCommande,
    delai_jours: c.delaiJours,
    montant: c.montant,
    recue: c.recue ?? false,
    created_at: c.createdAt ?? Date.now(),
    updated_at: c.updatedAt ?? Date.now(),
    deleted: c.deleted ?? false,
  };
}

function rowToCommande(r: CommandeRow): Commande {
  return {
    id: r.id,
    fournisseurId: r.fournisseur_id,
    dateCommande: Number(r.date_commande),
    delaiJours: Number(r.delai_jours),
    montant: Number(r.montant),
    recue: r.recue ?? false,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}
```

- [ ] **Step 5 : Étendre `pull()` dans `frontend/lib/sync.ts`**

Repérer le bloc `// --- packs (non-fatal : si la table n'existe pas encore, on continue) ---` à l'intérieur de la fonction `pull`, juste avant sa fermeture (`}` qui précède le commentaire `// PUSH : local -> cloud`). Juste après ce bloc packs (après son `catch` fermant), ajouter :

```typescript
  // --- fournisseurs (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const { data: fournisseursRows, error: fErr } = await supabase
      .from('fournisseurs')
      .select('*')
      .eq('user_id', userId);
    if (fErr) throw fErr;

    for (const row of (fournisseursRows ?? []) as FournisseurRow[]) {
      const remote = rowToFournisseur(row);
      const local = await db.fournisseurs.get(remote.id);
      if (!local || remote.updatedAt > (local.updatedAt ?? 0)) {
        await db.fournisseurs.put(remote);
      }
    }
  } catch (err) {
    console.warn('[sync] pull fournisseurs ignoré :', err);
  }

  // --- commandes (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const { data: commandesRows, error: cmdErr } = await supabase
      .from('commandes')
      .select('*')
      .eq('user_id', userId);
    if (cmdErr) throw cmdErr;

    for (const row of (commandesRows ?? []) as CommandeRow[]) {
      const remote = rowToCommande(row);
      const local = await db.commandes.get(remote.id);
      if (!local || remote.updatedAt > (local.updatedAt ?? 0)) {
        await db.commandes.put(remote);
      }
    }
  } catch (err) {
    console.warn('[sync] pull commandes ignoré :', err);
  }
```

- [ ] **Step 6 : Étendre `push()` dans `frontend/lib/sync.ts`**

Repérer le bloc `// --- packs (non-fatal : si la table n'existe pas encore, on continue) ---` à l'intérieur de la fonction `push`, juste avant sa fermeture (`}` qui précède le commentaire `// FULL SYNC`). Juste après ce bloc packs, ajouter :

```typescript
  // --- fournisseurs (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const fournisseurs = await db.fournisseurs.toArray();
    if (fournisseurs.length > 0) {
      const rows = fournisseurs.map((f) => fournisseurToRow(f, userId));
      const { error } = await supabase.from('fournisseurs').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (err) {
    console.warn('[sync] push fournisseurs ignoré :', err);
  }

  // --- commandes (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const commandes = await db.commandes.toArray();
    if (commandes.length > 0) {
      const rows = commandes.map((c) => commandeToRow(c, userId));
      const { error } = await supabase.from('commandes').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (err) {
    console.warn('[sync] push commandes ignoré :', err);
  }
```

- [ ] **Step 7 : Vérifier les types et les tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

Run: `cd frontend && npm test`
Expected: tous les tests passent (aucun test n'exerce directement `sync.ts`, mais rien ne doit casser)

- [ ] **Step 8 : Commit**

```bash
git add frontend/lib/db.ts frontend/lib/sync.ts frontend/supabase-migration-2026-07-14-fournisseurs.sql
git commit -m "feat: stockage local + sync cloud pour fournisseurs et commandes"
```

---

## Task 3 : Hook `useFournisseurs`

**Files:**
- Create: `frontend/lib/hooks/useFournisseurs.ts`

**Interfaces:**
- Consumes: `db.fournisseurs`, `db.commandes`, `genId` de `../db` (Task 2) ; `validerFournisseur`, `validerCommande`, `commandesEnRetard`, `fournisseurAUneCommandeEnRetard` de `@backend/fournisseurs` (Task 1) ; `requestSync` de `../syncController` (déjà existant)
- Produces: `useFournisseurs()` retournant `{ fournisseurs: Fournisseur[]; commandes: Commande[]; enRetard: Commande[]; ajouterFournisseur(data): Promise<string|null>; modifierFournisseur(id, data): Promise<string|null>; supprimerFournisseur(id): Promise<void>; ajouterCommande(data): Promise<string|null>; marquerCommandeRecue(id): Promise<void>; supprimerCommande(id): Promise<void>; commandesDuFournisseur(fournisseurId): Commande[]; fournisseurEnRetard(fournisseurId): boolean; }`

- [ ] **Step 1 : Créer `frontend/lib/hooks/useFournisseurs.ts`**

```typescript
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import {
  validerFournisseur,
  validerCommande,
  commandesEnRetard,
  fournisseurAUneCommandeEnRetard,
} from '@backend/fournisseurs';
import { requestSync } from '../syncController';
import type { Fournisseur, Commande } from '@backend/types';

export function useFournisseurs() {
  const fournisseurs = useLiveQuery(
    () => db.fournisseurs.orderBy('nom').filter((f) => !f.deleted).toArray()
  ) ?? [];

  const commandes = useLiveQuery(
    () => db.commandes.orderBy('dateCommande').reverse().filter((c) => !c.deleted).toArray()
  ) ?? [];

  async function ajouterFournisseur(
    data: Omit<Fournisseur, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> {
    const erreur = validerFournisseur(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.fournisseurs.add({ ...data, id: genId(), createdAt: now, updatedAt: now, deleted: false });
    requestSync();
    return null;
  }

  async function modifierFournisseur(
    id: string,
    data: Partial<Omit<Fournisseur, 'id' | 'createdAt'>>
  ): Promise<string | null> {
    const erreur = validerFournisseur(data);
    if (erreur) return erreur;
    await db.fournisseurs.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerFournisseur(id: string) {
    await db.fournisseurs.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  async function ajouterCommande(
    data: Omit<Commande, 'id' | 'createdAt' | 'updatedAt' | 'recue'>
  ): Promise<string | null> {
    const erreur = validerCommande(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.commandes.add({ ...data, id: genId(), recue: false, createdAt: now, updatedAt: now, deleted: false });
    requestSync();
    return null;
  }

  async function marquerCommandeRecue(id: string) {
    await db.commandes.update(id, { recue: true, updatedAt: Date.now() });
    requestSync();
  }

  async function supprimerCommande(id: string) {
    await db.commandes.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  function commandesDuFournisseur(fournisseurId: string): Commande[] {
    return commandes.filter((c) => c.fournisseurId === fournisseurId);
  }

  function fournisseurEnRetard(fournisseurId: string): boolean {
    return fournisseurAUneCommandeEnRetard(commandes, fournisseurId);
  }

  return {
    fournisseurs,
    commandes,
    enRetard: commandesEnRetard(commandes),
    ajouterFournisseur,
    modifierFournisseur,
    supprimerFournisseur,
    ajouterCommande,
    marquerCommandeRecue,
    supprimerCommande,
    commandesDuFournisseur,
    fournisseurEnRetard,
  };
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/hooks/useFournisseurs.ts
git commit -m "feat: hook useFournisseurs - CRUD fournisseurs et commandes"
```

---

## Task 4 : Composant `FournisseurFiche.tsx` (fiche détail, commandes, historique)

**Files:**
- Create: `frontend/components/FournisseurFiche.tsx`

**Interfaces:**
- Consumes: `useFournisseurs()` (Task 3) ; `dateLivraisonPrevue`, `estEnRetard` de `@backend/fournisseurs` (Task 1) ; `useConfig` de `@/lib/hooks/useConfig` (déjà existant) ; `Fournisseur` de `@backend/types` (Task 1)
- Produces: `FournisseurFiche` (composant, export nommé, props `{ fournisseur: Fournisseur; onFermer: () => void }`) — consommé par `Fournisseurs.tsx` (Task 5)

- [ ] **Step 1 : Créer `frontend/components/FournisseurFiche.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import { useFournisseurs } from '@/lib/hooks/useFournisseurs';
import { dateLivraisonPrevue, estEnRetard } from '@backend/fournisseurs';
import type { Fournisseur } from '@backend/types';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function FournisseurFiche({ fournisseur, onFermer }: { fournisseur: Fournisseur; onFermer: () => void }) {
  const T = useColors();
  const { config } = useConfig();
  const symbole = config?.symboleDevise ?? 'FCFA';
  const {
    commandesDuFournisseur,
    ajouterCommande,
    marquerCommandeRecue,
    modifierFournisseur,
    supprimerFournisseur,
  } = useFournisseurs();
  const commandes = commandesDuFournisseur(fournisseur.id);

  const [modeEdition, setModeEdition] = useState(false);
  const [champsEdition, setChampsEdition] = useState({
    nom: fournisseur.nom,
    contact: fournisseur.contact ?? '',
    delaiHabituel: fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '',
    montantMinimum: fournisseur.montantMinimum ? String(fournisseur.montantMinimum) : '',
    modePaiement: fournisseur.modePaiement ?? '',
  });
  const [erreurEdition, setErreurEdition] = useState('');

  const [showCommandeForm, setShowCommandeForm] = useState(false);
  const [delaiJours, setDelaiJours] = useState(fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '');
  const [montant, setMontant] = useState('');
  const [erreurCommande, setErreurCommande] = useState('');

  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  async function handleModifier() {
    setErreurEdition('');
    const err = await modifierFournisseur(fournisseur.id, {
      nom: champsEdition.nom.trim(),
      contact: champsEdition.contact.trim() || undefined,
      delaiHabituel: Number(champsEdition.delaiHabituel) > 0 ? Number(champsEdition.delaiHabituel) : undefined,
      montantMinimum: Number(champsEdition.montantMinimum) > 0 ? Number(champsEdition.montantMinimum) : undefined,
      modePaiement: champsEdition.modePaiement.trim() || undefined,
    });
    if (err) { setErreurEdition(err); return; }
    setModeEdition(false);
  }

  async function handleNouvelleCommande() {
    setErreurCommande('');
    const delai = Number(delaiJours);
    const mnt = Number(montant);
    if (!delai || delai <= 0) { setErreurCommande('Délai de livraison invalide'); return; }
    if (!mnt || mnt <= 0) { setErreurCommande('Montant invalide'); return; }
    const err = await ajouterCommande({
      fournisseurId: fournisseur.id,
      dateCommande: Date.now(),
      delaiJours: delai,
      montant: mnt,
    });
    if (err) { setErreurCommande(err); return; }
    setDelaiJours(fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '');
    setMontant('');
    setShowCommandeForm(false);
  }

  const dateApercu = Number(delaiJours) > 0
    ? new Date(Date.now() + Number(delaiJours) * 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;

  const inputStyle = {
    width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
    fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif',
    boxSizing: 'border-box' as const,
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onFermer}
    >
      <div
        style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 36px', maxHeight: '85dvh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />

        {!modeEdition ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: T.text }}>{fournisseur.nom}</div>
              <button
                onClick={() => setModeEdition(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.accent, fontFamily: 'Manrope, sans-serif' }}
              >
                Modifier
              </button>
            </div>

            <div style={{ background: T.bgSubtle, borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fournisseur.contact && (
                <a href={`tel:${fournisseur.contact}`} style={{ fontSize: 13, color: T.accent, fontWeight: 600, textDecoration: 'none' }}>
                  📞 {fournisseur.contact}
                </a>
              )}
              {fournisseur.delaiHabituel !== undefined && (
                <div style={{ fontSize: 13, color: T.textSub }}>Délai habituel : {fournisseur.delaiHabituel} jours</div>
              )}
              {fournisseur.montantMinimum !== undefined && (
                <div style={{ fontSize: 13, color: T.textSub }}>Montant minimum : {fmtF(fournisseur.montantMinimum)} {symbole}</div>
              )}
              {fournisseur.modePaiement && (
                <div style={{ fontSize: 13, color: T.textSub }}>Paiement : {fournisseur.modePaiement}</div>
              )}
              {!fournisseur.contact && fournisseur.delaiHabituel === undefined && fournisseur.montantMinimum === undefined && !fournisseur.modePaiement && (
                <div style={{ fontSize: 13, color: T.textMuted }}>Aucune information complémentaire</div>
              )}
            </div>
          </>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12 }}>Modifier le fournisseur</div>
            {erreurEdition && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreurEdition}
              </div>
            )}
            {([
              { key: 'nom' as const, label: 'Nom', numerique: false },
              { key: 'contact' as const, label: 'Contact (optionnel)', numerique: false },
              { key: 'delaiHabituel' as const, label: 'Délai habituel, en jours (optionnel)', numerique: true },
              { key: 'montantMinimum' as const, label: 'Montant minimum (optionnel)', numerique: true },
              { key: 'modePaiement' as const, label: 'Mode de paiement (optionnel)', numerique: false },
            ]).map(({ key, label, numerique }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
                <input
                  type="text" inputMode={numerique ? 'decimal' : undefined} onWheel={e => e.currentTarget.blur()}
                  value={champsEdition[key]}
                  onChange={e => setChampsEdition(c => ({ ...c, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => { setModeEdition(false); setErreurEdition(''); }}
                style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
              >
                Annuler
              </button>
              <button
                onClick={handleModifier}
                style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {!modeEdition && (
          <>
            {!showCommandeForm ? (
              <button
                onClick={() => setShowCommandeForm(true)}
                style={{ width: '100%', height: 48, borderRadius: 12, background: T.accent, color: 'white', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 20 }}
              >
                + Nouvelle commande
              </button>
            ) : (
              <div style={{ background: T.bgSubtle, borderRadius: 14, padding: 14, marginBottom: 20 }}>
                {erreurCommande && (
                  <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                    {erreurCommande}
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Délai de livraison (jours)</label>
                  <input
                    type="text" inputMode="decimal" onWheel={e => e.currentTarget.blur()}
                    value={delaiJours} onChange={e => setDelaiJours(e.target.value)}
                    placeholder="Ex : 7"
                    style={inputStyle}
                  />
                  {dateApercu && (
                    <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginTop: 4 }}>Livraison prévue : {dateApercu}</div>
                  )}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Montant de la commande ({symbole})</label>
                  <input
                    type="text" inputMode="decimal" onWheel={e => e.currentTarget.blur()}
                    value={montant} onChange={e => setMontant(e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setShowCommandeForm(false); setErreurCommande(''); }}
                    style={{ flex: 1, height: 44, borderRadius: 12, background: T.surface, border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleNouvelleCommande}
                    style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Historique des commandes
            </div>
            {commandes.length === 0 ? (
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>Aucune commande pour l&apos;instant</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {commandes.map(c => {
                  const enRetard = estEnRetard(c);
                  return (
                    <div key={c.id} style={{
                      background: T.bgSubtle, borderRadius: 12, padding: '10px 14px',
                      border: enRetard ? '1.5px solid #EF4444' : `1px solid ${T.border}`,
                      opacity: c.recue ? 0.6 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, textDecoration: c.recue ? 'line-through' : 'none' }}>
                          {fmtF(c.montant)} {symbole}
                        </span>
                        {enRetard && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 En retard</span>}
                        {c.recue && <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>✓ Reçue</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        Commandée le {new Date(c.dateCommande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' · '}Prévue le {new Date(dateLivraisonPrevue(c)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </div>
                      {!c.recue && (
                        <button
                          onClick={() => marquerCommandeRecue(c.id)}
                          style={{ marginTop: 8, height: 32, padding: '0 12px', borderRadius: 8, background: T.greenBg, color: T.green, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                        >
                          Marquer reçue
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {confirmerSuppression ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmerSuppression(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => { supprimerFournisseur(fournisseur.id); onFermer(); }}
                  style={{ flex: 2, height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red }}
                >
                  Confirmer la suppression
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmerSuppression(true)}
                style={{ width: '100%', height: 44, borderRadius: 12, background: 'none', border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textMuted }}
              >
                Supprimer ce fournisseur
              </button>
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
Expected: 0 erreur (ce composant ne dépend que des Tasks 1 et 3, déjà faites)

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/FournisseurFiche.tsx
git commit -m "feat: composant FournisseurFiche - detail, commandes, historique"
```

Note : ce composant n'est pas encore monté nulle part (il est consommé par `Fournisseurs.tsx`, Task 5) — le test manuel bout-en-bout du parcours complet se fait à la fin de la Task 5.

---

## Task 5 : Composant `Fournisseurs.tsx` (liste + ajout)

**Files:**
- Create: `frontend/components/Fournisseurs.tsx`

**Interfaces:**
- Consumes: `useFournisseurs()` (Task 3) ; `useColors` de `@/lib/hooks/useColors` (déjà existant) ; `FournisseurFiche` de `./FournisseurFiche` (Task 4, déjà créé)
- Produces: `Fournisseurs` (composant, export nommé) — à monter dans `frontend/app/stock/page.tsx` (Task 6)

- [ ] **Step 1 : Créer `frontend/components/Fournisseurs.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useFournisseurs } from '@/lib/hooks/useFournisseurs';
import { FournisseurFiche } from './FournisseurFiche';
import type { Fournisseur } from '@backend/types';

const CHAMPS_VIDES = { nom: '', contact: '', delaiHabituel: '', montantMinimum: '', modePaiement: '' };

export function Fournisseurs() {
  const T = useColors();
  const { fournisseurs, ajouterFournisseur, fournisseurEnRetard } = useFournisseurs();
  const [showForm, setShowForm] = useState(false);
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const [erreur, setErreur] = useState('');
  const [fournisseurOuvert, setFournisseurOuvert] = useState<Fournisseur | null>(null);

  async function handleAjouter() {
    setErreur('');
    const err = await ajouterFournisseur({
      nom: champs.nom.trim(),
      contact: champs.contact.trim() || undefined,
      delaiHabituel: Number(champs.delaiHabituel) > 0 ? Number(champs.delaiHabituel) : undefined,
      montantMinimum: Number(champs.montantMinimum) > 0 ? Number(champs.montantMinimum) : undefined,
      modePaiement: champs.modePaiement.trim() || undefined,
    });
    if (err) { setErreur(err); return; }
    setChamps(CHAMPS_VIDES);
    setShowForm(false);
  }

  const champsFormulaire: Array<{ key: keyof typeof CHAMPS_VIDES; label: string; placeholder: string; numerique?: boolean }> = [
    { key: 'nom', label: 'Nom', placeholder: 'Ex : Grossiste Koné' },
    { key: 'contact', label: 'Contact (optionnel)', placeholder: 'Ex : 77 123 45 67' },
    { key: 'delaiHabituel', label: 'Délai de livraison habituel, en jours (optionnel)', placeholder: 'Ex : 7', numerique: true },
    { key: 'montantMinimum', label: 'Montant minimum de commande (optionnel)', placeholder: '0', numerique: true },
    { key: 'modePaiement', label: 'Mode de paiement (optionnel)', placeholder: 'Ex : Mobile Money' },
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => setShowForm(true)}
        style={{
          width: '100%', height: 48, borderRadius: 12, background: T.accent, color: 'white',
          fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        Ajouter un fournisseur
      </button>

      {showForm && (
        <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Nouveau fournisseur</div>
          {erreur && (
            <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
              {erreur}
            </div>
          )}
          {champsFormulaire.map(({ key, label, placeholder, numerique }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
              <input
                type={numerique ? 'text' : key === 'contact' ? 'tel' : 'text'}
                inputMode={numerique ? 'decimal' : undefined}
                onWheel={e => e.currentTarget.blur()}
                value={champs[key]}
                onChange={e => setChamps(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={() => { setShowForm(false); setErreur(''); setChamps(CHAMPS_VIDES); }}
              style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
            >
              Annuler
            </button>
            <button
              onClick={handleAjouter}
              style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {fournisseurs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun fournisseur</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Ajoute ton premier fournisseur pour suivre tes commandes.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {fournisseurs.map(f => (
            <div
              key={f.id}
              onClick={() => setFournisseurOuvert(f)}
              style={{
                background: T.surface, borderRadius: 14, padding: '14px 16px', boxShadow: T.shadow,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{f.nom}</span>
              {fournisseurEnRetard(f.id) && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 Livraison en retard</span>
              )}
            </div>
          ))}
        </div>
      )}

      {fournisseurOuvert && (
        <FournisseurFiche fournisseur={fournisseurOuvert} onFermer={() => setFournisseurOuvert(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/Fournisseurs.tsx
git commit -m "feat: composant Fournisseurs - liste et ajout"
```

Note : ce composant n'est pas encore accessible depuis l'app (il sera monté dans la page Stock à la Task 6) — le test manuel bout-en-bout se fait à la fin de la Task 6.

---

## Task 6 : Intégration dans la page Stock

**Files:**
- Modify: `frontend/app/stock/page.tsx`

**Interfaces:**
- Consumes: `Fournisseurs` de `@/components/Fournisseurs` (Task 4)

- [ ] **Step 1 : Ajouter l'import**

Ajouter en haut de `frontend/app/stock/page.tsx`, avec les autres imports de composants :

```typescript
import { Fournisseurs } from '@/components/Fournisseurs';
```

- [ ] **Step 2 : Étendre le type et l'état `vueStock`**

Remplacer :

```typescript
  const [vueStock, setVueStock] = useState<'produits' | 'packs' | 'mort'>('produits');
```

par :

```typescript
  const [vueStock, setVueStock] = useState<'produits' | 'packs' | 'mort' | 'fournisseurs'>('produits');
```

- [ ] **Step 3 : Ajouter l'onglet au sélecteur et renommer "Mes produits"**

Repérer ce bloc (le sélecteur en haut de la page Stock) :

```typescript
          {([
            { v: 'produits' as const, label: 'Mes produits' },
            { v: 'packs' as const, label: 'Packs' },
            { v: 'mort' as const, label: 'Stock mort' },
          ]).map(({ v, label }) => (
```

Remplacer par :

```typescript
          {([
            { v: 'produits' as const, label: 'Produits' },
            { v: 'packs' as const, label: 'Packs' },
            { v: 'mort' as const, label: 'Stock mort' },
            { v: 'fournisseurs' as const, label: 'Fournisseurs' },
          ]).map(({ v, label }) => (
```

- [ ] **Step 4 : Monter le composant Fournisseurs**

Repérer la fin du bloc `{vueStock === 'mort' && (() => { ... })()}`  (sa fermeture exacte est `})()}` suivie d'une ligne vide puis `{alertes.length > 0 && <div style={{ display: 'none' }} aria-hidden="true" />}`). Juste après le `})()}` de ce bloc mort, avant la ligne vide existante, ajouter :

```typescript

      {vueStock === 'fournisseurs' && <Fournisseurs />}
```

- [ ] **Step 5 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 6 : Lancer le dev server et tester manuellement**

Run: `cd frontend && npm run dev`

1. Ouvrir `http://localhost:3000/stock`
2. Vérifier que le sélecteur affiche : Produits / Packs / Stock mort / Fournisseurs (4 onglets)
3. Vérifier que "Produits" (pas "Mes produits") s'affiche et que cliquer dessus fonctionne comme avant
4. Cliquer "Fournisseurs" → la liste (vide au départ) + le bouton "Ajouter un fournisseur" s'affichent
5. Ajouter un fournisseur test, vérifier qu'il apparaît dans la liste, l'ouvrir, ajouter une commande, la marquer reçue — parcours complet
6. Arrêter le serveur dev (Ctrl+C)

- [ ] **Step 7 : Commit**

```bash
git add frontend/app/stock/page.tsx
git commit -m "feat: onglet Fournisseurs dans Stock, renomme Mes produits en Produits"
```

---

## Task 7 : Alerte sur le tableau de bord

**Files:**
- Modify: `frontend/app/page.tsx`

**Interfaces:**
- Consumes: `useFournisseurs()` (Task 3) — utilise `enRetard: Commande[]`

- [ ] **Step 1 : Ajouter l'import**

Ajouter avec les autres imports de hooks dans `frontend/app/page.tsx` :

```typescript
import { useFournisseurs } from '@/lib/hooks/useFournisseurs';
```

- [ ] **Step 2 : Utiliser le hook**

Repérer la ligne :

```typescript
  const { stats, ventes, totalDu } = useVentes('jour');
```

Ajouter juste après :

```typescript
  const { enRetard: commandesEnRetard } = useFournisseurs();
```

- [ ] **Step 3 : Ajouter le bandeau d'alerte**

Repérer la fin du bloc `{/* KPI GRID */}` — sa fermeture est le `</div>` qui suit la "Card 4 - Stock total", juste avant le commentaire `{/* PIE CHART CARD */}`. Insérer le bandeau juste avant ce commentaire :

```typescript
        {commandesEnRetard.length > 0 && (
          <Link href="/stock" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#FDECEA', border: '2px solid #EF4444', borderRadius: 14, padding: '12px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🔴</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#C0392B' }}>
                  {commandesEnRetard.length} livraison{commandesEnRetard.length > 1 ? 's' : ''} en retard
                </div>
                <div style={{ fontSize: 11, color: '#C0392B', marginTop: 1 }}>Tape pour voir tes fournisseurs</div>
              </div>
            </div>
          </Link>
        )}

```

(`Link` de `next/link` est déjà importé dans ce fichier — vérifier en haut du fichier, ne pas le réimporter s'il l'est déjà.)

- [ ] **Step 4 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 5 : Lancer le dev server et tester manuellement**

Run: `cd frontend && npm run dev`

1. Sans commande en retard : ouvrir `http://localhost:3000/` → pas de bandeau rouge
2. Créer un fournisseur + une commande avec délai 0 jour (via l'onglet Fournisseurs) → retourner sur `/` → le bandeau rouge "1 livraison en retard" apparaît, cliquable vers `/stock`
3. Marquer la commande reçue → retourner sur `/` → le bandeau disparaît
4. Arrêter le serveur dev (Ctrl+C)

- [ ] **Step 6 : Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: alerte tableau de bord pour les livraisons fournisseur en retard"
```

---

## Task 8 : Migration Supabase (étape manuelle, hors code)

**Files:** aucun — étape à effectuer par Juanita dans le dashboard Supabase.

- [ ] **Step 1 : Exécuter la migration**

Dans Supabase Dashboard → SQL Editor → New query, coller le contenu de `frontend/supabase-migration-2026-07-14-fournisseurs.sql` (créé à la Task 2) → Run.

- [ ] **Step 2 : Test de bout en bout par Juanita**

Une fois toutes les tâches déployées en production et la migration exécutée :
1. Ajouter un vrai fournisseur avec ses vraies infos
2. Créer une commande, vérifier la date de livraison calculée
3. Se déconnecter/reconnecter (ou ouvrir sur un autre appareil) pour confirmer que le fournisseur et sa commande sont bien synchronisés dans le cloud
4. Attendre (ou simuler avec un délai de 0 jour) qu'une commande passe en retard, vérifier l'alerte sur le tableau de bord et le badge dans Fournisseurs
