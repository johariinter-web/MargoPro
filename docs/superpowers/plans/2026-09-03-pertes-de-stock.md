# Pertes de stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à Juanita de déclarer un produit perdu (abîmé à la livraison, cassé par accident) depuis la fiche produit du Stock, et faire en sorte que la valeur de cette perte compte automatiquement dans le calcul du seuil de rentabilité, sans ressaisie manuelle.

**Architecture:** Nouvelle entité `Perte` suivant exactement le pattern déjà établi par `Depense`/`Vente` : logique pure et testable dans `frontend/backend/pertes.ts`, stockage local Dexie (offline-first), synchronisation cloud Supabase (RLS par `user_id`), un hook React (`usePertes`) qui décrémente le stock et crée l'enregistrement dans une même transaction, un nouveau bouton dans la fiche produit du Stock (miroir du bouton de réapprovisionnement déjà existant), et une petite extension des trois endroits qui calculent déjà `chargesDuMois`/`chargesDuMoisCourant` (`SeuilRentabilite.tsx`, `MargeTab.tsx`, `marges/page.tsx`) pour y additionner la valeur des pertes du mois.

**Tech Stack:** Next.js 15 App Router, TypeScript, Dexie.js (IndexedDB), Supabase (Postgres + RLS), Vitest

**Spec:** `docs/superpowers/specs/2026-09-03-pertes-de-stock-design.md`

## Global Constraints

- `'use client'` obligatoire sur tout fichier utilisant `localStorage`, hooks React, ou router Next.js
- Inline styles uniquement (aucune classe Tailwind) — suivre le pattern existant de `frontend/app/stock/page.tsx`
- Police : `fontFamily: 'Manrope, sans-serif'` (`'"Space Grotesk", sans-serif'` pour les montants/chiffres)
- Couleurs via `useColors()` de `@/lib/hooks/useColors` — ne jamais coder les couleurs en dur
- Taille de police minimum 12px ; boutons minimum 44px de hauteur
- Tout champ numérique : `type="number"` avec `onWheel={e => e.currentTarget.blur()}`
- Une perte n'a que la quantité comme champ saisi par l'utilisateur — pas de champ "raison" (décidé explicitement pendant le brainstorm)
- Pas de bouton de perte par ligne produit dans la liste, pas de sélecteur de produit séparé — le bouton vit dans la fiche produit déjà ouverte (décidé explicitement pendant le brainstorm)
- La quantité perdue ne peut jamais dépasser la quantité actuellement en stock
- Accès gratuit pour tous (contrairement à `Depense`/Seuil de rentabilité qui restent Premium) — seul l'effet sur le calcul de rentabilité n'est visible qu'en Premium, comme aujourd'hui
- Période de référence partout : mois calendaire en cours, avec borne haute exclue (voir la correction du 2026-09-02 sur `depensesDuMois` — même piège à éviter ici)
- Pas de commentaires de code sauf si le WHY est non-évident
- Tests : Vitest (`cd frontend && npm test`) — tester uniquement les fonctions pures de `backend/`
- Après chaque tâche touchant le code : `cd frontend && npx tsc --noEmit` doit rendre 0 erreur
- Hors scope pour cette tâche : champ raison, historique/liste des pertes passées, annuler/restaurer une perte, détection automatique de péremption — ne pas les ajouter

---

## Fichiers à créer ou modifier

| Action | Fichier | Rôle |
|---|---|---|
| Modifier | `frontend/backend/types.ts` | Ajoute l'interface `Perte` |
| Créer | `frontend/backend/pertes.ts` | Logique pure : validation, filtrage par mois, valeur d'une perte, total du mois |
| Créer | `frontend/backend/__tests__/pertes.test.ts` | Tests unitaires |
| Modifier | `frontend/lib/db.ts` | Nouvelle table Dexie `pertes` + `clearLocalData()` mise à jour |
| Créer | `frontend/supabase-migration-2026-09-03-pertes.sql` | Table Supabase + RLS |
| Modifier | `frontend/lib/sync.ts` | Mappers + pull/push pour `pertes` |
| Créer | `frontend/lib/hooks/usePertes.ts` | Hook : liste des pertes + `declarerPerte` (transaction stock + perte) |
| Modifier | `frontend/app/stock/page.tsx` | Bouton + fenêtre "J'ai perdu de la marchandise" dans la fiche produit |
| Modifier | `frontend/components/SeuilRentabilite.tsx` | Ajoute les pertes du mois au total des charges, affiche le détail |
| Modifier | `frontend/components/MargeTab.tsx` | Ajoute les pertes du mois au total des charges utilisé pour le plancher |
| Modifier | `frontend/app/marges/page.tsx` | Ajoute les pertes du mois au total des charges utilisé par le calculateur "Prix de vente" |

---

## Task 1 : Types + logique pure `backend/pertes.ts` (TDD)

**Files:**
- Modify: `frontend/backend/types.ts`
- Create: `frontend/backend/pertes.ts`
- Create: `frontend/backend/__tests__/pertes.test.ts`

**Interfaces:**
- Produces:
  - `interface Perte { id: string; produitId: string; produitNom: string; quantite: number; prixAchat: number; date: number; createdAt: number; updatedAt: number; deleted?: boolean; }`
  - `validerPerte(quantite: number, stockDisponible: number): string | null`
  - `pertesDuMois(pertes: Perte[], now?: number): Perte[]`
  - `valeurPerte(perte: Perte): number`
  - `totalPertes(pertes: Perte[]): number`

- [ ] **Step 1 : Ajouter le type dans `frontend/backend/types.ts`**

Ajouter à la fin du fichier :

```typescript
export interface Perte {
  id: string;
  produitId: string;
  produitNom: string;
  quantite: number;
  prixAchat: number;
  date: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

- [ ] **Step 2 : Écrire les tests (ils vont échouer)**

Créer `frontend/backend/__tests__/pertes.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { validerPerte, pertesDuMois, valeurPerte, totalPertes } from '../pertes';
import type { Perte } from '../types';

function creerPerte(overrides: Partial<Perte> = {}): Perte {
  const now = Date.now();
  return {
    id: 'p1',
    produitId: 'prod1',
    produitNom: 'Savon',
    quantite: 2,
    prixAchat: 500,
    date: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('validerPerte', () => {
  it('refuse une quantité à 0', () => {
    expect(validerPerte(0, 10)).toBe('La quantité doit être supérieure à 0');
  });

  it('refuse une quantité négative', () => {
    expect(validerPerte(-1, 10)).toBe('La quantité doit être supérieure à 0');
  });

  it('refuse une quantité supérieure au stock disponible', () => {
    expect(validerPerte(11, 10)).toBe('Quantité perdue supérieure au stock disponible');
  });

  it('accepte une quantité égale au stock disponible', () => {
    expect(validerPerte(10, 10)).toBeNull();
  });

  it('accepte une quantité valide inférieure au stock', () => {
    expect(validerPerte(3, 10)).toBeNull();
  });
});

describe('pertesDuMois', () => {
  it('ne garde que les pertes du mois calendaire en cours', () => {
    const now = new Date(2026, 8, 15).getTime(); // 15 septembre 2026
    const cetteMois = creerPerte({ id: 'p1', date: new Date(2026, 8, 1).getTime() });
    const cetteMoisAussi = creerPerte({ id: 'p2', date: now });
    const moisDernier = creerPerte({ id: 'p3', date: new Date(2026, 7, 31).getTime() });
    const moisProchain = creerPerte({ id: 'p4', date: new Date(2026, 9, 1).getTime() });
    expect(pertesDuMois([cetteMois, cetteMoisAussi, moisDernier, moisProchain], now)).toEqual([cetteMois, cetteMoisAussi]);
  });
});

describe('valeurPerte', () => {
  it('multiplie le prix d\'achat par la quantité', () => {
    expect(valeurPerte(creerPerte({ prixAchat: 500, quantite: 3 }))).toBe(1500);
  });
});

describe('totalPertes', () => {
  it('additionne la valeur de chaque perte', () => {
    const pertes = [
      creerPerte({ prixAchat: 500, quantite: 2 }),  // 1000
      creerPerte({ prixAchat: 1000, quantite: 1 }), // 1000
    ];
    expect(totalPertes(pertes)).toBe(2000);
  });

  it('retourne 0 pour une liste vide', () => {
    expect(totalPertes([])).toBe(0);
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

Run: `cd frontend && npx vitest run backend/__tests__/pertes.test.ts`
Expected: FAIL — `Cannot find module '../pertes'`

- [ ] **Step 4 : Créer `frontend/backend/pertes.ts`**

```typescript
import type { Perte } from './types';

export function validerPerte(quantite: number, stockDisponible: number): string | null {
  if (!quantite || quantite <= 0) return 'La quantité doit être supérieure à 0';
  if (quantite > stockDisponible) return 'Quantité perdue supérieure au stock disponible';
  return null;
}

function debutMois(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function debutMoisSuivant(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

export function pertesDuMois(pertes: Perte[], now: number = Date.now()): Perte[] {
  const debut = debutMois(now);
  const finExclusive = debutMoisSuivant(now);
  return pertes.filter((p) => p.date >= debut && p.date < finExclusive);
}

export function valeurPerte(perte: Perte): number {
  return perte.prixAchat * perte.quantite;
}

export function totalPertes(pertes: Perte[]): number {
  return pertes.reduce((sum, p) => sum + valeurPerte(p), 0);
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

Run: `cd frontend && npx vitest run backend/__tests__/pertes.test.ts`
Expected: tous les tests passent

- [ ] **Step 6 : Vérifier les types et la suite complète**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

Run: `cd frontend && npm test`
Expected: tous les fichiers de test passent (celui-ci + les existants)

- [ ] **Step 7 : Commit**

```bash
git add frontend/backend/types.ts frontend/backend/pertes.ts frontend/backend/__tests__/pertes.test.ts
git commit -m "feat: logique pertes de stock - validation, filtrage mensuel, valeur"
```

---

## Task 2 : Stockage local (Dexie) + migration Supabase + synchronisation cloud

**Files:**
- Modify: `frontend/lib/db.ts`
- Create: `frontend/supabase-migration-2026-09-03-pertes.sql`
- Modify: `frontend/lib/sync.ts`

**Interfaces:**
- Consumes: `Perte` de `@backend/types` (Task 1)
- Produces:
  - `db.pertes: EntityTable<Perte, 'id'>` (Dexie, exportée via `db` déjà exporté par `lib/db.ts`)
  - `clearLocalData()` (déjà existante, étendue pour vider aussi cette table)
  - Table Supabase `pertes` avec RLS par `user_id`
  - `pull()`/`push()` de `lib/sync.ts` (déjà exportées via `fullSync`) synchronisent désormais aussi cette table

- [ ] **Step 1 : Mettre à jour `frontend/lib/db.ts`**

Remplacer la ligne d'import :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande, Depense } from '@backend/types';
```

par :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande, Depense, Perte } from '@backend/types';
```

Dans la classe `MargoDB`, ajouter un champ après `depenses!: EntityTable<Depense, 'id'>;` :

```typescript
  pertes!: EntityTable<Perte, 'id'>;
```

Ajouter une nouvelle version de schéma après le bloc `this.version(7).stores({...});` existant (à l'intérieur du constructeur) :

```typescript
    // v8 - pertes de stock (produits abimes ou casses) pour le seuil de rentabilite
    this.version(8).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      fournisseurs: 'id, nom, updatedAt, deleted',
      commandes: 'id, fournisseurId, dateCommande, updatedAt, deleted',
      depenses: 'id, date, updatedAt, deleted',
      pertes: 'id, produitId, date, updatedAt, deleted',
      config: 'id',
    });
```

Mettre à jour `clearLocalData()` (déjà existante dans ce fichier) pour vider aussi cette nouvelle table :

```typescript
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [db.produits, db.ventes, db.packs, db.fournisseurs, db.commandes, db.depenses, db.pertes, db.config], async () => {
    await db.produits.clear();
    await db.ventes.clear();
    await db.packs.clear();
    await db.fournisseurs.clear();
    await db.commandes.clear();
    await db.depenses.clear();
    await db.pertes.clear();
    await db.config.clear();
  });
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Créer la migration SQL `frontend/supabase-migration-2026-09-03-pertes.sql`**

```sql
-- =====================================================================
-- MargoPro — Migration 2026-09-03
-- Pertes de stock (produits abimes ou casses)
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

create table if not exists public.pertes (
  id          uuid    primary key,
  user_id     uuid    not null references auth.users(id) on delete cascade,
  produit_id  uuid    not null,
  produit_nom text    not null,
  quantite    numeric not null,
  prix_achat  numeric not null,
  date        bigint  not null,
  created_at  bigint  not null,
  updated_at  bigint  not null,
  deleted     boolean not null default false
);
create index if not exists pertes_user_id_idx on public.pertes (user_id);

alter table public.pertes enable row level security;
drop policy if exists "pertes_owner" on public.pertes;
create policy "pertes_owner" on public.pertes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

Note : pas de contrainte `references` sur `produit_id` vers `produits.id` — le projet n'utilise pas de clés étrangères entre ces tables (voir la migration `fournisseurs`/`commandes`), la cohérence est gérée côté app pour rester compatible avec la création hors-ligne.

- [ ] **Step 4 : Mettre à jour `frontend/lib/sync.ts` — imports et mappers**

Remplacer la ligne d'import :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande, Depense } from '@backend/types';
```

par :

```typescript
import type { Produit, Vente, Config, Pack, Fournisseur, Commande, Depense, Perte } from '@backend/types';
```

Repérer la fonction `rowToDepense` (elle se termine juste avant le commentaire `// ---------------------------------------------------------------------\n// Helpers`). Juste après sa fermeture, avant ce commentaire `// Helpers`, ajouter :

```typescript
type PerteRow = {
  id: string;
  user_id: string;
  produit_id: string;
  produit_nom: string;
  quantite: number;
  prix_achat: number;
  date: number;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

function perteToRow(p: Perte, userId: string): PerteRow {
  return {
    id: p.id,
    user_id: userId,
    produit_id: p.produitId,
    produit_nom: p.produitNom,
    quantite: p.quantite,
    prix_achat: p.prixAchat,
    date: p.date,
    created_at: p.createdAt ?? Date.now(),
    updated_at: p.updatedAt ?? Date.now(),
    deleted: p.deleted ?? false,
  };
}

function rowToPerte(r: PerteRow): Perte {
  return {
    id: r.id,
    produitId: r.produit_id,
    produitNom: r.produit_nom,
    quantite: Number(r.quantite),
    prixAchat: Number(r.prix_achat),
    date: Number(r.date),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}
```

- [ ] **Step 5 : Étendre `pull()` dans `frontend/lib/sync.ts`**

Repérer le bloc `// --- depenses (non-fatal : si la table n'existe pas encore, on continue) ---` à l'intérieur de la fonction `pull`, juste avant sa fermeture (`}` qui suit son `catch`). Juste après ce bloc depenses, ajouter :

```typescript
  // --- pertes (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const { data: pertesRows, error: perErr } = await supabase
      .from('pertes')
      .select('*')
      .eq('user_id', userId);
    if (perErr) throw perErr;

    for (const row of (pertesRows ?? []) as PerteRow[]) {
      const remote = rowToPerte(row);
      const local = await db.pertes.get(remote.id);
      if (!local || remote.updatedAt > (local.updatedAt ?? 0)) {
        await db.pertes.put(remote);
      }
    }
  } catch (err) {
    console.warn('[sync] pull pertes ignoré :', err);
  }
```

- [ ] **Step 6 : Étendre `push()` dans `frontend/lib/sync.ts`**

Repérer le bloc `// --- depenses (non-fatal : si la table n'existe pas encore, on continue) ---` à l'intérieur de la fonction `push`, juste avant sa fermeture (`}` qui précède le commentaire `// FULL SYNC`). Juste après ce bloc depenses, ajouter :

```typescript
  // --- pertes (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const pertes = await db.pertes.toArray();
    if (pertes.length > 0) {
      const rows = pertes.map((p) => perteToRow(p, userId));
      const { error } = await supabase.from('pertes').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (err) {
    console.warn('[sync] push pertes ignoré :', err);
  }
```

- [ ] **Step 7 : Vérifier les types et les tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

Run: `cd frontend && npm test`
Expected: tous les tests passent

- [ ] **Step 8 : Commit**

```bash
git add frontend/lib/db.ts frontend/lib/sync.ts frontend/supabase-migration-2026-09-03-pertes.sql
git commit -m "feat: stockage local + sync cloud pour les pertes de stock"
```

---

## Task 3 : Hook `usePertes`

**Files:**
- Create: `frontend/lib/hooks/usePertes.ts`

**Interfaces:**
- Consumes: `db.pertes`, `db.produits`, `genId` de `../db` (Task 2) ; `validerPerte` de `@backend/pertes` (Task 1) ; `appliquerVente` de `@backend/stock` (déjà existant — même fonction que celle utilisée pour décrémenter le stock lors d'une vente, clampe à 0) ; `requestSync` de `../syncController` (déjà existant)
- Produces: `usePertes()` retournant `{ pertes: Perte[]; declarerPerte(produitId: string, produitNom: string, quantite: number, prixAchat: number): Promise<string | null>; }`

- [ ] **Step 1 : Créer `frontend/lib/hooks/usePertes.ts`**

```typescript
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerPerte } from '@backend/pertes';
import { appliquerVente } from '@backend/stock';
import { requestSync } from '../syncController';

export function usePertes() {
  const pertes = useLiveQuery(
    () => db.pertes.orderBy('date').reverse().filter((p) => !p.deleted).toArray()
  ) ?? [];

  async function declarerPerte(
    produitId: string,
    produitNom: string,
    quantite: number,
    prixAchat: number
  ): Promise<string | null> {
    const produit = await db.produits.get(produitId);
    if (!produit) return 'Produit introuvable';

    const erreur = validerPerte(quantite, produit.quantite);
    if (erreur) return erreur;

    const now = Date.now();
    await db.transaction('rw', db.produits, db.pertes, async () => {
      const updated = appliquerVente(produit, quantite);
      await db.produits.put(updated);
      await db.pertes.add({
        id: genId(),
        produitId,
        produitNom,
        quantite,
        prixAchat,
        date: now,
        createdAt: now,
        updatedAt: now,
        deleted: false,
      });
    });
    requestSync();
    return null;
  }

  return { pertes, declarerPerte };
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/hooks/usePertes.ts
git commit -m "feat: hook usePertes - declaration de perte avec decrement du stock"
```

---

## Task 4 : Bouton et fenêtre "J'ai perdu de la marchandise" dans la fiche produit du Stock

**Files:**
- Modify: `frontend/app/stock/page.tsx`

**Interfaces:**
- Consumes: `usePertes()` (Task 3)

- [ ] **Step 1 : Ajouter l'import**

Repérer, en haut du fichier :

```typescript
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
```

Remplacer par :

```typescript
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePertes } from '@/lib/hooks/usePertes';
```

- [ ] **Step 2 : Utiliser le hook et ajouter l'état de la fenêtre**

Repérer :

```typescript
  const { produits, alertes, ajouterProduit, supprimerProduit, restaurerProduit, modifierProduit } = useStock();
  const { ventes } = useVentes('tout');
```

Remplacer par :

```typescript
  const { produits, alertes, ajouterProduit, supprimerProduit, restaurerProduit, modifierProduit } = useStock();
  const { ventes } = useVentes('tout');
  const { declarerPerte } = usePertes();
```

Repérer :

```typescript
  const [champsReappro, setChampsReappro] = useState({ quantite: '', prixAchat: '' });
  const [reapproMode, setReapproMode] = useState<'paquets' | 'unites'>('unites');
  const [reapproMsg, setReapproMsg] = useState('');
  const [showReappro, setShowReappro] = useState(false);
```

Remplacer par :

```typescript
  const [champsReappro, setChampsReappro] = useState({ quantite: '', prixAchat: '' });
  const [reapproMode, setReapproMode] = useState<'paquets' | 'unites'>('unites');
  const [reapproMsg, setReapproMsg] = useState('');
  const [showReappro, setShowReappro] = useState(false);
  const [champsPerte, setChampsPerte] = useState({ quantite: '' });
  const [erreurPerte, setErreurPerte] = useState('');
  const [perteMsg, setPerteMsg] = useState('');
  const [showPerte, setShowPerte] = useState(false);
```

- [ ] **Step 3 : Réinitialiser l'état de la fenêtre perte à l'ouverture d'une fiche produit**

Repérer, dans `openEditer` :

```typescript
    setErreurEdition('');
    setChampsReappro({ quantite: '', prixAchat: '' });
    setReapproMode(produit.tailleConditionnement && produit.tailleConditionnement > 0 ? 'paquets' : 'unites');
    setReapproMsg('');
    setShowReappro(false);
  }
```

Remplacer par :

```typescript
    setErreurEdition('');
    setChampsReappro({ quantite: '', prixAchat: '' });
    setReapproMode(produit.tailleConditionnement && produit.tailleConditionnement > 0 ? 'paquets' : 'unites');
    setReapproMsg('');
    setShowReappro(false);
    setChampsPerte({ quantite: '' });
    setErreurPerte('');
    setPerteMsg('');
    setShowPerte(false);
  }
```

- [ ] **Step 4 : Ajouter le handler de confirmation**

Repérer, juste après la fermeture de `handleAjouterAuStock` (la fonction qui gère le réapprovisionnement) :

```typescript
    setReapproMsg(`+${unites} unité${unites > 1 ? 's' : ''} → ${nouveauTotal} unités en stock`);
    setChampsReappro({ quantite: '', prixAchat: '' });
    setShowReappro(false);
  }
```

Remplacer par (ajoute une nouvelle fonction juste après, ne touche pas à `handleAjouterAuStock` lui-même) :

```typescript
    setReapproMsg(`+${unites} unité${unites > 1 ? 's' : ''} → ${nouveauTotal} unités en stock`);
    setChampsReappro({ quantite: '', prixAchat: '' });
    setShowReappro(false);
  }

  async function handleConfirmerPerte() {
    if (!produitEnEdition) return;
    setErreurPerte('');
    const perdu = Number(champsPerte.quantite);
    if (!perdu || perdu <= 0) return;
    const err = await declarerPerte(produitEnEdition.id, produitEnEdition.nom, perdu, produitEnEdition.prixAchat);
    if (err) { setErreurPerte(err); return; }
    const nouveauTotal = Math.max(0, Number(champsEdition.quantite || 0) - perdu);
    setChampsEdition(c => ({ ...c, quantite: String(nouveauTotal) }));
    setPerteMsg(`-${perdu} unité${perdu > 1 ? 's' : ''} → ${nouveauTotal} unités en stock`);
    setChampsPerte({ quantite: '' });
    setShowPerte(false);
  }
```

- [ ] **Step 5 : Ajouter le bouton dans la fiche produit**

Repérer ce bloc (le bouton de réapprovisionnement et son message de confirmation) :

```typescript
            {/* RÉAPPRO - bouton qui ouvre une fenêtre */}
            <button
              onClick={() => { setChampsReappro({ quantite: '', prixAchat: '' }); setShowReappro(true); }}
              style={{ width: '100%', marginBottom: reapproMsg ? 6 : 14, height: 46, borderRadius: 12, border: `1.5px solid ${T.accent}`, background: T.accentLight, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.accent, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.accent} strokeWidth="1.75" strokeLinejoin="round"/>
                <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              J&apos;ai reçu de la marchandise
            </button>
            {reapproMsg && (
              <div style={{ fontSize: 12, color: T.accent, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>{reapproMsg}</div>
            )}
```

Remplacer par (garde le bloc ci-dessus identique, ajoute le nouveau bouton juste après) :

```typescript
            {/* RÉAPPRO - bouton qui ouvre une fenêtre */}
            <button
              onClick={() => { setChampsReappro({ quantite: '', prixAchat: '' }); setShowReappro(true); }}
              style={{ width: '100%', marginBottom: reapproMsg ? 6 : 14, height: 46, borderRadius: 12, border: `1.5px solid ${T.accent}`, background: T.accentLight, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.accent, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.accent} strokeWidth="1.75" strokeLinejoin="round"/>
                <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              J&apos;ai reçu de la marchandise
            </button>
            {reapproMsg && (
              <div style={{ fontSize: 12, color: T.accent, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>{reapproMsg}</div>
            )}

            {/* PERTE - bouton qui ouvre une fenêtre */}
            <button
              onClick={() => { setChampsPerte({ quantite: '' }); setErreurPerte(''); setShowPerte(true); }}
              style={{ width: '100%', marginBottom: perteMsg ? 6 : 14, height: 46, borderRadius: 12, border: `1.5px solid ${T.red}`, background: T.redBg, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              J&apos;ai perdu de la marchandise
            </button>
            {perteMsg && (
              <div style={{ fontSize: 12, color: T.red, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>{perteMsg}</div>
            )}
```

- [ ] **Step 6 : Ajouter la fenêtre de confirmation**

Repérer la fin du bloc `{/* FENÊTRE RÉAPPRO */}` — sa fermeture exacte est :

```typescript
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReappro(false)} style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleAjouterAuStock} disabled={!(Number(champsReappro.quantite) > 0)}
                style={{ flex: 2, height: 46, borderRadius: 12, background: T.accent, border: 'none', cursor: Number(champsReappro.quantite) > 0 ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, color: 'white', opacity: Number(champsReappro.quantite) > 0 ? 1 : 0.5, fontFamily: 'Manrope, sans-serif' }}>
                Ajouter au stock
              </button>
            </div>
          </div>
        </div>
      )}
```

Remplacer par (garde ce bloc identique, ajoute la nouvelle fenêtre juste après, avant la ligne suivante du fichier) :

```typescript
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReappro(false)} style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleAjouterAuStock} disabled={!(Number(champsReappro.quantite) > 0)}
                style={{ flex: 2, height: 46, borderRadius: 12, background: T.accent, border: 'none', cursor: Number(champsReappro.quantite) > 0 ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, color: 'white', opacity: Number(champsReappro.quantite) > 0 ? 1 : 0.5, fontFamily: 'Manrope, sans-serif' }}>
                Ajouter au stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FENÊTRE PERTE */}
      {showPerte && produitEnEdition && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 280, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowPerte(false)}
        >
          <div
            style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 360, padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              J&apos;ai perdu de la marchandise
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>{produitEnEdition.nom}</div>

            {erreurPerte && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreurPerte}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
                Unités perdues
              </label>
              <input type="number" onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()} autoFocus value={champsPerte.quantite} onChange={e => setChampsPerte({ quantite: e.target.value })} placeholder="0" min="0"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 18, fontWeight: 700, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              {Number(champsPerte.quantite) > 0 && (
                <div style={{ fontSize: 12, color: T.red, fontWeight: 600, marginTop: 4 }}>
                  → -{Number(champsPerte.quantite)} unités → {Math.max(0, Number(champsEdition.quantite || 0) - Number(champsPerte.quantite))} unités restants
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowPerte(false)} style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleConfirmerPerte} disabled={!(Number(champsPerte.quantite) > 0)}
                style={{ flex: 2, height: 46, borderRadius: 12, background: T.red, border: 'none', cursor: Number(champsPerte.quantite) > 0 ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, color: 'white', opacity: Number(champsPerte.quantite) > 0 ? 1 : 0.5, fontFamily: 'Manrope, sans-serif' }}>
                Confirmer la perte
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 7 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 8 : Lancer le dev server et tester manuellement**

Run: `cd frontend && npm run dev`

1. Ouvrir `http://localhost:3000/stock`, taper un produit ayant au moins quelques unités en stock
2. Vérifier que le bouton "J'ai perdu de la marchandise" (bordure/fond rouge) apparaît sous "J'ai reçu de la marchandise"
3. Cliquer dessus, taper une quantité supérieure au stock disponible → l'erreur "Quantité perdue supérieure au stock disponible" doit s'afficher, la fenêtre reste ouverte
4. Taper une quantité valide, vérifier l'aperçu "→ -X unités → Y unités restants" en direct, cliquer "Confirmer la perte"
5. Vérifier que la fenêtre se ferme, qu'un message "-X unité(s) → Y unités en stock" apparaît, et que le champ "Quantité" de la fiche produit reflète bien le nouveau total
6. Fermer la fiche sans cliquer "Enregistrer" (juste "Annuler" ou la croix), rouvrir le même produit : vérifier que la quantité en stock a bien été réduite en base (la perte a été enregistrée immédiatement, indépendamment du bouton "Enregistrer" de la fiche)
7. Arrêter le serveur dev (Ctrl+C)

- [ ] **Step 9 : Commit**

```bash
git add frontend/app/stock/page.tsx
git commit -m "feat: bouton et fenetre pour declarer une perte de stock"
```

---

## Task 5 : Intégrer les pertes dans le calcul du seuil de rentabilité

**Files:**
- Modify: `frontend/components/SeuilRentabilite.tsx`
- Modify: `frontend/components/MargeTab.tsx`
- Modify: `frontend/app/marges/page.tsx`

**Interfaces:**
- Consumes: `usePertes()` (Task 3) ; `pertesDuMois`, `totalPertes` de `@backend/pertes` (Task 1)

- [ ] **Step 1 : `frontend/components/SeuilRentabilite.tsx` — ajouter les pertes au total et afficher le détail**

Repérer :

```typescript
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { depensesDuMois, totalDepenses, objectifVenteParJour } from '@backend/depenses';
```

Remplacer par :

```typescript
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { usePertes } from '@/lib/hooks/usePertes';
import { depensesDuMois, totalDepenses, objectifVenteParJour } from '@backend/depenses';
import { pertesDuMois, totalPertes } from '@backend/pertes';
```

Repérer :

```typescript
  const { depenses, ajouterDepense, modifierDepense, supprimerDepense } = useDepenses();
  const { stats } = useVentes('mois');
```

Remplacer par :

```typescript
  const { depenses, ajouterDepense, modifierDepense, supprimerDepense } = useDepenses();
  const { pertes } = usePertes();
  const { stats } = useVentes('mois');
```

Repérer :

```typescript
  const depensesMois = depensesDuMois(depenses);
  const chargesDuMois = totalDepenses(depensesMois);
  const objectif = objectifVenteParJour(chargesDuMois, stats.benefice, stats.nombreVentes);
```

Remplacer par :

```typescript
  const depensesMois = depensesDuMois(depenses);
  const totalDepensesMois = totalDepenses(depensesMois);
  const totalPertesMois = totalPertes(pertesDuMois(pertes));
  const chargesDuMois = totalDepensesMois + totalPertesMois;
  const objectif = objectifVenteParJour(chargesDuMois, stats.benefice, stats.nombreVentes);
```

Repérer :

```typescript
        <div style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif', marginBottom: 4 }}>
          {fmtF(chargesDuMois)} <span style={{ fontSize: 15 }}>{symbole}</span>
        </div>

        {(showForm || depenseEnEdition) && (
```

Remplacer par :

```typescript
        <div style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif', marginBottom: 4 }}>
          {fmtF(chargesDuMois)} <span style={{ fontSize: 15 }}>{symbole}</span>
        </div>
        {totalPertesMois > 0 && (
          <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8 }}>
            Dépenses {fmtF(totalDepensesMois)} {symbole} + Pertes de stock {fmtF(totalPertesMois)} {symbole}
          </div>
        )}

        {(showForm || depenseEnEdition) && (
```

- [ ] **Step 2 : `frontend/components/MargeTab.tsx` — ajouter les pertes au total utilisé pour le plancher**

Repérer :

```typescript
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { depensesDuMois, totalDepenses, margePlancher } from '@backend/depenses';
```

Remplacer par :

```typescript
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { usePertes } from '@/lib/hooks/usePertes';
import { depensesDuMois, totalDepenses, margePlancher } from '@backend/depenses';
import { pertesDuMois, totalPertes } from '@backend/pertes';
```

Repérer :

```typescript
  const { depenses } = useDepenses();
  const { stats } = useVentes('mois');
```

Remplacer par :

```typescript
  const { depenses } = useDepenses();
  const { pertes } = usePertes();
  const { stats } = useVentes('mois');
```

Repérer :

```typescript
  const chargesDuMois = totalDepenses(depensesDuMois(depenses));
  const plancherPct = margePlancher(chargesDuMois, stats.chiffreAffaires);
```

Remplacer par :

```typescript
  const chargesDuMois = totalDepenses(depensesDuMois(depenses)) + totalPertes(pertesDuMois(pertes));
  const plancherPct = margePlancher(chargesDuMois, stats.chiffreAffaires);
```

- [ ] **Step 3 : `frontend/app/marges/page.tsx` — ajouter les pertes au total utilisé par le calculateur "Prix de vente"**

Repérer :

```typescript
import { useDepenses } from '@/lib/hooks/useDepenses';
import { meilleursProduits, filtrerParPeriode, calculerStats } from '@backend/ventes';
import { depensesDuMois, totalDepenses, margePlancher, coefficientDepuisPlancher } from '@backend/depenses';
```

Remplacer par :

```typescript
import { useDepenses } from '@/lib/hooks/useDepenses';
import { usePertes } from '@/lib/hooks/usePertes';
import { meilleursProduits, filtrerParPeriode, calculerStats } from '@backend/ventes';
import { depensesDuMois, totalDepenses, margePlancher, coefficientDepuisPlancher } from '@backend/depenses';
import { pertesDuMois, totalPertes } from '@backend/pertes';
```

Repérer :

```typescript
  const { depenses } = useDepenses();
```

Remplacer par :

```typescript
  const { depenses } = useDepenses();
  const { pertes } = usePertes();
```

Repérer :

```typescript
  const chargesDuMoisCourant = totalDepenses(depensesDuMois(depenses));
  const plancherPct = margePlancher(chargesDuMoisCourant, statsMoisCourant.chiffreAffaires);
```

Remplacer par :

```typescript
  const chargesDuMoisCourant = totalDepenses(depensesDuMois(depenses)) + totalPertes(pertesDuMois(pertes));
  const plancherPct = margePlancher(chargesDuMoisCourant, statsMoisCourant.chiffreAffaires);
```

- [ ] **Step 4 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 5 : Lancer le dev server et tester manuellement**

Run: `cd frontend && npm run dev`

1. Déclarer une perte sur un produit (onglet Stock, voir Task 4)
2. Ouvrir `/marges` → onglet **Seuil de rentabilité** (compte Premium) : vérifier que "Charges du mois" a augmenté, et que la ligne de détail "Dépenses X + Pertes de stock Y" apparaît sous le total
3. Onglet **Marge** : vérifier que la marge plancher a changé en conséquence
4. Onglet **Prix de vente** : vérifier que la marge par défaut du calculateur reflète le nouveau plancher
5. Arrêter le serveur dev (Ctrl+C)

- [ ] **Step 6 : Commit**

```bash
git add frontend/components/SeuilRentabilite.tsx frontend/components/MargeTab.tsx frontend/app/marges/page.tsx
git commit -m "feat: integre les pertes de stock dans le calcul du seuil de rentabilite"
```

---

## Task 6 : Migration Supabase (étape manuelle, hors code)

**Files:** aucun — étape à effectuer par Juanita dans le dashboard Supabase.

- [ ] **Step 1 : Exécuter la migration**

Dans Supabase Dashboard → SQL Editor → New query, coller le contenu de `frontend/supabase-migration-2026-09-03-pertes.sql` (créé à la Task 2) → Run.

- [ ] **Step 2 : Test de bout en bout par Juanita**

Une fois toutes les tâches déployées en production et la migration exécutée :
1. Déclarer une vraie perte sur un vrai produit
2. Vérifier que le stock a bien diminué et que le seuil de rentabilité a bien pris la perte en compte
3. Se déconnecter/reconnecter (ou ouvrir sur un autre appareil) pour confirmer que la perte est bien synchronisée dans le cloud
