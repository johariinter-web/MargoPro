# Packs de produits — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux abonnés Premium de créer des packs de produits pour liquider le stock mort, et de les vendre depuis l'onglet Ventes.

**Architecture:** Nouvelle table Dexie `packs` + sync Supabase bidirectionnelle. Côté UI, un 3e onglet "Packs" dans Stock, et un toggle Produit/Pack dans la page Ventes. Une vente de pack enregistre une seule ligne dans `ventes` avec `type: 'pack'` et décrémente le stock de chaque composant.

**Tech Stack:** Next.js 15 App Router, TypeScript, Dexie.js v5 migration, Supabase (new table `packs`), useLiveQuery (dexie-react-hooks), Tailwind/inline styles (pattern existant).

## Global Constraints

- Inline styles uniquement — pas de classes Tailwind dans les composants (pattern existant du projet)
- Couleurs via `useColors()` hook — ne jamais hardcoder des couleurs
- Devise via `useConfig()` → `config?.symboleDevise`
- Toutes les fonctions async UI retournent `string | null` (null = succès, string = message d'erreur)
- `requestSync()` après chaque mutation Dexie
- Police : `Manrope, sans-serif` (corps), `"Space Grotesk", sans-serif` (chiffres)
- Premium only : afficher `<ModalUpgrade>` si `!plan.isPremium`
- Boutons min 44px de hauteur, texte min 14px

---

## Fichiers modifiés / créés

| Fichier | Action |
|---|---|
| `frontend/backend/types.ts` | Modifier — ajouter `Pack`, `type?` sur `Vente` |
| `frontend/backend/packs.ts` | Créer — logique métier packs |
| `frontend/lib/db.ts` | Modifier — Dexie v5 + table `packs` |
| `frontend/lib/hooks/usePacks.ts` | Créer — hook CRUD packs |
| `frontend/lib/sync.ts` | Modifier — pull/push packs |
| `frontend/lib/hooks/useVentes.ts` | Modifier — supprimerVente/restaurerVente gèrent les packs |
| `frontend/app/stock/page.tsx` | Modifier — 3e onglet Packs + UI complète |
| `frontend/app/ventes/page.tsx` | Modifier — toggle Produit/Pack dans Nouvelle vente |

---

## Task 1 : Types + Dexie v5

**Files:**
- Modify: `frontend/backend/types.ts`
- Modify: `frontend/lib/db.ts`

**Interfaces:**
- Produces: `Pack` interface, `Vente.type` field, `db.packs` EntityTable

---

- [ ] **Step 1 : Ajouter `Pack` et `Vente.type` dans types.ts**

Ouvrir `frontend/backend/types.ts`. Ajouter après l'interface `Vente` :

```typescript
export interface Pack {
  id: string;
  nom: string;
  composants: Array<{ produitId: string; produitNom: string; quantite: number }>;
  prixVente: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

Dans l'interface `Vente` existante, ajouter après `montantRecu?` :

```typescript
  type?: 'produit' | 'pack';
```

- [ ] **Step 2 : Migration Dexie v5 dans db.ts**

Ouvrir `frontend/lib/db.ts`. Ajouter l'import de `Pack` :

```typescript
import type { Produit, Vente, Config, Pack } from '@backend/types';
```

Dans le corps de la classe `MargoDB`, ajouter après `config!` :

```typescript
  packs!: EntityTable<Pack, 'id'>;
```

Ajouter la version 5 après `this.version(4)...` (garder v1-v4 intactes) :

```typescript
    // v5 — packs de produits pour liquider le stock mort
    this.version(5).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      config: 'id',
    });
```

- [ ] **Step 3 : Vérifier les types TypeScript**

```bash
cd frontend && npm run type-check
```

Résultat attendu : aucune erreur sur `types.ts` ni `db.ts`.

- [ ] **Step 4 : Commit**

```bash
git add frontend/backend/types.ts frontend/lib/db.ts
git commit -m "feat: types Pack + Dexie v5 migration table packs"
```

---

## Task 2 : Logique métier packs

**Files:**
- Create: `frontend/backend/packs.ts`

**Interfaces:**
- Consumes: `Pack`, `Vente`, `Produit` from `./types`
- Produces:
  - `validerPack(data): string | null`
  - `prixAchatPack(pack, produitsMap): number`
  - `prixVenteSepares(pack, produitsMap): number`
  - `creerVentePack(pack, produitsMap, credit?): Omit<Vente, 'id'>`

---

- [ ] **Step 1 : Créer `frontend/backend/packs.ts`**

```typescript
import type { Pack, Vente, Produit } from './types';

export function validerPack(data: {
  nom?: string;
  composants?: Pack['composants'];
  prixVente?: number;
}): string | null {
  if (!data.nom || data.nom.trim() === '') return 'Le nom est obligatoire';
  if (!data.composants || data.composants.length === 0) return 'Ajoute au moins un produit';
  if (data.prixVente === undefined || data.prixVente < 0) return 'Le prix de vente ne peut pas être négatif';
  return null;
}

export function prixAchatPack(pack: Pack, produitsMap: Map<string, Produit>): number {
  return pack.composants.reduce((sum, c) => {
    const p = produitsMap.get(c.produitId);
    return sum + (p ? p.prixAchat * c.quantite : 0);
  }, 0);
}

export function prixVenteSepares(pack: Pack, produitsMap: Map<string, Produit>): number {
  return pack.composants.reduce((sum, c) => {
    const p = produitsMap.get(c.produitId);
    return sum + (p ? p.prixVente * c.quantite : 0);
  }, 0);
}

export function creerVentePack(
  pack: Pack,
  produitsMap: Map<string, Produit>,
  credit?: { clientNom: string; clientTel?: string; montantRecu: number }
): Omit<Vente, 'id'> {
  const sumPrixAchat = prixAchatPack(pack, produitsMap);
  const now = Date.now();
  return {
    produitId: pack.id,
    produitNom: pack.nom,
    quantite: 1,
    prixVente: pack.prixVente,
    prixAchat: sumPrixAchat,
    total: pack.prixVente,
    benefice: pack.prixVente - sumPrixAchat,
    date: now,
    updatedAt: now,
    type: 'pack',
    ...(credit
      ? { modeReglement: 'credit', clientNom: credit.clientNom, clientTel: credit.clientTel, montantRecu: credit.montantRecu }
      : { modeReglement: 'comptant' }),
  };
}
```

- [ ] **Step 2 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Résultat attendu : aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/backend/packs.ts
git commit -m "feat: logique metier packs (valider, calculer, creerVentePack)"
```

---

## Task 3 : Hook usePacks

**Files:**
- Create: `frontend/lib/hooks/usePacks.ts`

**Interfaces:**
- Consumes: `db.packs`, `validerPack`, `Pack`
- Produces: `usePacks()` → `{ packs, ajouterPack, modifierPack, supprimerPack }`

---

- [ ] **Step 1 : Créer `frontend/lib/hooks/usePacks.ts`**

```typescript
'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerPack } from '@backend/packs';
import { requestSync } from '../syncController';
import type { Pack } from '@backend/types';

export function usePacks() {
  const packs = useLiveQuery(
    () => db.packs.orderBy('nom').filter((p) => !p.deleted).toArray()
  ) ?? [];

  async function ajouterPack(
    data: Omit<Pack, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> {
    const erreur = validerPack(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.packs.add({
      ...data,
      id: genId(),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });
    requestSync();
    return null;
  }

  async function modifierPack(
    id: string,
    data: Partial<Omit<Pack, 'id' | 'createdAt'>>
  ): Promise<string | null> {
    const erreur = validerPack(data);
    if (erreur) return erreur;
    await db.packs.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerPack(id: string) {
    await db.packs.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  return { packs, ajouterPack, modifierPack, supprimerPack };
}
```

- [ ] **Step 2 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/hooks/usePacks.ts
git commit -m "feat: hook usePacks (CRUD packs Dexie)"
```

---

## Task 4 : Sync Supabase — table packs

**Files:**
- Modify: `frontend/lib/sync.ts`

**Interfaces:**
- Consumes: `db.packs`, `Pack` type
- Produces: pull/push des packs intégrés dans `fullSync()`

---

- [ ] **Step 1 : Ajouter l'import Pack dans sync.ts**

Ligne 5 de `frontend/lib/sync.ts`, ajouter `Pack` à l'import :

```typescript
import type { Produit, Vente, Config, Pack } from '@backend/types';
```

- [ ] **Step 2 : Ajouter le type PackRow après ConfigRow (ligne ~71)**

```typescript
type PackRow = {
  id: string;
  user_id: string;
  nom: string;
  composants: Array<{ produit_id: string; produit_nom: string; quantite: number }>;
  prix_vente: number;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};
```

- [ ] **Step 3 : Ajouter les deux mappers après `rowToConfig` (ligne ~179)**

```typescript
function packToRow(p: Pack, userId: string): PackRow {
  return {
    id: p.id,
    user_id: userId,
    nom: p.nom,
    composants: p.composants.map((c) => ({
      produit_id: c.produitId,
      produit_nom: c.produitNom,
      quantite: c.quantite,
    })),
    prix_vente: p.prixVente,
    created_at: p.createdAt ?? Date.now(),
    updated_at: p.updatedAt ?? Date.now(),
    deleted: p.deleted ?? false,
  };
}

function rowToPack(r: PackRow): Pack {
  const composants = Array.isArray(r.composants) ? r.composants : [];
  return {
    id: r.id,
    nom: r.nom,
    composants: composants.map((c) => ({
      produitId: c.produit_id,
      produitNom: c.produit_nom,
      quantite: Number(c.quantite),
    })),
    prixVente: Number(r.prix_vente),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}
```

- [ ] **Step 4 : Ajouter le pull des packs dans la fonction `pull()`**

Dans la fonction `pull()`, après le bloc `// --- config ---` (avant la dernière accolade de `pull`) :

```typescript
  // --- packs ---
  const { data: packsRows, error: pkErr } = await supabase
    .from('packs')
    .select('*')
    .eq('user_id', userId);
  if (pkErr) throw pkErr;

  for (const row of (packsRows ?? []) as PackRow[]) {
    const remote = rowToPack(row);
    const local = await db.packs.get(remote.id);
    if (!local || remote.updatedAt > (local.updatedAt ?? 0)) {
      await db.packs.put(remote);
    }
  }
```

- [ ] **Step 5 : Ajouter le push des packs dans la fonction `push()`**

Dans la fonction `push()`, après le bloc `// --- config ---` (avant la dernière accolade de `push`) :

```typescript
  // --- packs ---
  const packs = await db.packs.toArray();
  if (packs.length > 0) {
    const rows = packs.map((p) => packToRow(p, userId));
    const { error } = await supabase.from('packs').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }
```

- [ ] **Step 6 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

- [ ] **Step 7 : Commit**

```bash
git add frontend/lib/sync.ts
git commit -m "feat: sync Supabase bidirectionnelle pour les packs"
```

---

## Task 5 : Migration SQL Supabase

**Files:**
- Aucun fichier modifié — à exécuter dans le dashboard Supabase (SQL Editor)

---

- [ ] **Step 1 : Ouvrir le SQL Editor de Supabase**

Aller sur [supabase.com](https://supabase.com) → projet MargoPro → SQL Editor → New query.

- [ ] **Step 2 : Exécuter ce SQL**

```sql
-- Table packs
CREATE TABLE IF NOT EXISTS packs (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL,
  composants jsonb NOT NULL DEFAULT '[]'::jsonb,
  prix_vente numeric NOT NULL DEFAULT 0,
  created_at bigint NOT NULL DEFAULT 0,
  updated_at bigint NOT NULL DEFAULT 0,
  deleted boolean NOT NULL DEFAULT false
);

-- Index pour les requêtes par user
CREATE INDEX IF NOT EXISTS packs_user_id_idx ON packs(user_id);

-- RLS : chaque utilisateur ne voit que ses packs
ALTER TABLE packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packs_own" ON packs
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

- [ ] **Step 3 : Vérifier la table**

Dans Table Editor de Supabase, vérifier que la table `packs` apparaît avec les colonnes : `id`, `user_id`, `nom`, `composants`, `prix_vente`, `created_at`, `updated_at`, `deleted`.

---

## Task 6 : UI Stock — onglet Packs

**Files:**
- Modify: `frontend/app/stock/page.tsx`

**Interfaces:**
- Consumes: `usePacks()`, `usePlan()`, `ModalUpgrade`, `Pack` type, `prixAchatPack`, `prixVenteSepares`
- Produces: 3e onglet "Packs" dans le sélecteur Stock, liste + création + édition de packs

---

- [ ] **Step 1 : Ajouter les imports nécessaires en haut de stock/page.tsx**

Après l'import `usePlan` existant, ajouter :

```typescript
import { usePacks } from '@/lib/hooks/usePacks';
import { prixAchatPack, prixVenteSepares } from '@backend/packs';
import type { Pack } from '@backend/types';
```

- [ ] **Step 2 : Ajouter les états packs dans le composant `StockPage`**

Après la ligne `const [showUpgradeModal, setShowUpgradeModal] = useState(false);`, ajouter :

```typescript
  const { packs, ajouterPack, modifierPack, supprimerPack } = usePacks();
  const [packEnEdition, setPackEnEdition] = useState<Pack | null>(null);
  const [showFormPack, setShowFormPack] = useState(false);
  const [champsPack, setChampsPack] = useState({ nom: '', prixVente: '' });
  const [composantsPack, setComposantsPack] = useState<Array<{ produitId: string; produitNom: string; quantite: number }>>([]);
  const [erreurPack, setErreurPack] = useState('');
  const [packASupprimer, setPackASupprimer] = useState<Pack | null>(null);
  const [showPickerProduit, setShowPickerProduit] = useState(false);
```

- [ ] **Step 3 : Modifier le type du sélecteur vueStock**

Ligne ~131 de stock/page.tsx, changer :

```typescript
  const [vueStock, setVueStock] = useState<'produits' | 'mort'>('produits');
```

En :

```typescript
  const [vueStock, setVueStock] = useState<'produits' | 'packs' | 'mort'>('produits');
```

- [ ] **Step 4 : Ajouter les handlers packs après les handlers produits existants**

Après la fonction `annulerSuppression()`, ajouter :

```typescript
  function ouvrirEditerPack(pack: Pack) {
    setPackEnEdition(pack);
    setChampsPack({ nom: pack.nom, prixVente: String(pack.prixVente) });
    setComposantsPack([...pack.composants]);
    setErreurPack('');
  }

  function ouvrirCreerPack() {
    setPackEnEdition(null);
    setChampsPack({ nom: '', prixVente: '' });
    setComposantsPack([]);
    setErreurPack('');
    setShowFormPack(true);
  }

  async function handleSauvegarderPack() {
    setErreurPack('');
    const data = {
      nom: champsPack.nom.trim(),
      composants: composantsPack,
      prixVente: Number(champsPack.prixVente),
    };
    if (packEnEdition) {
      const err = await modifierPack(packEnEdition.id, data);
      if (err) { setErreurPack(err); return; }
      setPackEnEdition(null);
    } else {
      const err = await ajouterPack(data);
      if (err) { setErreurPack(err); return; }
      setShowFormPack(false);
    }
    setChampsPack({ nom: '', prixVente: '' });
    setComposantsPack([]);
  }

  function retirerComposant(produitId: string) {
    setComposantsPack(cs => cs.filter(c => c.produitId !== produitId));
  }

  function ajouterComposant(produit: { id: string; nom: string }) {
    setComposantsPack(cs => {
      const existe = cs.find(c => c.produitId === produit.id);
      if (existe) return cs.map(c => c.produitId === produit.id ? { ...c, quantite: c.quantite + 1 } : c);
      return [...cs, { produitId: produit.id, produitNom: produit.nom, quantite: 1 }];
    });
    setShowPickerProduit(false);
  }
```

- [ ] **Step 5 : Modifier le sélecteur 2-onglets en 3-onglets**

Trouver le bloc du sélecteur (ligne ~780) qui contient `'produits'` et `'mort'`, et le remplacer par :

```tsx
      {/* SÉLECTEUR Mes produits / Packs / Stock mort */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ display: 'flex', background: T.bgSubtle, borderRadius: 12, padding: 3, gap: 2 }}>
          {([
            { v: 'produits' as const, label: 'Mes produits' },
            { v: 'packs' as const, label: 'Packs' },
            { v: 'mort' as const, label: 'Stock mort' },
          ]).map(({ v, label }) => (
            <button key={v} onClick={() => setVueStock(v)}
              style={{ flex: 1, height: 36, border: 'none', cursor: 'pointer', borderRadius: 10, fontSize: 12,
                fontWeight: vueStock === v ? 700 : 500,
                color: vueStock === v ? T.text : T.textMuted,
                background: vueStock === v ? T.surface : 'transparent',
                boxShadow: vueStock === v ? T.shadow : 'none', fontFamily: 'Manrope, sans-serif' }}>
              {label}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 6 : Ajouter la vue Packs entre la vue produits et la vue stock mort**

Juste avant `{/* VUE STOCK MORT */}` (ligne ~999), insérer le bloc JSX complet de la vue packs :

```tsx
      {/* VUE PACKS */}
      {vueStock === 'packs' && (
        <div style={{ padding: '0 16px' }}>

          {/* Bouton Créer un pack */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => { if (!plan.isPremium) { setShowUpgradeModal(true); return; } ouvrirCreerPack(); }}
              style={{ width: '100%', height: 48, borderRadius: 14, background: plan.isPremium ? T.accent : '#D1D5DB', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {!plan.isPremium && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="white" strokeWidth="1.75"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="white" strokeWidth="1.75" strokeLinecap="round"/></svg>
              )}
              {!plan.isPremium ? 'Premium — Créer un pack' : '+ Créer un pack'}
            </button>
          </div>

          {/* Formulaire création */}
          {showFormPack && (
            <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 14 }}>Nouveau pack</div>
              {erreurPack && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>{erreurPack}</div>}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du pack</label>
                <input type="text" value={champsPack.nom} onChange={e => setChampsPack(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Pack Duo Propre"
                  style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Produits du pack</label>
                {composantsPack.map(c => (
                  <div key={c.produitId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: T.bgSubtle, borderRadius: 10, padding: '8px 10px' }}>
                    <span style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: 600 }}>{c.produitNom}</span>
                    <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))}
                      style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text, minWidth: 20, textAlign: 'center', fontFamily: '"Space Grotesk", sans-serif' }}>{c.quantite}</span>
                    <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: x.quantite + 1 } : x))}
                      style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    <button type="button" onClick={() => retirerComposant(c.produitId)}
                      style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: T.redBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={T.red} strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setShowPickerProduit(true)}
                  style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px dashed ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.accent, fontFamily: 'Manrope, sans-serif' }}>
                  + Ajouter un produit
                </button>
              </div>
              <div style={{ marginBottom: (() => {
                const produitsMap = new Map(produits.map(p => [p.id, p]));
                const fakePack = { composants: composantsPack, prixVente: Number(champsPack.prixVente) } as Pack;
                return prixVenteSepares(fakePack, produitsMap) > 0 ? 4 : 14;
              })() }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Prix de vente du pack ({symbole})</label>
                <input type="number" value={champsPack.prixVente} onChange={e => setChampsPack(c => ({ ...c, prixVente: e.target.value }))} placeholder="0" min="0"
                  style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              </div>
              {(() => {
                if (composantsPack.length === 0 || !champsPack.prixVente) return null;
                const produitsMap = new Map(produits.map(p => [p.id, p]));
                const fakePack = { composants: composantsPack, prixVente: Number(champsPack.prixVente) } as Pack;
                const separes = prixVenteSepares(fakePack, produitsMap);
                const achat = prixAchatPack(fakePack, produitsMap);
                const beneficeNet = Number(champsPack.prixVente) - achat;
                const remise = separes > 0 ? Math.round((1 - Number(champsPack.prixVente) / separes) * 100) : 0;
                return (
                  <div style={{ marginBottom: 14, padding: '10px 12px', background: T.bgSubtle, borderRadius: 10, fontSize: 12, color: T.textSub }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>Prix séparés</span><span style={{ fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: T.text }}>{Math.round(separes).toLocaleString()} {symbole}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span>Remise perçue</span><span style={{ fontWeight: 700, color: remise > 0 ? T.accent : T.red }}>{remise > 0 ? `−${remise}%` : `+${Math.abs(remise)}%`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Bénéfice net</span><span style={{ fontWeight: 700, color: beneficeNet >= 0 ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif' }}>{beneficeNet >= 0 ? '+' : ''}{Math.round(beneficeNet).toLocaleString()} {symbole}</span>
                    </div>
                    {remise <= 0 && <div style={{ marginTop: 6, fontSize: 11, color: T.orange ?? '#F97316', fontWeight: 600 }}>Le client ne voit pas de bonne affaire — baisse le prix du pack</div>}
                  </div>
                );
              })()}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowFormPack(false); setErreurPack(''); }} style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>Annuler</button>
                <button onClick={handleSauvegarderPack} style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>Créer le pack</button>
              </div>
            </div>
          )}

          {/* Liste des packs */}
          {packs.length === 0 && !showFormPack ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.textMuted} strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 8v4M12 16h.01" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>Aucun pack pour l&apos;instant</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Crée un pack pour liquider ton stock mort</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {packs.map(pack => {
                const produitsMap = new Map(produits.map(p => [p.id, p]));
                const achat = prixAchatPack(pack, produitsMap);
                const beneficeNet = pack.prixVente - achat;
                return (
                  <div key={pack.id} onClick={() => ouvrirEditerPack(pack)} style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.accent} strokeWidth="1.75" strokeLinejoin="round"/>
                        <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pack.nom}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{pack.composants.length} produit{pack.composants.length > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{Math.round(pack.prixVente).toLocaleString()} {symbole}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: beneficeNet >= 0 ? T.green : T.red }}>{beneficeNet >= 0 ? '+' : ''}{Math.round(beneficeNet).toLocaleString()} {symbole}</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 7 : Ajouter le bottom sheet d'édition de pack**

Juste avant `{/* HEADER */}` (ligne ~748), ajouter le bottom sheet :

```tsx
      {/* BOTTOM SHEET ÉDITION PACK */}
      {packEnEdition && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setPackEnEdition(null)}>
          <div style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px', maxHeight: '90dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 16 }}>Modifier le pack</div>
            {erreurPack && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>{erreurPack}</div>}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du pack</label>
              <input type="text" value={champsPack.nom} onChange={e => setChampsPack(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Pack Duo Propre"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Produits du pack</label>
              {composantsPack.map(c => (
                <div key={c.produitId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: T.bgSubtle, borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: 600 }}>{c.produitNom}</span>
                  <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))}
                    style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text, minWidth: 20, textAlign: 'center', fontFamily: '"Space Grotesk", sans-serif' }}>{c.quantite}</span>
                  <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: x.quantite + 1 } : x))}
                    style={{ width: 28, height: 28, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <button type="button" onClick={() => retirerComposant(c.produitId)}
                    style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: T.redBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={T.red} strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setShowPickerProduit(true)}
                style={{ width: '100%', height: 40, borderRadius: 10, border: `1.5px dashed ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.accent, fontFamily: 'Manrope, sans-serif' }}>
                + Ajouter un produit
              </button>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Prix de vente ({symbole})</label>
              <input type="number" value={champsPack.prixVente} onChange={e => setChampsPack(c => ({ ...c, prixVente: e.target.value }))} placeholder="0" min="0"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={() => setPackEnEdition(null)} style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>Annuler</button>
              <button onClick={handleSauvegarderPack} style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>Enregistrer</button>
            </div>
            <button onClick={() => { const p = packEnEdition; setPackEnEdition(null); setPackASupprimer(p); }}
              style={{ width: '100%', height: 44, borderRadius: 12, background: 'transparent', border: `1.5px solid ${T.redBg}`, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif' }}>
              Supprimer ce pack
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 8 : Ajouter le picker de produits et la confirmation suppression pack**

Juste après le bottom sheet d'édition pack (avant `{/* HEADER */}`), ajouter :

```tsx
      {/* PICKER PRODUIT pour les packs */}
      {showPickerProduit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 220, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowPickerProduit(false)}>
          <div style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px', maxHeight: '70dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 12 }}>Choisir un produit</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {produits.filter(p => !composantsPack.find(c => c.produitId === p.id)).map(p => (
                <button key={p.id} onClick={() => ajouterComposant({ id: p.id, nom: p.nom })}
                  style={{ width: '100%', textAlign: 'left', background: T.bgSubtle, borderRadius: 12, padding: '12px 14px', border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{p.nom}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{p.quantite} unités · {Math.round(p.prixVente).toLocaleString()} {symbole}</div>
                </button>
              ))}
              {produits.filter(p => !composantsPack.find(c => c.produitId === p.id)).length === 0 && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 14 }}>Tous les produits sont déjà dans le pack</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUPPRESSION PACK */}
      {packASupprimer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPackASupprimer(null)}>
          <div style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 340, padding: 22 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, textAlign: 'center', marginBottom: 6 }}>Supprimer ce pack ?</div>
            <div style={{ fontSize: 14, color: T.textSub, textAlign: 'center', marginBottom: 20 }}>«&nbsp;<strong>{packASupprimer.nom}</strong>&nbsp;» sera supprimé. Les produits ne sont pas affectés.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPackASupprimer(null)} style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>Annuler</button>
              <button onClick={() => { supprimerPack(packASupprimer.id); setPackASupprimer(null); }} style={{ flex: 1, height: 46, borderRadius: 12, background: T.red, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>Supprimer</button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 9 : Vérifier les types et builder**

```bash
cd frontend && npm run type-check
```

Résultat attendu : aucune erreur. Si erreur sur `T.orange`, remplacer par `'#F97316'` (couleur hardcodée acceptable pour ce cas).

- [ ] **Step 10 : Lancer le serveur et tester manuellement**

```bash
cd frontend && npm run dev
```

Vérifier :
- Onglet Stock : 3 onglets visibles "Mes produits", "Packs", "Stock mort"
- Onglet Packs : état vide s'affiche correctement
- Bouton "Créer un pack" : ouvre le formulaire (si Premium) ou modal upgrade (sinon)
- Formulaire : ajout de produits, quantité +/−, indicateur bénéfice temps réel
- Créer un pack → il apparaît dans la liste
- Taper un pack → bottom sheet édition s'ouvre
- Supprimer un pack → disparaît de la liste

- [ ] **Step 11 : Commit**

```bash
git add frontend/app/stock/page.tsx
git commit -m "feat: onglet Packs dans Stock (creation, edition, suppression)"
```

---

## Task 7 : UI Ventes — toggle Produit / Pack

**Files:**
- Modify: `frontend/app/ventes/page.tsx`
- Modify: `frontend/lib/hooks/useVentes.ts`

**Interfaces:**
- Consumes: `usePacks()`, `creerVentePack()`, `prixAchatPack()`, `db.produits`, `db.packs`
- Produces: toggle Produit/Pack dans Nouvelle vente, vente de pack avec décrémentation des stocks composants

---

- [ ] **Step 1 : Ajouter la gestion packs dans supprimerVente et restaurerVente (useVentes.ts)**

Ouvrir `frontend/lib/hooks/useVentes.ts`. Dans `supprimerVente`, remplacer le bloc de restauration du stock :

```typescript
  async function supprimerVente(id: string) {
    const vente = await db.ventes.get(id);
    if (!vente) return;
    await db.ventes.update(id, { deleted: true, updatedAt: Date.now() });

    if (vente.type === 'pack') {
      // Restaurer le stock de chaque composant du pack
      const pack = await db.packs.get(vente.produitId);
      if (pack) {
        for (const c of pack.composants) {
          const produit = await db.produits.get(c.produitId);
          if (produit) {
            await db.produits.update(c.produitId, {
              quantite: produit.quantite + c.quantite,
              updatedAt: Date.now(),
            });
          }
        }
      }
    } else {
      const produit = await db.produits.get(vente.produitId);
      if (produit) {
        await db.produits.update(vente.produitId, {
          quantite: produit.quantite + vente.quantite,
          updatedAt: Date.now(),
        });
      }
    }
    requestSync();
  }
```

Dans `restaurerVente`, remplacer le bloc de redéduction du stock :

```typescript
  async function restaurerVente(id: string) {
    const vente = await db.ventes.get(id);
    if (!vente) return;
    await db.ventes.update(id, { deleted: false, updatedAt: Date.now() });

    if (vente.type === 'pack') {
      // Re-déduire le stock de chaque composant
      const pack = await db.packs.get(vente.produitId);
      if (pack) {
        for (const c of pack.composants) {
          const produit = await db.produits.get(c.produitId);
          if (produit) {
            await db.produits.update(c.produitId, {
              quantite: Math.max(0, produit.quantite - c.quantite),
              updatedAt: Date.now(),
            });
          }
        }
      }
    } else {
      const produit = await db.produits.get(vente.produitId);
      if (produit) {
        await db.produits.update(vente.produitId, {
          quantite: Math.max(0, produit.quantite - vente.quantite),
          updatedAt: Date.now(),
        });
      }
    }
    requestSync();
  }
```

- [ ] **Step 2 : Ajouter enregistrerVentePack dans useVentes.ts**

Ajouter ces imports en haut de `useVentes.ts` :

```typescript
import { creerVentePack } from '@backend/packs';
import type { Pack } from '@backend/types';
```

Ajouter la fonction après `enregistrerVente` :

```typescript
  async function enregistrerVentePack(
    pack: Pack,
    credit?: { clientNom: string; clientTel?: string; montantRecu: number }
  ) {
    // Lire les produits actuels pour calculer le prixAchat
    const produitsArray = await db.produits.toArray();
    const produitsMap = new Map(produitsArray.map(p => [p.id, p]));

    // Vérifier le stock de chaque composant
    for (const c of pack.composants) {
      const p = produitsMap.get(c.produitId);
      if (!p || p.quantite < c.quantite) {
        return `Stock insuffisant pour "${c.produitNom}" (${p?.quantite ?? 0} disponible${(p?.quantite ?? 0) > 1 ? 's' : ''}, ${c.quantite} demandé${c.quantite > 1 ? 's' : ''})`;
      }
    }

    // Décrémenter le stock de chaque composant
    const now = Date.now();
    for (const c of pack.composants) {
      const p = produitsMap.get(c.produitId)!;
      await db.produits.update(c.produitId, {
        quantite: p.quantite - c.quantite,
        updatedAt: now,
      });
    }

    // Enregistrer la vente
    const vente = creerVentePack(pack, produitsMap, credit);
    await db.ventes.add({ ...vente, id: genId(), deleted: false });
    requestSync();
    return null;
  }
```

Ajouter `enregistrerVentePack` dans le return de `useVentes` :

```typescript
  return { ventes, ventesSupprimees, stats, top3, credits, soldes, totalDu, enregistrerVente, enregistrerVentePack, enregistrerPaiementCredit, supprimerVente, restaurerVente };
```

- [ ] **Step 3 : Ajouter les imports dans ventes/page.tsx**

Ouvrir `frontend/app/ventes/page.tsx`. Ajouter l'import suivant avec les autres imports :

```typescript
import { usePacks } from '@/lib/hooks/usePacks';
```

- [ ] **Step 4 : Ajouter l'état modeProduit et pack sélectionné dans le composant Ventes**

Trouver les déclarations `useState` en haut du composant. Ajouter après les états crédit existants :

```typescript
  const [modeProduit, setModeProduit] = useState<'produit' | 'pack'>('produit');
  const [packSelectionne, setPackSelectionne] = useState<string>('');
  const { packs } = usePacks();
```

- [ ] **Step 5 : Ajouter le reset modeProduit à la fermeture du formulaire**

Trouver toutes les fonctions qui ferment/réinitialisent le formulaire de vente (quand `setShowForm(false)` est appelé). Ajouter `setModeProduit('produit'); setPackSelectionne('');` dans chacune.

- [ ] **Step 6 : Ajouter le toggle Produit/Pack dans le JSX du formulaire Nouvelle vente**

Dans `ventes/page.tsx`, trouver la section du formulaire de nouvelle vente (là où le sélecteur de produit est affiché). Juste **avant** le sélecteur de produit existant, insérer :

```tsx
              {/* Toggle Produit / Pack */}
              <div style={{ display: 'flex', background: T.bgSubtle, borderRadius: 10, padding: 3, gap: 2, marginBottom: 12 }}>
                {([
                  { v: 'produit' as const, label: 'Produit' },
                  { v: 'pack' as const, label: 'Pack' },
                ]).map(({ v, label }) => (
                  <button key={v} onClick={() => { setModeProduit(v); setPackSelectionne(''); }}
                    style={{ flex: 1, height: 34, border: 'none', cursor: 'pointer', borderRadius: 8, fontSize: 13, fontWeight: modeProduit === v ? 700 : 500, color: modeProduit === v ? T.text : T.textMuted, background: modeProduit === v ? T.surface : 'transparent', boxShadow: modeProduit === v ? T.shadow : 'none', fontFamily: 'Manrope, sans-serif' }}>
                    {label}
                  </button>
                ))}
              </div>
```

- [ ] **Step 7 : Conditionner l'affichage du sélecteur produit existant**

Entourer le sélecteur de produit existant avec `{modeProduit === 'produit' && ( ... )}`.

- [ ] **Step 8 : Ajouter le sélecteur de pack (affiché si modeProduit === 'pack')**

Juste après le sélecteur produit conditionnel, ajouter :

```tsx
              {/* Sélecteur Pack */}
              {modeProduit === 'pack' && (
                <div style={{ marginBottom: 12 }}>
                  {packs.length === 0 ? (
                    <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: T.textMuted }}>
                      Aucun pack créé — va dans Stock → Packs pour en créer un.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {packs.map(pack => (
                        <button key={pack.id} onClick={() => setPackSelectionne(packSelectionne === pack.id ? '' : pack.id)}
                          style={{ width: '100%', textAlign: 'left', background: packSelectionne === pack.id ? T.accentLight : T.bgSubtle, borderRadius: 12, padding: '12px 14px', border: `1.5px solid ${packSelectionne === pack.id ? T.accent : 'transparent'}`, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{pack.nom}</div>
                          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
                            {pack.composants.map(c => `${c.produitNom} ×${c.quantite}`).join(' + ')} · {Math.round(pack.prixVente).toLocaleString()} {symbole}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 9 : Connecter le bouton de confirmation pour les ventes pack**

Trouver la fonction de confirmation de vente (handleConfirmerVente ou équivalent). Ajouter en début de cette fonction :

```typescript
    // Vente de pack
    if (modeProduit === 'pack') {
      const pack = packs.find(p => p.id === packSelectionne);
      if (!pack) return;
      const erreur = await enregistrerVentePack(
        pack,
        modeReglement === 'credit' ? { clientNom: clientNomCredit, clientTel: clientTelCredit, montantRecu: Number(acompteCredit) } : undefined
      );
      if (erreur) { /* afficher erreur */ setErreurVente(erreur); return; }
      // Reset
      setPackSelectionne('');
      setModeProduit('produit');
      setShowForm(false);
      return;
    }
```

Note : le nom exact des états (`modeReglement`, `clientNomCredit`, `clientTelCredit`, `acompteCredit`, `setErreurVente`, `setShowForm`) peut varier — adapter selon le code existant de `ventes/page.tsx`.

Également désactiver le bouton de confirmation si `modeProduit === 'pack' && !packSelectionne` (comme c'est déjà le cas si aucun produit n'est sélectionné en mode produit).

- [ ] **Step 10 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

- [ ] **Step 11 : Tester manuellement**

```bash
cd frontend && npm run dev
```

Scénario de test complet :
1. Créer 2 produits (ex: Lessive 10 en stock, Savon 5 en stock)
2. Stock → Packs → Créer un pack "Pack Duo" = Lessive ×1 + Savon ×2 → Prix 1400 FCFA
3. Ventes → Nouvelle vente → onglet Pack → sélectionner "Pack Duo" → Confirmer
4. Vérifier dans Stock : Lessive = 9, Savon = 3
5. Vérifier dans l'historique Ventes : "Pack Duo — 1400 FCFA" présent
6. Supprimer la vente → Lessive = 10, Savon = 5 (stock restauré)

- [ ] **Step 12 : Commit**

```bash
git add frontend/app/ventes/page.tsx frontend/lib/hooks/useVentes.ts
git commit -m "feat: vente de packs dans onglet Ventes (toggle Produit/Pack)"
```

---

## Task 8 : Push git + vérification déploiement

- [ ] **Step 1 : Vérifier le build de production**

```bash
cd frontend && npm run build
```

Résultat attendu : build réussi, aucune erreur TypeScript ni erreur de build Next.js.

- [ ] **Step 2 : Push vers GitHub (déclenche Vercel)**

```bash
git push origin main
```

- [ ] **Step 3 : Vérifier le déploiement Vercel**

Aller sur [vercel.com](https://vercel.com) dans le projet `margo-pro` (johariinter-web). Attendre que le déploiement passe au vert (environ 2-3 minutes).

- [ ] **Step 4 : Tester sur mobile**

Ouvrir `margopro.eidma.co` sur le téléphone. Tester le parcours complet :
- Stock → onglet Packs → créer un pack
- Ventes → toggle Pack → vendre le pack
- Vérifier les stocks mis à jour
