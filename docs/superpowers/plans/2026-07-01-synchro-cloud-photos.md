# Synchronisation cloud des photos — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Synchroniser les photos de produits entre appareils via Supabase Storage, en greffant une couche photos sur la sync bidirectionnelle existante (`fullSync`).

**Architecture:** Chaque photo vit dans un bucket Supabase Storage privé `product-photos` au chemin `{userId}/{produitId}/{version}.jpg`. Un nouveau champ `photo_path` (colonne SQL) transporte ce chemin lors de la sync ; le corps de l'image (base64) n'entre jamais dans la table produits. Côté local (Dexie), un champ `photoPath` indique si la photo est déjà synchronisée — `null` ou absent signifie « à uploader ».

**Tech Stack:** Supabase Storage SDK (`@supabase/supabase-js` déjà installé), Dexie.js (schéma inchangé), Vitest (à installer) pour les tests des fonctions pures.

## Global Constraints

- Offline-first : un échec d'upload ou download ne doit jamais bloquer la sync des données (try/catch par photo).
- Aucune migration Dexie : `photoPath` est un champ non-indexé, pas besoin de bumper la version du schéma.
- L'UI ne change pas : `produit.photo` (base64) reste la source unique pour l'affichage.
- Barrière Premium : `peutSyncerPhotos()` retourne `true` pour tous pendant la bêta ; un seul point de contrôle.
- Textes français partout, pas de jargon.
- Commandes depuis `frontend/` : `npm run dev`, `npm run type-check`, `npm test`.

---

## Fichiers créés / modifiés

| Fichier | Action | Rôle |
|---|---|---|
| `frontend/backend/types.ts` | Modifié | Ajoute `photoPath?: string \| null` à `Produit` |
| `frontend/lib/sync.ts` | Modifié | `ProduitRow` + mappers + push photos + pull photos |
| `frontend/lib/photoSync.ts` | Créé | Fonctions storage + helpers purs + barrière Premium |
| `frontend/lib/__tests__/photoSync.test.ts` | Créé | Tests unitaires des fonctions pures |
| `frontend/vitest.config.ts` | Créé | Config Vitest avec alias `@backend` |
| `frontend/package.json` | Modifié | Ajoute `vitest` en devDependency + script `test` |
| `frontend/app/stock/page.tsx` | Modifié | Marque `photoPath = null` quand la photo change |

---

## Task 1 : Setup Supabase (bucket, RLS, colonne SQL)

**Files:** Aucun fichier code — étapes manuelles dans le dashboard Supabase.

**Interfaces:** Produit — Consomme : rien. Produit — Fournit : bucket `product-photos` accessible par SDK, colonne `photo_path` sur la table `produits`.

- [ ] **Étape 1 : Créer le bucket `product-photos`**

Dans le dashboard Supabase → Storage → New bucket :
- Name : `product-photos`
- Public : **désactivé** (bucket privé)

OU via SQL Editor :
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-photos', 'product-photos', false)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Étape 2 : Ajouter les politiques RLS Storage**

Dans SQL Editor :
```sql
-- Lecture : uniquement son propre dossier
CREATE POLICY "photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'product-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Upload (INSERT)
CREATE POLICY "photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Remplacement (UPDATE)
CREATE POLICY "photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Suppression
CREATE POLICY "photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

- [ ] **Étape 3 : Ajouter la colonne `photo_path` sur la table `produits`**

```sql
ALTER TABLE produits
  ADD COLUMN IF NOT EXISTS photo_path text;
```

- [ ] **Étape 4 : Vérifier**

Dans SQL Editor :
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'produits' AND column_name = 'photo_path';
```
Doit retourner une ligne.

- [ ] **Étape 5 : Commit (documentation du setup)**

```bash
git add -A
git commit -m "chore: ajout bucket product-photos + colonne photo_path (setup Supabase)"
```

---

## Task 2 : Vitest + Mise à jour des types

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/backend/types.ts`
- Modify: `frontend/lib/sync.ts` (ProduitRow + mappers uniquement)

**Interfaces:**
- Consomme : type `Produit` existant, type `ProduitRow` interne à `sync.ts`
- Fournit : `Produit.photoPath?: string | null`, `ProduitRow.photo_path: string | null`

- [ ] **Étape 1 : Installer Vitest**

```bash
cd frontend && npm install -D vitest
```

- [ ] **Étape 2 : Créer `vitest.config.ts`**

```typescript
// frontend/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@backend': path.resolve(__dirname, './backend'),
    },
  },
});
```

- [ ] **Étape 3 : Ajouter le script `test` dans `package.json`**

Dans `frontend/package.json`, ajouter dans `"scripts"` :
```json
"test": "vitest run"
```

- [ ] **Étape 4 : Ajouter `photoPath` au type `Produit`**

Dans `frontend/backend/types.ts`, modifier l'interface `Produit` :
```typescript
export interface Produit {
  id: string;
  nom: string;
  quantite: number;
  prixAchat: number;
  prixVente: number;
  seuilAlerte: number;
  codeBarres?: string;
  categorie?: string;
  tailleConditionnement?: number;
  photo?: string;       // base64 local, pour l'affichage hors-ligne
  photoPath?: string | null; // chemin Supabase Storage ; null = à synchroniser
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

- [ ] **Étape 5 : Mettre à jour `ProduitRow` dans `sync.ts`**

Dans `frontend/lib/sync.ts`, ajouter `photo_path` à `ProduitRow` :
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
  photo_path: string | null;   // ← nouveau
  created_at: number;
  updated_at: number;
  deleted: boolean;
};
```

- [ ] **Étape 6 : Mettre à jour `produitToRow` dans `sync.ts`**

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
    photo_path: p.photoPath ?? null,   // ← nouveau
    created_at: p.createdAt ?? Date.now(),
    updated_at: p.updatedAt ?? Date.now(),
    deleted: p.deleted ?? false,
  };
}
```

- [ ] **Étape 7 : Mettre à jour `rowToProduit` dans `sync.ts`**

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
    photoPath: r.photo_path ?? undefined,   // ← nouveau
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}
```

- [ ] **Étape 8 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Attendu : aucune erreur.

- [ ] **Étape 9 : Commit**

```bash
git add frontend/package.json frontend/vitest.config.ts frontend/backend/types.ts frontend/lib/sync.ts
git commit -m "feat: ajoute photoPath au type Produit et photo_path dans ProduitRow"
```

---

## Task 3 : Module `photoSync.ts` + tests unitaires

**Files:**
- Create: `frontend/lib/photoSync.ts`
- Create: `frontend/lib/__tests__/photoSync.test.ts`

**Interfaces:**
- Consomme : `SupabaseClient` de `@supabase/supabase-js`, `Produit` de `@backend/types`
- Fournit :
  - `cheminPhoto(userId: string, produitId: string, version: number): string`
  - `peutSyncerPhotos(): boolean`
  - `uploadPhoto(supabase, userId, produit): Promise<string>` — retourne le chemin stocké
  - `downloadPhoto(supabase, chemin): Promise<string>` — retourne base64
  - `supprimerPhoto(supabase, chemin): Promise<void>`

- [ ] **Étape 1 : Écrire le test qui va échouer**

Créer `frontend/lib/__tests__/photoSync.test.ts` :
```typescript
import { describe, test, expect } from 'vitest';
import { cheminPhoto, peutSyncerPhotos } from '../photoSync';

describe('cheminPhoto', () => {
  test('construit le chemin userId/produitId/version.jpg', () => {
    expect(cheminPhoto('user1', 'prod1', 1234)).toBe('user1/prod1/1234.jpg');
  });

  test('préserve les valeurs exactes (tirets, chiffres)', () => {
    expect(cheminPhoto('abc-123', 'xyz-456', 0)).toBe('abc-123/xyz-456/0.jpg');
  });
});

describe('peutSyncerPhotos', () => {
  test('retourne true en bêta', () => {
    expect(peutSyncerPhotos()).toBe(true);
  });
});
```

- [ ] **Étape 2 : Lancer le test pour vérifier qu'il échoue**

```bash
cd frontend && npm test
```

Attendu : FAIL — `Cannot find module '../photoSync'`

- [ ] **Étape 3 : Créer `frontend/lib/photoSync.ts`**

```typescript
'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Produit } from '@backend/types';

const BUCKET = 'product-photos';

export function cheminPhoto(userId: string, produitId: string, version: number): string {
  return `${userId}/${produitId}/${version}.jpg`;
}

// Bêta : synchro active pour tous. Plus tard : conditionner à config.dateAbonnement.
export function peutSyncerPhotos(): boolean {
  return true;
}

// Upload une photo vers le bucket. Supprime les versions précédentes du même produit
// avant d'envoyer la nouvelle (évite les fichiers orphelins en cas de remplacement).
export async function uploadPhoto(
  supabase: SupabaseClient,
  userId: string,
  produit: Produit,
): Promise<string> {
  if (!produit.photo) throw new Error('Aucune photo à uploader');

  // Nettoyer les anciennes versions du produit dans le bucket
  const prefixe = `${userId}/${produit.id}`;
  const { data: anciens } = await supabase.storage.from(BUCKET).list(prefixe);
  if (anciens && anciens.length > 0) {
    const chemins = anciens.map((f) => `${prefixe}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(chemins);
  }

  // Upload
  const chemin = cheminPhoto(userId, produit.id, Date.now());
  const blob = base64ToBlob(produit.photo);
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return chemin;
}

// Télécharge une photo depuis le bucket et retourne son data URL (base64).
export async function downloadPhoto(
  supabase: SupabaseClient,
  chemin: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(chemin);
  if (error) throw error;
  return blobToBase64(data);
}

// Supprime un fichier du bucket (utilisé quand photo retirée ou produit supprimé).
export async function supprimerPhoto(
  supabase: SupabaseClient,
  chemin: string,
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([chemin]);
}

// --- Helpers de conversion ---

function base64ToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Étape 4 : Lancer le test pour vérifier qu'il passe**

```bash
cd frontend && npm test
```

Attendu : PASS (3 tests verts).

- [ ] **Étape 5 : Vérifier les types**

```bash
npm run type-check
```

Attendu : aucune erreur.

- [ ] **Étape 6 : Commit**

```bash
git add frontend/lib/photoSync.ts frontend/lib/__tests__/photoSync.test.ts
git commit -m "feat: module photoSync — upload/download/suppression + tests"
```

---

## Task 4 : Push des photos dans `sync.ts`

**Files:**
- Modify: `frontend/lib/sync.ts` — fonction `push()`

**Interfaces:**
- Consomme : `uploadPhoto`, `supprimerPhoto`, `peutSyncerPhotos` de `./photoSync`
- Produit — la liste `produits` (Dexie) dont certains ont `photo` présent et `photoPath == null`

La règle de décision :

| `p.photo` | `p.photoPath` | `p.deleted` | Action |
|---|---|---|---|
| présent | `null` ou `undefined` | false | Upload → nouveau chemin |
| absent | valeur présente | false | Supprimer le fichier bucket |
| présent ou absent | valeur présente | **true** | Supprimer le fichier bucket |
| présent | valeur présente | false | Rien (déjà sync) |

- [ ] **Étape 1 : Ajouter l'import de `photoSync` dans `sync.ts`**

Au sommet de `frontend/lib/sync.ts`, après les imports existants :
```typescript
import { uploadPhoto, supprimerPhoto, peutSyncerPhotos } from './photoSync';
```

- [ ] **Étape 2 : Ajouter `pushPhotos()` juste avant `push()` dans `sync.ts`**

```typescript
// Push des photos vers Supabase Storage (greffé sur push()).
// Chaque photo est traitée individuellement ; une erreur n'arrête pas les autres.
async function pushPhotos(userId: string, produits: Produit[]): Promise<void> {
  if (!peutSyncerPhotos()) return;
  const supabase = getClient();

  for (const p of produits) {
    try {
      if (p.photo && p.photoPath == null) {
        // Photo nouvelle ou modifiée → upload (les anciennes versions sont nettoyées dans uploadPhoto)
        const newPath = await uploadPhoto(supabase, userId, p);
        await db.produits.update(p.id, { photoPath: newPath });
        p.photoPath = newPath; // mise à jour en mémoire pour que produitToRow() ait le bon chemin
      } else if (p.photoPath && (!p.photo || p.deleted)) {
        // Photo retirée ou produit supprimé → supprimer le fichier bucket
        await supprimerPhoto(supabase, p.photoPath);
        await db.produits.update(p.id, { photoPath: null });
        p.photoPath = null;
      }
    } catch {
      // Réseau instable ou quota dépassé : on continue, la prochaine sync réessaiera.
    }
  }
}
```

- [ ] **Étape 3 : Appeler `pushPhotos()` au début de `push()`, avant l'upsert produits**

Remplacer la fonction `push()` existante par :
```typescript
async function push(userId: string): Promise<void> {
  const supabase = getClient();

  // --- photos (avant l'upsert pour que photo_path soit à jour dans les lignes) ---
  const produits = await db.produits.toArray();
  await pushPhotos(userId, produits);

  // --- produits ---
  if (produits.length > 0) {
    const rows = produits.map((p) => produitToRow(p, userId));
    const { error } = await supabase.from('produits').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // --- ventes ---
  const ventes = await db.ventes.toArray();
  if (ventes.length > 0) {
    const rows = ventes.map((v) => venteToRow(v, userId));
    const { error } = await supabase.from('ventes').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // --- config ---
  const config = await db.config.get('singleton');
  if (config) {
    const { error } = await supabase
      .from('config')
      .upsert(configToRow(config, userId), { onConflict: 'user_id' });
    if (error) throw error;
  }
}
```

- [ ] **Étape 4 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Attendu : aucune erreur.

- [ ] **Étape 5 : Commit**

```bash
git add frontend/lib/sync.ts
git commit -m "feat: push des photos vers Supabase Storage lors de la sync"
```

---

## Task 5 : Pull des photos dans `sync.ts`

**Files:**
- Modify: `frontend/lib/sync.ts` — fonction `pull()`

**Interfaces:**
- Consomme : `downloadPhoto`, `peutSyncerPhotos` de `./photoSync`
- Produit : les lignes cloud ont maintenant `photo_path`; le pull doit télécharger la photo si le chemin a changé.

Logique de décision pour chaque produit reçu du cloud :

| `remote.photoPath` | `=== local?.photoPath` | Action |
|---|---|---|
| présent | non (différent) | Télécharger → mettre à jour `photo` + `photoPath` local |
| présent | oui (identique) | Garder le cache local (rien à télécharger) |
| absent / null | — | Effacer la photo locale |

- [ ] **Étape 1 : Ajouter l'import `downloadPhoto` dans `sync.ts`**

Mettre à jour la ligne d'import de photoSync (déjà ajoutée en Task 4) :
```typescript
import { uploadPhoto, supprimerPhoto, downloadPhoto, peutSyncerPhotos } from './photoSync';
```

- [ ] **Étape 2 : Remplacer le bloc `--- produits ---` dans `pull()` par la version avec photo sync**

Dans la fonction `pull()`, remplacer le bloc produits existant :

```typescript
  // --- produits ---
  const { data: produitsRows, error: pErr } = await supabase
    .from('produits')
    .select('*')
    .eq('user_id', userId);
  if (pErr) throw pErr;

  for (const row of (produitsRows ?? []) as ProduitRow[]) {
    const remote = rowToProduit(row);
    const local = await db.produits.get(remote.id);
    if (!local || remote.updatedAt > local.updatedAt) {
      let mergedPhoto: string | undefined = local?.photo;
      let mergedPhotoPath: string | null | undefined = remote.photoPath;

      if (peutSyncerPhotos()) {
        if (remote.photoPath && remote.photoPath !== local?.photoPath) {
          // Nouveau chemin cloud → télécharger la photo
          try {
            mergedPhoto = await downloadPhoto(supabase, remote.photoPath);
          } catch {
            // Téléchargement échoué : on garde le cache local ; la prochaine sync réessaiera.
            mergedPhoto = local?.photo;
            mergedPhotoPath = local?.photoPath;
          }
        } else if (!remote.photoPath) {
          // Le cloud indique qu'il n'y a plus de photo
          mergedPhoto = undefined;
          mergedPhotoPath = null;
        }
        // Si même chemin → cache local valide, rien à faire (mergedPhoto = local?.photo déjà)
      } else {
        // Synchro photos désactivée : conserver le cache local tel quel
        mergedPhoto = local?.photo;
        mergedPhotoPath = local?.photoPath;
      }

      await db.produits.put({ ...remote, photo: mergedPhoto, photoPath: mergedPhotoPath });
    }
  }
```

- [ ] **Étape 3 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Attendu : aucune erreur.

- [ ] **Étape 4 : Lancer les tests**

```bash
npm test
```

Attendu : 3 tests PASS (les tests photoSync.test.ts sont les seuls ; les fonctions pull/push n'ont pas de tests unitaires car elles dépendent de Supabase).

- [ ] **Étape 5 : Commit**

```bash
git add frontend/lib/sync.ts
git commit -m "feat: pull des photos depuis Supabase Storage lors de la sync"
```

---

## Task 6 : Marquer la photo comme « à re-uploader » dans l'UI

**Files:**
- Modify: `frontend/app/stock/page.tsx` — fonctions `handleEditer` et `handleAjouter`

**Interfaces:**
- Consomme : `Produit.photoPath` (nouveau champ), `modifierProduit` de `useStock`
- Produit — quand la photo change dans le formulaire, `photoPath = null` est inclus dans les données de mise à jour pour signaler au push suivant qu'un upload est nécessaire.

**Règle :** `photoPath = null` est ajouté **seulement** quand la photo est **remplacée** par une autre (nouvelle valeur non vide différente de l'ancienne). Si la photo est **retirée** (champsEdition.photo = ''), on ne touche **pas** `photoPath` — le push verra `!photo && photoPath` et supprimera le fichier bucket.

- [ ] **Étape 1 : Modifier `handleEditer` pour inclure `photoPath: null` quand la photo change**

Localiser la section de construction de `data` dans `handleEditer` (vers ligne 217–242).

Après la ligne `photo: champsEdition.photo || '',`, ajouter :
```typescript
// Si la photo a été remplacée (nouvelle valeur non-vide ≠ ancienne), marquer pour re-upload.
// Si retirée (''), on garde photoPath tel quel pour que le push puisse supprimer le fichier bucket.
...(champsEdition.photo && champsEdition.photo !== produitEnEdition.photo
  ? { photoPath: null as null }
  : {}),
```

Résultat : le bloc `data` complet ressemble à :
```typescript
const data: {
  nom: string; quantite: number; prixAchat: number; prixVente: number;
  seuilAlerte: number; codeBarres?: string; categorie?: string;
  tailleConditionnement?: number; photo?: string; photoPath?: null;
} = {
  nom: champsEdition.nom.trim(),
  quantite: Number(champsEdition.quantite),
  prixAchat: Number(champsEdition.prixAchat),
  prixVente: Number(champsEdition.prixVente),
  seuilAlerte: Number(champsEdition.seuilAlerte) || 5,
  photo: champsEdition.photo || '',
  ...(champsEdition.photo && champsEdition.photo !== produitEnEdition.photo
    ? { photoPath: null as null }
    : {}),
};
```

- [ ] **Étape 2 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Attendu : aucune erreur. (Dexie's `update()` accepte `{ photoPath: null }` car `null` est une valeur valide pour le type `string | null`.)

- [ ] **Étape 3 : Lancer les tests**

```bash
npm test
```

Attendu : 3 tests PASS.

- [ ] **Étape 4 : Commit**

```bash
git add frontend/app/stock/page.tsx
git commit -m "feat: marque photoPath=null lors du remplacement photo (déclenche re-upload)"
```

---

## Task 7 : Test manuel multi-appareils + vérification finale

Cette tâche est entièrement manuelle. Elle vérifie le comportement de bout en bout.

**Prérequis :** avoir déployé (ou lancé `npm run dev`) sur deux appareils/onglets connectés au même compte.

- [ ] **Scénario A : Ajout d'une photo sur appareil 1**

1. Ouvrir Stock sur appareil 1, ajouter une photo à un produit.
2. Attendre la sync (ou la déclencher manuellement si besoin).
3. Vérifier dans Supabase Dashboard → Storage → `product-photos` : un fichier `{uid}/{pid}/{version}.jpg` existe.
4. Ouvrir Stock sur appareil 2 : la photo du produit apparaît.

- [ ] **Scénario B : Remplacement de photo**

1. Sur appareil 1, remplacer la photo du même produit par une autre.
2. Après sync sur appareil 2 : la nouvelle photo est visible ; l'ancienne a disparu du bucket (vérifier dans Storage).

- [ ] **Scénario C : Retrait de photo**

1. Sur appareil 1, retirer la photo (bouton « Retirer la photo »).
2. Après sync sur appareil 2 : le produit affiche l'initiale (pas de photo) ; le fichier a disparu du bucket.

- [ ] **Scénario D : Suppression de produit**

1. Sur appareil 1, supprimer un produit qui avait une photo.
2. Après sync : le produit est masqué partout ; le fichier bucket a été supprimé.

- [ ] **Scénario E : Mode hors-ligne**

1. Sur appareil 1, couper le réseau, modifier la photo d'un produit.
2. Rétablir le réseau : la sync se déclenche et le fichier apparaît dans le bucket.

- [ ] **Scénario F : Sécurité RLS**

Via le dashboard Supabase SQL Editor :
```sql
-- Vérifier qu'un user ne peut pas lire le dossier d'un autre
SELECT * FROM storage.objects
WHERE bucket_id = 'product-photos'
  AND (storage.foldername(name))[1] != auth.uid()::text;
```
Doit retourner 0 lignes pour l'utilisateur connecté.

- [ ] **Commit final**

```bash
git add -A
git commit -m "feat: synchronisation cloud des photos de produits (Supabase Storage)"
```

---

## Self-review — couverture de la spec

| Exigence spec | Tâche couverte |
|---|---|
| Bucket privé `product-photos` | Task 1 |
| RLS : accès limité au dossier `{user_id}` | Task 1 |
| Colonne `photo_path` sur `produits` | Task 1 |
| `Produit.photoPath?: string \| null` | Task 2 |
| `ProduitRow.photo_path` + mappers | Task 2 |
| `peutSyncerPhotos()` retourne `true` en bêta | Task 3 |
| `cheminPhoto()` pure et testée | Task 3 |
| Upload photo lors du push | Task 4 |
| Suppression fichier sur retrait / suppression produit | Task 4 |
| Nettoyage des anciennes versions avant upload | Task 4 (dans `uploadPhoto`) |
| Download photo lors du pull si chemin différent | Task 5 |
| Pas de re-download si chemin identique (cache) | Task 5 |
| UI : mark `photoPath = null` quand photo remplacée | Task 6 |
| UI : garde `photoPath` quand photo retirée (pour delete bucket) | Task 6 |
| Migration douce : photos existantes uploadées au premier push | Task 4 (produits avec `photo` et `photoPath == null`) |
| Erreur réseau : sync continue, réessai au prochain cycle | Tasks 4 + 5 (try/catch par photo) |
| `db.ts` inchangé (pas de migration Dexie) | ✓ (aucune tâche ne touche `db.ts`) |
| L'UI affiche toujours `produit.photo` (base64) | ✓ (aucune tâche ne touche l'affichage) |
| Tests unitaires des fonctions pures | Task 3 |
| Test manuel multi-appareils | Task 7 |
