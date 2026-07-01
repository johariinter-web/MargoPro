# Expiration Plan Gratuit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implémenter l'expiration des 30 jours d'essai gratuit : bannière de countdown, écran bloquant de sélection des 5 produits à garder, et modal WhatsApp pour upgrade Premium.

**Architecture:** `trialStart` et `isPremium` stockés dans Supabase (table `config`) et cachés dans Dexie. Un hook `usePlan()` calcule le statut à partir du cache local. Trois composants UI (bannière, modal upgrade, écran bloquant) s'injectent dans le layout existant.

**Tech Stack:** Next.js 15 App Router, TypeScript, Dexie.js (IndexedDB), Supabase (sync cloud), Vitest (tests), inline styles uniquement (pas de Tailwind dans les composants).

## Global Constraints

- Inline styles uniquement dans les composants — JAMAIS de classes Tailwind
- Tous les boutons : `height` minimum 44px
- Couleur principale : `#059669` (vert émeraude) ; alertes : `#F97316` (orange)
- Fond : `#FAFAF9` ; texte principal : `#1C1811`
- Font : `Manrope, sans-serif` dans tous les composants
- WhatsApp : `https://wa.me/22996116003?text=Bonjour%2C+je+veux+passer+au+Premium+MargoPro.`
- Aucun test sur Supabase, Dexie ou hooks React — uniquement les fonctions pures
- `'use client'` en première ligne de tout composant/hook client
- Commandes depuis le répertoire `frontend/`

---

### Task 1 : Types + Migration Dexie

**Files:**
- Modify: `backend/types.ts`
- Modify: `frontend/lib/db.ts`

**Interfaces:**
- Produces: `Config.trialStart?: number`, `Config.isPremium?: boolean`, `Produit.archived?: boolean` — utilisés dans toutes les tâches suivantes

- [ ] **Step 1 : Mettre à jour `backend/types.ts`**

Remplacer le contenu par :

```typescript
export interface Produit {
  id: string;
  nom: string;
  quantite: number;
  prixAchat: number;
  prixVente: number;
  seuilAlerte: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  archived?: boolean;      // true = masqué mais non supprimé
  codeBarres?: string;
  categorie?: string;
  tailleConditionnement?: number;
  photo?: string;
  photoPath?: string | null;
}

export interface Vente {
  id: string;
  produitId: string;
  produitNom: string;
  quantite: number;
  prixVente: number;
  prixAchat: number;
  total: number;
  benefice: number;
  date: number;
  updatedAt?: number;
  deleted?: boolean;
}

export interface Config {
  id: 'singleton';
  nomCommerce: string;
  devise: string;
  symboleDevise: string;
  onboardingComplete: boolean;
  trialStart?: number;     // timestamp ms du premier produit ajouté
  isPremium?: boolean;     // true = plan Premium actif
  dateAbonnement?: number;
  updatedAt?: number;
}

export type Periode = 'jour' | 'semaine' | 'mois' | 'tout';

export interface StatsPeriode {
  chiffreAffaires: number;
  benefice: number;
  nombreVentes: number;
  periode: Periode;
}
```

- [ ] **Step 2 : Ajouter la migration Dexie v3 dans `frontend/lib/db.ts`**

Après le bloc `this.version(2)...`, ajouter :

```typescript
    // v3 — plan gratuit : champ archived sur les produits
    this.version(3)
      .stores({
        produits: 'id, nom, quantite, updatedAt, deleted, archived',
        ventes: 'id, produitId, date, updatedAt, deleted',
        config: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('produits').toCollection().modify((p) => {
          if (p.archived === undefined) p.archived = false;
        });
      });
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add backend/types.ts frontend/lib/db.ts
git commit -m "feat: types + migration Dexie v3 (archived, trialStart, isPremium)"
```

---

### Task 2 : Sync Supabase — trial_start, is_premium, archived

**Files:**
- Modify: `frontend/lib/sync.ts`

**Interfaces:**
- Consumes: `Config.trialStart`, `Config.isPremium`, `Produit.archived` (Task 1)
- Produces: sync bidirectionnel de ces champs avec Supabase

**Note préalable :** Avant de lancer l'app sur un vrai compte, exécuter dans le dashboard Supabase :
```sql
ALTER TABLE config ADD COLUMN IF NOT EXISTS trial_start BIGINT;
ALTER TABLE config ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE produits ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 1 : Mettre à jour `ProduitRow` dans `sync.ts`**

Ajouter `archived: boolean;` à la fin du type `ProduitRow` :

```typescript
type ProduitRow = {
  id: string;
  user_id: string;
  nom: string;
  quantite: number;
  prix_achat: number;
  prix_vente: number;
  seuil_alerte: number;
  code_barres: string | null;
  categorie: string | null;
  taille_conditionnement: number | null;
  photo_path: string | null;
  created_at: number;
  updated_at: number;
  deleted: boolean;
  archived: boolean;       // ← nouveau
};
```

- [ ] **Step 2 : Mettre à jour `produitToRow` dans `sync.ts`**

Ajouter `archived: p.archived ?? false,` avant la fermeture de l'objet :

```typescript
function produitToRow(p: Produit, userId: string): ProduitRow {
  return {
    id: p.id,
    user_id: userId,
    nom: p.nom,
    quantite: p.quantite,
    prix_achat: p.prixAchat,
    prix_vente: p.prixVente,
    seuil_alerte: p.seuilAlerte,
    code_barres: p.codeBarres ?? null,
    categorie: p.categorie ?? null,
    taille_conditionnement: p.tailleConditionnement ?? null,
    photo_path: p.photoPath ?? null,
    created_at: p.createdAt ?? Date.now(),
    updated_at: p.updatedAt ?? Date.now(),
    deleted: p.deleted ?? false,
    archived: p.archived ?? false,   // ← nouveau
  };
}
```

- [ ] **Step 3 : Mettre à jour `rowToProduit` dans `sync.ts`**

Ajouter `archived: r.archived ?? false,` :

```typescript
function rowToProduit(r: ProduitRow): Produit {
  return {
    id: r.id,
    nom: r.nom,
    quantite: Number(r.quantite),
    prixAchat: Number(r.prix_achat),
    prixVente: Number(r.prix_vente),
    seuilAlerte: Number(r.seuil_alerte),
    codeBarres: r.code_barres ?? undefined,
    categorie: r.categorie ?? undefined,
    tailleConditionnement: r.taille_conditionnement ?? undefined,
    photoPath: r.photo_path ?? undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
    archived: r.archived ?? false,   // ← nouveau
  };
}
```

- [ ] **Step 4 : Mettre à jour `ConfigRow` dans `sync.ts`**

Remplacer le type `ConfigRow` par :

```typescript
type ConfigRow = {
  user_id: string;
  nom_commerce: string | null;
  devise: string | null;
  symbole_devise: string | null;
  onboarding_complete: boolean;
  date_abonnement: number | null;
  trial_start: number | null;    // ← nouveau
  is_premium: boolean;           // ← nouveau
  updated_at: number;
};
```

- [ ] **Step 5 : Mettre à jour `configToRow` dans `sync.ts`**

```typescript
function configToRow(c: Config, userId: string): ConfigRow {
  return {
    user_id: userId,
    nom_commerce: c.nomCommerce ?? null,
    devise: c.devise ?? null,
    symbole_devise: c.symboleDevise ?? null,
    onboarding_complete: c.onboardingComplete ?? false,
    date_abonnement: c.dateAbonnement ?? null,
    trial_start: c.trialStart ?? null,    // ← nouveau
    is_premium: c.isPremium ?? false,     // ← nouveau
    updated_at: c.updatedAt ?? Date.now(),
  };
}
```

- [ ] **Step 6 : Mettre à jour `rowToConfig` dans `sync.ts`**

```typescript
function rowToConfig(r: ConfigRow): Config {
  return {
    id: 'singleton',
    nomCommerce: r.nom_commerce ?? '',
    devise: r.devise ?? '',
    symboleDevise: r.symbole_devise ?? '',
    onboardingComplete: r.onboarding_complete ?? false,
    dateAbonnement: r.date_abonnement ?? undefined,
    trialStart: r.trial_start ?? undefined,    // ← nouveau
    isPremium: r.is_premium ?? false,          // ← nouveau
    updatedAt: Number(r.updated_at),
  };
}
```

- [ ] **Step 7 : Vérifier la compilation**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 8 : Commit**

```bash
git add frontend/lib/sync.ts
git commit -m "feat: sync trial_start, is_premium, archived vers Supabase"
```

---

### Task 3 : Hook `usePlan` + mise à jour `useStock`

**Files:**
- Create: `frontend/lib/hooks/usePlan.ts`
- Create: `frontend/lib/__tests__/usePlan.test.ts`
- Modify: `frontend/lib/hooks/useStock.ts`

**Interfaces:**
- Consumes: `Config.trialStart`, `Config.isPremium`, `Produit.archived` (Task 1)
- Produces:
  - `computePlanStatus(trialStart, isPremium, activeProductCount, now?): PlanInfo`
  - `usePlan(): PlanInfo`
  - `PlanStatus` type, `PlanInfo` interface
  - `useStock().produits` — filtre maintenant les produits archivés

- [ ] **Step 1 : Écrire les tests**

Créer `frontend/lib/__tests__/usePlan.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { computePlanStatus } from '../hooks/usePlan';

const DAY = 24 * 60 * 60 * 1000;

describe('computePlanStatus', () => {
  it('retourne premium si isPremium = true, peu importe le reste', () => {
    const r = computePlanStatus(undefined, true, 100, Date.now());
    expect(r.status).toBe('premium');
    expect(r.canAddProduct).toBe(true);
    expect(r.daysRemaining).toBe(0);
  });

  it('retourne trial si trialStart non défini (pas encore commencé)', () => {
    const r = computePlanStatus(undefined, false, 0, Date.now());
    expect(r.status).toBe('trial');
    expect(r.canAddProduct).toBe(true);
    expect(r.daysRemaining).toBe(30);
  });

  it('retourne trial si 22 jours écoulés (8 restants)', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 22 * DAY, false, 3, now);
    expect(r.status).toBe('trial');
    expect(r.daysRemaining).toBe(8);
  });

  it('retourne warning si exactement 7 jours restants', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 23 * DAY, false, 2, now);
    expect(r.status).toBe('warning');
    expect(r.daysRemaining).toBe(7);
  });

  it('retourne warning si 1 jour restant', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 29 * DAY, false, 4, now);
    expect(r.status).toBe('warning');
    expect(r.daysRemaining).toBe(1);
  });

  it('retourne expired si 30 jours dépassés', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 8, now);
    expect(r.status).toBe('expired');
    expect(r.daysRemaining).toBe(0);
  });

  it('canAddProduct = false si expiré et exactement 5 produits actifs', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 5, now);
    expect(r.canAddProduct).toBe(false);
  });

  it('canAddProduct = false si expiré et plus de 5 produits actifs', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 12, now);
    expect(r.canAddProduct).toBe(false);
  });

  it('canAddProduct = true si expiré mais seulement 4 produits actifs', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 4, now);
    expect(r.canAddProduct).toBe(true);
  });
});
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run lib/__tests__/usePlan.test.ts
```

Expected: FAIL — `computePlanStatus` n'existe pas encore.

- [ ] **Step 3 : Créer `frontend/lib/hooks/usePlan.ts`**

```typescript
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../db';
import { requestSync } from '../syncController';

export type PlanStatus = 'premium' | 'trial' | 'warning' | 'expired';

export interface PlanInfo {
  status: PlanStatus;
  daysRemaining: number;   // 0 si expiré ou premium
  isPremium: boolean;
  activeProductCount: number;
  canAddProduct: boolean;
}

const TRIAL_DAYS = 30;
const WARNING_DAYS = 7;

export function computePlanStatus(
  trialStart: number | undefined,
  isPremium: boolean,
  activeProductCount: number,
  now: number = Date.now()
): PlanInfo {
  if (isPremium) {
    return { status: 'premium', daysRemaining: 0, isPremium: true, activeProductCount, canAddProduct: true };
  }

  if (trialStart === undefined) {
    return { status: 'trial', daysRemaining: TRIAL_DAYS, isPremium: false, activeProductCount, canAddProduct: true };
  }

  const elapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - elapsed);

  let status: PlanStatus;
  if (remaining === 0) status = 'expired';
  else if (remaining <= WARNING_DAYS) status = 'warning';
  else status = 'trial';

  const canAddProduct = status !== 'expired' || activeProductCount < 5;

  return { status, daysRemaining: remaining, isPremium: false, activeProductCount, canAddProduct };
}

export function usePlan(): PlanInfo {
  const result = useLiveQuery(async () => {
    const config = await db.config.get('singleton');
    const activeProductCount = await db.produits
      .filter(p => !p.deleted && !p.archived)
      .count();
    return computePlanStatus(
      config?.trialStart,
      config?.isPremium ?? false,
      activeProductCount
    );
  });

  // Désarchiver tous les produits dès que l'utilisateur passe au Premium
  useEffect(() => {
    if (!result?.isPremium) return;
    const now = Date.now();
    db.produits
      .filter(p => !!p.archived)
      .modify({ archived: false, updatedAt: now })
      .then(() => requestSync());
  }, [result?.isPremium]);

  return result ?? {
    status: 'trial',
    daysRemaining: TRIAL_DAYS,
    isPremium: false,
    activeProductCount: 0,
    canAddProduct: true,
  };
}
```

- [ ] **Step 4 : Lancer les tests — ils doivent passer**

```bash
npx vitest run lib/__tests__/usePlan.test.ts
```

Expected: 9/9 PASS.

- [ ] **Step 5 : Mettre à jour `frontend/lib/hooks/useStock.ts`**

Deux changements :
1. Filtrer les produits archivés dans `useLiveQuery`
2. Déclencher `trialStart` au premier produit ajouté

Remplacer le fichier entier par :

```typescript
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerProduit, alertesStockBas, appliquerVente, stockTotal } from '@backend/stock';
import { requestSync } from '../syncController';
import type { Produit } from '@backend/types';

export function useStock() {
  const produits = useLiveQuery(
    () => db.produits.orderBy('nom').filter((p) => !p.deleted && !p.archived).toArray()
  ) ?? [];

  async function ajouterProduit(data: Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    const erreur = validerProduit(data);
    if (erreur) return erreur;
    const now = Date.now();

    // Déclencher le chrono d'essai au premier produit
    const config = await db.config.get('singleton');
    if (config && config.trialStart === undefined) {
      await db.config.update('singleton', { trialStart: now, updatedAt: now });
      requestSync();
    }

    await db.produits.add({ ...data, id: genId(), createdAt: now, updatedAt: now, deleted: false, archived: false });
    requestSync();
    return null;
  }

  async function modifierProduit(id: string, data: Partial<Omit<Produit, 'id' | 'createdAt'>>): Promise<string | null> {
    const erreur = validerProduit(data);
    if (erreur) return erreur;
    await db.produits.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerProduit(id: string) {
    await db.produits.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  async function restaurerProduit(id: string) {
    await db.produits.update(id, { deleted: false, updatedAt: Date.now() });
    requestSync();
  }

  async function deduireStock(produitId: string, quantite: number) {
    const produit = await db.produits.get(produitId);
    if (!produit) return;
    const updated = appliquerVente(produit, quantite);
    await db.produits.put(updated);
    requestSync();
  }

  return {
    produits,
    alertes: alertesStockBas(produits),
    total: stockTotal(produits),
    ajouterProduit,
    modifierProduit,
    supprimerProduit,
    restaurerProduit,
    deduireStock,
  };
}
```

- [ ] **Step 6 : Lancer tous les tests**

```bash
npx vitest run
```

Expected: tous les tests passent (incluant les tests existants de deviceSession et photoSync).

- [ ] **Step 7 : Commit**

```bash
git add frontend/lib/hooks/usePlan.ts frontend/lib/__tests__/usePlan.test.ts frontend/lib/hooks/useStock.ts
git commit -m "feat: hook usePlan + filtrage produits archivés dans useStock"
```

---

### Task 4 : Composants UI — ModalUpgrade, BanniereEssai, EcranExpiration

**Files:**
- Create: `frontend/components/ModalUpgrade.tsx`
- Create: `frontend/components/BanniereEssai.tsx`
- Create: `frontend/components/EcranExpiration.tsx`

**Interfaces:**
- Consumes: `usePlan()` (Task 3), `db` (Dexie), `requestSync`
- Produces: trois composants exports nommés, prêts à insérer dans le layout

- [ ] **Step 1 : Créer `frontend/components/ModalUpgrade.tsx`**

```typescript
'use client';

const WA_URL = 'https://wa.me/22996116003?text=Bonjour%2C+je+veux+passer+au+Premium+MargoPro.';

interface Props {
  onClose: () => void;
}

export function ModalUpgrade({ onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(28,24,17,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, padding: '32px 24px',
        maxWidth: 340, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⭐</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1811', marginBottom: 10 }}>
          Passer au Premium
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 1.7 }}>
          Le paiement en ligne arrive bientôt !{'\n'}Pour passer au Premium maintenant, contactez-nous sur WhatsApp.
        </div>
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            height: 52, borderRadius: 14,
            background: '#25D366', color: 'white',
            fontWeight: 700, fontSize: 15, textDecoration: 'none',
            marginBottom: 12,
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.524 3.655 1.435 5.16L2 22l4.981-1.404A9.96 9.96 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" fillRule="evenodd" clipRule="evenodd"/>
          </svg>
          Contacter sur WhatsApp
        </a>
        <button
          onClick={onClose}
          style={{
            width: '100%', height: 44, borderRadius: 12,
            background: '#F3F4F6', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14, color: '#6B7280',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Créer `frontend/components/BanniereEssai.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { usePlan } from '@/lib/hooks/usePlan';
import { ModalUpgrade } from './ModalUpgrade';

export function BanniereEssai() {
  const plan = usePlan();
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (plan.status !== 'warning' || dismissed) return null;

  const j = plan.daysRemaining;
  const msg = j === 1 ? 'expire demain' : `expire dans ${j} jour${j > 1 ? 's' : ''}`;

  return (
    <>
      <div style={{
        background: '#F97316', color: 'white',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600,
        flexWrap: 'wrap',
      }}>
        <span>⏳ Votre essai gratuit {msg}</span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'white', color: '#F97316',
              border: 'none', borderRadius: 8, padding: '0 12px',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', height: 32,
            }}
          >
            Passer au Premium
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'rgba(255,255,255,0.25)', border: 'none',
              borderRadius: 8, color: 'white', fontWeight: 700, fontSize: 18,
              cursor: 'pointer', width: 32, height: 32, lineHeight: 1, padding: 0,
            }}
            aria-label="Fermer la bannière"
          >
            ×
          </button>
        </div>
      </div>
      {showModal && <ModalUpgrade onClose={() => setShowModal(false)} />}
    </>
  );
}
```

- [ ] **Step 3 : Créer `frontend/components/EcranExpiration.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePlan } from '@/lib/hooks/usePlan';
import { ModalUpgrade } from './ModalUpgrade';
import { db } from '@/lib/db';
import { requestSync } from '@/lib/syncController';

export function EcranExpiration() {
  const plan = usePlan();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const produits = useLiveQuery(
    () => db.produits.orderBy('nom').filter(p => !p.deleted && !p.archived).toArray()
  ) ?? [];

  if (plan.status !== 'expired' || plan.activeProductCount <= 5) return null;

  function toggle(id: string) {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  }

  async function confirmer() {
    if (selection.size !== 5 || loading) return;
    setLoading(true);
    const now = Date.now();
    for (const p of produits) {
      if (!selection.has(p.id)) {
        await db.produits.update(p.id, { archived: true, updatedAt: now });
      }
    }
    requestSync();
    // usePlan se re-calcule automatiquement via useLiveQuery → EcranExpiration disparaît
  }

  const selCount = selection.size;

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: '#FAFAF9',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Manrope, sans-serif',
        maxWidth: 480, margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ padding: '36px 24px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1C1811', marginBottom: 10 }}>
            Essai terminé
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>
            Votre essai de 30 jours est terminé. Choisissez 5 produits à garder actifs. Les autres seront archivés — pas supprimés. Ils reviennent si vous passez au Premium.
          </div>
          <div style={{
            marginTop: 14, display: 'inline-block',
            fontSize: 13, fontWeight: 700, borderRadius: 20, padding: '4px 12px',
            background: selCount === 5 ? '#D1FAE5' : '#FFF7ED',
            color: selCount === 5 ? '#059669' : '#F97316',
          }}>
            {selCount}/5 sélectionnés
          </div>
        </div>

        {/* Liste produits */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {produits.map(p => {
            const checked = selection.has(p.id);
            const disabled = !checked && selCount >= 5;
            return (
              <div
                key={p.id}
                onClick={() => !disabled && toggle(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 24px',
                  opacity: disabled ? 0.35 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  borderBottom: '1px solid #F3F4F6',
                  background: checked ? '#F0FDF4' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  border: checked ? 'none' : '2px solid #D1D5DB',
                  background: checked ? '#059669' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7l3.5 3.5L11.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1811', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.nom}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    Qté : {p.quantite}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px 40px', borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={confirmer}
            disabled={selCount !== 5 || loading}
            style={{
              height: 52, borderRadius: 14, border: 'none',
              background: selCount === 5 ? '#059669' : '#E5E7EB',
              color: selCount === 5 ? 'white' : '#9CA3AF',
              cursor: selCount === 5 && !loading ? 'pointer' : 'default',
              fontWeight: 700, fontSize: 16, fontFamily: 'Manrope, sans-serif',
            }}
          >
            {loading ? 'Enregistrement…' : 'Confirmer la sélection'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              height: 48, borderRadius: 14, border: '2px solid #059669',
              background: 'transparent', color: '#059669',
              cursor: 'pointer', fontWeight: 700, fontSize: 14,
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            Passer au Premium — tout garder
          </button>
        </div>
      </div>

      {showModal && <ModalUpgrade onClose={() => setShowModal(false)} />}
    </>
  );
}
```

- [ ] **Step 4 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/ModalUpgrade.tsx frontend/components/BanniereEssai.tsx frontend/components/EcranExpiration.tsx
git commit -m "feat: composants ModalUpgrade, BanniereEssai, EcranExpiration"
```

---

### Task 5 : Intégration layout + page Stock

**Files:**
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/stock/page.tsx`

**Interfaces:**
- Consumes: `BanniereEssai`, `EcranExpiration` (Task 4), `usePlan()` (Task 3), `ModalUpgrade` (Task 4)
- Produces: enforcement complet visible dans l'app

- [ ] **Step 1 : Modifier `frontend/app/layout.tsx`**

Ajouter les imports des deux nouveaux composants et les insérer dans le `<main>` **avant** `{children}` :

```typescript
import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { SyncStarter } from "@/lib/hooks/useSync";
import { DeviceSessionStarter } from "@/lib/hooks/useDeviceSession";
import { BanniereEssai } from "@/components/BanniereEssai";
import { EcranExpiration } from "@/components/EcranExpiration";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MargoPro",
  description: "Gérez votre commerce simplement",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MargoPro",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4601A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${manrope.variable} ${spaceGrotesk.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('margopro-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body style={{ minHeight: '100%', background: 'var(--background)', color: 'var(--foreground)' }}>
        <SyncStarter />
        <DeviceSessionStarter />
        <main style={{ maxWidth: 480, margin: '0 auto', position: 'relative', minHeight: '100dvh' }}>
          <BanniereEssai />
          <EcranExpiration />
          {children}
          <BottomNav />
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2 : Modifier le bouton "Ajouter" dans `frontend/app/stock/page.tsx`**

En haut du composant, importer `usePlan` et `ModalUpgrade` :

```typescript
import { usePlan } from '@/lib/hooks/usePlan';
import { ModalUpgrade } from '@/components/ModalUpgrade';
```

À l'intérieur de la fonction composant, ajouter après les hooks existants :

```typescript
const plan = usePlan();
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
```

Remplacer le bouton "Ajouter" (ligne ~754) par :

```tsx
<button
  onClick={() => {
    if (!plan.canAddProduct) { setShowUpgradeModal(true); return; }
    setShowForm(true);
  }}
  style={{
    height: 40, borderRadius: 12,
    background: plan.canAddProduct ? T.accent : '#D1D5DB',
    color: 'white', fontSize: 13, fontWeight: 700, padding: '0 14px',
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  }}
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
  Ajouter
</button>
```

Ajouter le modal juste avant la fermeture du `return` :

```tsx
{showUpgradeModal && <ModalUpgrade onClose={() => setShowUpgradeModal(false)} />}
```

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: aucune erreur.

- [ ] **Step 4 : Lancer tous les tests**

```bash
npx vitest run
```

Expected: tous les tests passent.

- [ ] **Step 5 : Commit**

```bash
git add frontend/app/layout.tsx frontend/app/stock/page.tsx
git commit -m "feat: intégration expiration plan gratuit dans layout et page stock"
git push
```

---

## Note pour l'activation Premium manuelle

En attendant FedaPay, activer le Premium d'un utilisateur depuis le dashboard Supabase :

```sql
UPDATE config SET is_premium = true, updated_at = EXTRACT(EPOCH FROM NOW()) * 1000
WHERE user_id = '[UUID de l'utilisateur]';
```

Au prochain démarrage de l'app (sync cloud), l'utilisateur passe en Premium : la bannière et l'écran disparaissent, tous les produits archivés sont désarchivés automatiquement.
