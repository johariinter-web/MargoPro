# Facturation simple (panier + partage WhatsApp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une facturation simple à MargoPro : un onglet "Facture" sur la page Ventes qui accumule les ventes enregistrées (un client peut acheter plusieurs articles), plus la possibilité d'ajouter des lignes à la main, puis générer une image de facture (nom de la boutique, date, client, articles, total) et la partager par WhatsApp.

**Architecture:** Une "facture en cours" (panier de lignes) persistée en `localStorage` (pas de synchronisation cloud — c'est un brouillon éphémère, propre à l'appareil, jamais un enregistrement comptable définitif). Chaque vente confirmée dans le formulaire existant ajoute automatiquement une ligne au panier. La génération d'image réutilise le même principe déjà en place pour "Partager mon catalogue"/"Partager ce produit" dans `frontend/app/marges/page.tsx` : dessin sur un `<canvas>`, export en JPEG, puis `navigator.share` (avec repli en téléchargement direct si le partage n'est pas supporté).

**Tech Stack:** React/Next.js (App Router), TypeScript, Canvas API native (aucune dépendance de génération de PDF), Web Share API.

**Spec:** Aucun document de spec séparé — conception validée directement en conversation avec Juanita le 2026-08-14 (tâche classée "bounded" : réutilise des patterns déjà existants dans le code, pas un nouveau sous-système).

## Global Constraints

- Maximum 4 champs par formulaire, termes simples en français (principe du projet, voir `CLAUDE.md`).
- Le panier de facture est local à l'appareil, non synchronisé avec Supabase — aucune migration de base de données cloud pour ce chantier.
- Ne modifie ni la table `ventes` ni sa logique d'enregistrement existante (`useVentes`) — la facture est une couche d'affichage/partage par-dessus des ventes déjà enregistrées normalement, pas un nouveau système de comptabilité.
- Suivre le style visuel déjà en place dans `frontend/app/ventes/page.tsx` (couleurs via `useColors()`, `fmtF()` pour les montants, `'Manrope, sans-serif'` pour le texte, `'"Space Grotesk", sans-serif'` pour les chiffres).

---

## Task 1: Le panier de facture (couche données)

**Files:**
- Create: `frontend/lib/factureEnCours.ts`
- Create: `frontend/lib/hooks/useFactureEnCours.ts`
- Test: `frontend/lib/__tests__/factureEnCours.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: `LigneFacture` (type), `ajouterLigne(lignes, nouvelleLigne): LigneFacture[]`, `retirerLigne(lignes, id): LigneFacture[]` — utilisés par Task 3 via le hook `useFactureEnCours()`, qui expose `{ lignes, clientNom, setClientNom, ajouter(nom, quantite, prixUnitaire), retirer(id), vider() }`.

- [ ] **Step 1: Écrire les tests pour la logique pure (RED)**

Créer `frontend/lib/__tests__/factureEnCours.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { ajouterLigne, retirerLigne, totalLignes, type LigneFacture } from '../factureEnCours';

describe('ajouterLigne', () => {
  it('ajoute une ligne avec un id unique et le bon total', () => {
    const lignes = ajouterLigne([], 'Savon', 2, 500);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].nom).toBe('Savon');
    expect(lignes[0].quantite).toBe(2);
    expect(lignes[0].prixUnitaire).toBe(500);
    expect(lignes[0].total).toBe(1000);
    expect(lignes[0].id).toBeTruthy();
  });

  it('ajoute à la suite des lignes existantes sans les modifier', () => {
    const depart: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 }];
    const lignes = ajouterLigne(depart, 'Huile', 1, 700);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toEqual(depart[0]);
    expect(lignes[1].nom).toBe('Huile');
  });
});

describe('retirerLigne', () => {
  it('retire uniquement la ligne avec cet id', () => {
    const depart: LigneFacture[] = [
      { id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 },
      { id: 'b', nom: 'Huile', quantite: 1, prixUnitaire: 700, total: 700 },
    ];
    const lignes = retirerLigne(depart, 'a');
    expect(lignes).toHaveLength(1);
    expect(lignes[0].id).toBe('b');
  });

  it("ne fait rien si l'id n'existe pas", () => {
    const depart: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 }];
    const lignes = retirerLigne(depart, 'inconnu');
    expect(lignes).toEqual(depart);
  });
});

describe('totalLignes', () => {
  it('additionne le total de toutes les lignes', () => {
    const lignes: LigneFacture[] = [
      { id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 },
      { id: 'b', nom: 'Huile', quantite: 2, prixUnitaire: 700, total: 1400 },
    ];
    expect(totalLignes(lignes)).toBe(1700);
  });

  it('retourne 0 pour un panier vide', () => {
    expect(totalLignes([])).toBe(0);
  });
});
```

- [ ] **Step 2: Lancer les tests, confirmer qu'ils échouent**

Run (depuis `frontend/`): `npx vitest run lib/__tests__/factureEnCours.test.ts`
Expected: FAIL — `../factureEnCours` n'existe pas encore.

- [ ] **Step 3: Implémenter la logique pure**

Créer `frontend/lib/factureEnCours.ts` :

```ts
export interface LigneFacture {
  id: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

export function ajouterLigne(
  lignes: LigneFacture[],
  nom: string,
  quantite: number,
  prixUnitaire: number
): LigneFacture[] {
  const ligne: LigneFacture = {
    id: crypto.randomUUID(),
    nom,
    quantite,
    prixUnitaire,
    total: quantite * prixUnitaire,
  };
  return [...lignes, ligne];
}

export function retirerLigne(lignes: LigneFacture[], id: string): LigneFacture[] {
  return lignes.filter((l) => l.id !== id);
}

export function totalLignes(lignes: LigneFacture[]): number {
  return lignes.reduce((s, l) => s + l.total, 0);
}
```

- [ ] **Step 4: Lancer les tests, confirmer qu'ils passent (GREEN)**

Run: `npx vitest run lib/__tests__/factureEnCours.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Créer le hook avec persistance locale**

Créer `frontend/lib/hooks/useFactureEnCours.ts` :

```ts
'use client';

import { useState } from 'react';
import { ajouterLigne, retirerLigne, totalLignes, type LigneFacture } from '../factureEnCours';

const CLE_LIGNES = 'margopro_facture_lignes';
const CLE_CLIENT = 'margopro_facture_client';

function lireLignes(): LigneFacture[] {
  if (typeof window === 'undefined') return [];
  try {
    const brut = window.localStorage.getItem(CLE_LIGNES);
    return brut ? JSON.parse(brut) : [];
  } catch {
    return [];
  }
}

function lireClient(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CLE_CLIENT) ?? '';
}

function sauvegarderLignes(lignes: LigneFacture[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLE_LIGNES, JSON.stringify(lignes));
}

export function useFactureEnCours() {
  const [lignes, setLignesState] = useState<LigneFacture[]>(() => lireLignes());
  const [clientNom, setClientNomState] = useState<string>(() => lireClient());

  function ajouter(nom: string, quantite: number, prixUnitaire: number) {
    setLignesState((prev) => {
      const suivant = ajouterLigne(prev, nom, quantite, prixUnitaire);
      sauvegarderLignes(suivant);
      return suivant;
    });
  }

  function retirer(id: string) {
    setLignesState((prev) => {
      const suivant = retirerLigne(prev, id);
      sauvegarderLignes(suivant);
      return suivant;
    });
  }

  function setClientNom(nom: string) {
    setClientNomState(nom);
    if (typeof window !== 'undefined') window.localStorage.setItem(CLE_CLIENT, nom);
  }

  function vider() {
    setLignesState([]);
    setClientNomState('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CLE_LIGNES);
      window.localStorage.removeItem(CLE_CLIENT);
    }
  }

  return { lignes, clientNom, setClientNom, ajouter, retirer, vider, total: totalLignes(lignes) };
}
```

Note : l'initialisation `useState(() => lireLignes())` utilise un initialiseur paresseux qui vérifie déjà `typeof window === 'undefined'` à l'intérieur de `lireLignes()`/`lireClient()` — nécessaire pour ne pas casser le build de production (`next build` exécute le rendu initial côté serveur, où `window` n'existe pas ; voir l'incident du 2026-08-14 sur `frontend/app/onboarding/page.tsx` pour un exemple concret de ce piège).

- [ ] **Step 6: Vérifier types et lint**

Run (depuis `frontend/`):
```bash
npx tsc --noEmit
npx eslint lib/factureEnCours.ts lib/hooks/useFactureEnCours.ts
npx vitest run
```
Expected: aucune erreur, tous les tests passent (ceux d'avant + les 5 nouveaux).

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/factureEnCours.ts frontend/lib/hooks/useFactureEnCours.ts frontend/lib/__tests__/factureEnCours.test.ts
git commit -m "feat: panier de facture en cours (logique + persistance locale)"
```

---

## Task 2: Génération de l'image de facture

**Files:**
- Create: `frontend/lib/facture.ts`

**Interfaces:**
- Consumes: `LigneFacture` (Task 1, `frontend/lib/factureEnCours.ts`)
- Produces: `genererImageFacture(donnees: DonneesFacture): Promise<Blob>` — utilisé par Task 3 dans `frontend/app/ventes/page.tsx`.

- [ ] **Step 1: Implémenter la génération d'image**

Créer `frontend/lib/facture.ts` :

```ts
import type { LigneFacture } from './factureEnCours';

export interface DonneesFacture {
  nomBoutique: string;
  clientNom: string;
  lignes: LigneFacture[];
  total: number;
  date: number;
  symbole: string;
}

function fmtF(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Dessine une facture simple sur un canvas et retourne l'image en JPEG.
 *  Pas de test unitaire pour cette fonction : Canvas n'existe pas dans
 *  l'environnement de test (node) ni dans jsdom de façon fonctionnelle --
 *  même limite déjà acceptée pour partagerProduit()/partagerCatalogue()
 *  dans frontend/app/marges/page.tsx. Vérifiée par build + test manuel. */
export async function genererImageFacture(d: DonneesFacture): Promise<Blob> {
  const W = 600, pad = 30;
  const ligneH = 32;
  const headerH = 140;
  const totalH = 70;
  const H = headerH + d.lignes.length * ligneH + totalH + pad;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');

  ctx.fillStyle = '#FAF7F3';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1C1811';
  ctx.font = '800 28px sans-serif';
  ctx.fillText(d.nomBoutique, pad, 46);

  ctx.font = '600 14px sans-serif';
  ctx.fillStyle = '#6A5D52';
  const dateStr = new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(dateStr, pad, 70);
  if (d.clientNom) ctx.fillText(`Client : ${d.clientNom}`, pad, 92);

  ctx.strokeStyle = '#E6DDD3';
  ctx.beginPath();
  ctx.moveTo(pad, headerH - 20);
  ctx.lineTo(W - pad, headerH - 20);
  ctx.stroke();

  let y = headerH;
  ctx.font = '600 15px sans-serif';
  for (const ligne of d.lignes) {
    ctx.fillStyle = '#1C1811';
    ctx.textAlign = 'left';
    ctx.fillText(`${ligne.nom} x${ligne.quantite}`, pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${fmtF(ligne.total)} ${d.symbole}`, W - pad, y);
    ctx.textAlign = 'left';
    y += ligneH;
  }

  ctx.strokeStyle = '#E6DDD3';
  ctx.beginPath();
  ctx.moveTo(pad, y + 10);
  ctx.lineTo(W - pad, y + 10);
  ctx.stroke();

  ctx.font = '800 22px sans-serif';
  ctx.fillStyle = '#D4601A';
  ctx.textAlign = 'left';
  ctx.fillText('Total', pad, y + 44);
  ctx.textAlign = 'right';
  ctx.fillText(`${fmtF(d.total)} ${d.symbole}`, W - pad, y + 44);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9));
  if (!blob) throw new Error("Échec de génération de l'image");
  return blob;
}
```

- [ ] **Step 2: Vérifier types, lint, build**

Run (depuis `frontend/`):
```bash
npx tsc --noEmit
npx eslint lib/facture.ts
npx vitest run
npm run build
```
Expected: aucune erreur, tests toujours 100% verts, build réussi.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/facture.ts
git commit -m "feat: generation de l'image de facture (canvas)"
```

---

## Task 3: Intégration dans la page Ventes

**Files:**
- Modify: `frontend/app/ventes/page.tsx`

**Interfaces:**
- Consumes: `useFactureEnCours()` (Task 1), `genererImageFacture()` (Task 2), `produits`/`config` déjà disponibles dans la page.
- Produces: rien (dernière tâche du plan)

- [ ] **Step 1: Ajouter les imports et le hook**

En haut de `frontend/app/ventes/page.tsx`, ajouter :

```ts
import { useFactureEnCours } from '@/lib/hooks/useFactureEnCours';
import { genererImageFacture } from '@/lib/facture';
```

Dans le composant, à côté des autres hooks (près de la ligne `const { produits, deduireStock } = useStock();`) :

```ts
const facture = useFactureEnCours();
const [genFactureEnCours, setGenFactureEnCours] = useState(false);
const [nouvLigneNom, setNouvLigneNom] = useState('');
const [nouvLigneQte, setNouvLigneQte] = useState('1');
const [nouvLignePrix, setNouvLignePrix] = useState('');
```

- [ ] **Step 2: Élargir le type d'onglet**

Remplacer :
```ts
const [onglet, setOnglet] = useState<'ventes' | 'carnet'>('ventes');
```
par :
```ts
const [onglet, setOnglet] = useState<'ventes' | 'carnet' | 'facture'>('ventes');
```

- [ ] **Step 3: Ajouter automatiquement chaque vente confirmée au panier**

Dans `handleVente()`, juste après la ligne `await enregistrerVente(produit.id, produit.nom, qte, prixFinal, produit.prixAchat, creditParams);` (vente d'un seul produit), ajouter :
```ts
facture.ajouter(produit.nom, qte, prixFinal);
```

Juste après la ligne `const erreurPack = await enregistrerVentePack(pack, creditParams); if (erreurPack) { setErreur(erreurPack); return; }` (vente d'un pack), ajouter :
```ts
facture.ajouter(pack.nom, 1, pack.prixVente);
```

- [ ] **Step 4: Ajouter le bouton d'onglet "Facture"**

Trouver le bloc des boutons d'onglet (`onClick={() => setOnglet('ventes')}` / `onClick={() => setOnglet('carnet')}`, autour de la ligne 425-440) et ajouter un troisième bouton juste après celui de "carnet", avec le même style que les deux autres (copier le style du bouton "carnet", changer `onglet === 'carnet'` en `onglet === 'facture'` et le texte en `Facture`), en indiquant le nombre de lignes en attente s'il y en a :

```tsx
<button
  onClick={() => setOnglet('facture')}
  style={{ flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: onglet === 'facture' ? T.accent : T.bgSubtle, color: onglet === 'facture' ? 'white' : T.textSub, position: 'relative' }}
>
  Facture{facture.lignes.length > 0 ? ` (${facture.lignes.length})` : ''}
</button>
```

- [ ] **Step 5: Fonction de partage**

Ajouter, à côté des autres fonctions `async function` de la page :

```ts
async function partagerFacture() {
  if (genFactureEnCours || facture.lignes.length === 0) return;
  setGenFactureEnCours(true);
  try {
    const blob = await genererImageFacture({
      nomBoutique: config?.nomCommerce || 'Ma boutique',
      clientNom: facture.clientNom,
      lignes: facture.lignes,
      total: facture.total,
      date: Date.now(),
      symbole: config?.symboleDevise || '',
    });
    const file = new File([blob], 'facture.jpg', { type: 'image/jpeg' });
    type NavShare = Navigator & { canShare?: (d: { files: File[] }) => boolean };
    const nav = navigator as NavShare;
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: `Facture - ${fmtF(facture.total)} ${config?.symboleDevise || ''}` });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'facture.jpg'; a.click();
      URL.revokeObjectURL(url);
    }
    facture.vider();
  } catch { /* partage annulé : on ignore, le panier reste intact */ }
  setGenFactureEnCours(false);
}
```

- [ ] **Step 6: Contenu de l'onglet Facture**

Trouver où se termine le bloc `{onglet === 'carnet' && ( ... )}` (autour de la ligne 792 et plus loin) et ajouter juste après, au même niveau, un nouveau bloc :

```tsx
{onglet === 'facture' && (
  <div style={{ padding: '0 16px' }}>
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: T.text, display: 'block', marginBottom: 6 }}>Nom du client (optionnel)</label>
      <input
        type="text"
        value={facture.clientNom}
        onChange={(e) => facture.setClientNom(e.target.value)}
        placeholder="Ex: Aminata"
        style={{ width: '100%', border: `2px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 15, color: T.text, background: T.surface, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
      />
    </div>

    {facture.lignes.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '30px 0', color: T.textMuted, fontSize: 14 }}>
        Aucun article pour l&apos;instant. Enregistre une vente, ou ajoute un article à la main ci-dessous.
      </div>
    ) : (
      <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, padding: '10px 14px', marginBottom: 14 }}>
        {facture.lignes.map((l) => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{l.nom} x{l.quantite}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(l.total)}</div>
            <button onClick={() => facture.retirer(l.id)} style={{ background: 'none', border: 'none', color: T.textMuted, fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Total</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(facture.total)} {config?.symboleDevise}</div>
        </div>
      </div>
    )}

    <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.textSub, marginBottom: 10 }}>Ajouter un article à la main</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="text" value={nouvLigneNom} onChange={(e) => setNouvLigneNom(e.target.value)} placeholder="Nom du produit"
          style={{ width: '100%', border: `2px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, color: T.text, background: T.bgSubtle, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="number" onWheel={(e) => e.currentTarget.blur()} value={nouvLigneQte} onChange={(e) => setNouvLigneQte(e.target.value)} placeholder="Qté" min="1"
            style={{ width: 70, border: `2px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, color: T.text, background: T.bgSubtle, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
          <input type="number" onWheel={(e) => e.currentTarget.blur()} value={nouvLignePrix} onChange={(e) => setNouvLignePrix(e.target.value)} placeholder={`Prix (${config?.symboleDevise ?? ''})`} min="0"
            style={{ flex: 1, border: `2px solid ${T.border}`, borderRadius: 12, padding: '10px 14px', fontSize: 14, color: T.text, background: T.bgSubtle, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
        </div>
        <button
          onClick={() => {
            const qte = Number(nouvLigneQte) || 0;
            const prix = Number(nouvLignePrix) || 0;
            if (!nouvLigneNom.trim() || qte <= 0 || prix <= 0) return;
            facture.ajouter(nouvLigneNom.trim(), qte, prix);
            setNouvLigneNom(''); setNouvLigneQte('1'); setNouvLignePrix('');
          }}
          disabled={!nouvLigneNom.trim() || !(Number(nouvLigneQte) > 0) || !(Number(nouvLignePrix) > 0)}
          style={{ width: '100%', height: 42, borderRadius: 12, background: T.bgSubtle, border: `2px solid ${T.accent}`, color: T.accent, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (!nouvLigneNom.trim() || !(Number(nouvLigneQte) > 0) || !(Number(nouvLignePrix) > 0)) ? 0.4 : 1, fontFamily: 'Manrope, sans-serif' }}
        >
          + Ajouter cet article
        </button>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 10 }}>
      <button
        onClick={() => facture.vider()}
        disabled={facture.lignes.length === 0}
        style={{ flex: 1, height: 48, borderRadius: 14, background: T.bgSubtle, border: 'none', color: T.textSub, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: facture.lignes.length === 0 ? 0.4 : 1, fontFamily: 'Manrope, sans-serif' }}
      >
        Vider
      </button>
      <button
        onClick={partagerFacture}
        disabled={facture.lignes.length === 0 || genFactureEnCours}
        style={{ flex: 2, height: 48, borderRadius: 14, background: T.accent, border: 'none', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: (facture.lignes.length === 0 || genFactureEnCours) ? 0.4 : 1, fontFamily: 'Manrope, sans-serif' }}
      >
        {genFactureEnCours ? 'Génération...' : 'Générer et partager'}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Vérifier types, lint, tests, build**

Run (depuis `frontend/`):
```bash
npx tsc --noEmit
npx eslint app/ventes/page.tsx
npx vitest run
npm run build
```
Expected : aucune erreur TypeScript, aucune nouvelle erreur ESLint (avertissements pré-existants sans rapport acceptables), tous les tests passent, build réussi.

- [ ] **Step 8: Test manuel**

`npm run build && npm run start`, se connecter, aller sur Ventes :
1. Enregistrer une vente normale → vérifier que l'onglet "Facture" affiche maintenant "Facture (1)".
2. Enregistrer une deuxième vente d'un produit différent → "Facture (2)".
3. Ouvrir l'onglet Facture → les 2 articles doivent apparaître avec le bon total.
4. Ajouter un article à la main → doit s'ajouter à la liste.
5. Retirer un article (bouton ×) → doit disparaître, le total doit se mettre à jour.
6. Taper un nom de client, cliquer "Générer et partager" → une image doit se générer (ou se télécharger si le partage n'est pas supporté par le navigateur de test) avec le nom de la boutique, la date, le client, les articles et le total.
7. Après le partage, revenir sur l'onglet Facture → doit être vide (panier vidé après envoi).

- [ ] **Step 9: Commit**

```bash
git add frontend/app/ventes/page.tsx
git commit -m "feat: onglet Facture sur la page Ventes (panier + partage WhatsApp)"
```
