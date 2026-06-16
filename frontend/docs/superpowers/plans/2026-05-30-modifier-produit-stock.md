# Modifier un produit depuis l'onglet Stock — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de modifier un produit existant en tappant sur sa carte dans l'onglet Stock.

**Architecture:** Un seul fichier modifié : `app/stock/page.tsx`. On ajoute deux états (`produitEnEdition` et `champsEdition`), on rend les cartes cliquables, et on ajoute un bottom sheet d'édition pré-rempli qui appelle le hook `modifierProduit` déjà existant dans `useStock`.

**Tech Stack:** Next.js 16, TypeScript, React hooks, Dexie via `useStock`

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `app/stock/page.tsx` | Ajouter états édition, rendre cartes cliquables, ajouter bottom sheet |

`lib/hooks/useStock.ts`, `backend/types.ts` : **inchangés** — `modifierProduit` existe déjà.

---

## Task 1 : Modifier un produit (état + bottom sheet + cartes cliquables)

**Files:**
- Modify: `app/stock/page.tsx`

- [ ] **Étape 1 : Ajouter `modifierProduit` au destructuring de `useStock`**

Remplacer :
```ts
const { produits, alertes, ajouterProduit, supprimerProduit } = useStock();
```

Par :
```ts
const { produits, alertes, ajouterProduit, supprimerProduit, modifierProduit } = useStock();
```

- [ ] **Étape 2 : Ajouter les états pour l'édition**

Après la ligne `const [recherche, setRecherche] = useState('');`, ajouter :

```ts
const [produitEnEdition, setProduitEnEdition] = useState<Produit | null>(null);
const [champsEdition, setChampsEdition] = useState({ ...CHAMPS_VIDES });
const [erreurEdition, setErreurEdition] = useState('');
```

- [ ] **Étape 3 : Ajouter la fonction `openEditer`**

Après la fonction `handleScan`, ajouter :

```ts
function openEditer(produit: Produit) {
  setProduitEnEdition(produit);
  setChampsEdition({
    nom: produit.nom,
    quantite: String(produit.quantite),
    prixAchat: String(produit.prixAchat),
    prixVente: String(produit.prixVente),
    seuilAlerte: String(produit.seuilAlerte),
    codeBarres: produit.codeBarres ?? '',
    categorie: produit.categorie ?? '',
    tailleConditionnement: produit.tailleConditionnement ? String(produit.tailleConditionnement) : '',
  });
  setErreurEdition('');
}
```

- [ ] **Étape 4 : Ajouter la fonction `handleEditer`**

Après `openEditer`, ajouter :

```ts
async function handleEditer() {
  if (!produitEnEdition) return;
  setErreurEdition('');
  const taille = Number(champsEdition.tailleConditionnement);
  const data: {
    nom: string; quantite: number; prixAchat: number; prixVente: number;
    seuilAlerte: number; codeBarres?: string; categorie?: string; tailleConditionnement?: number;
  } = {
    nom: champsEdition.nom.trim(),
    quantite: Number(champsEdition.quantite),
    prixAchat: Number(champsEdition.prixAchat),
    prixVente: Number(champsEdition.prixVente),
    seuilAlerte: Number(champsEdition.seuilAlerte) || 5,
  };
  if (champsEdition.codeBarres.trim()) data.codeBarres = champsEdition.codeBarres.trim();
  if (champsEdition.categorie.trim()) {
    data.categorie = champsEdition.categorie.trim();
    if (!categories.includes(champsEdition.categorie.trim())) {
      ajouterCategorie(champsEdition.categorie.trim());
    }
  }
  if (taille > 0) data.tailleConditionnement = taille;
  const err = await modifierProduit(produitEnEdition.id, data);
  if (err) { setErreurEdition(err); return; }
  setProduitEnEdition(null);
}
```

- [ ] **Étape 5 : Rendre les cartes produits cliquables**

Dans le `.map()` des produits, la carte actuelle commence par :
```tsx
<div key={produit.id} style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 12 }}>
```

Ajouter `onClick` et `cursor: 'pointer'` :
```tsx
<div key={produit.id} onClick={() => openEditer(produit)} style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
```

Et sur le bouton de suppression, ajouter `e.stopPropagation()` pour qu'un tap sur × ne déclenche pas l'édition :
```tsx
<button onClick={e => { e.stopPropagation(); supprimerProduit(produit.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: '4px 2px', fontSize: 16, lineHeight: 1 }} aria-label="Supprimer">×</button>
```

- [ ] **Étape 6 : Ajouter le bottom sheet d'édition dans le JSX**

Juste après le bloc `{showScanner && <BarcodeScanner ... />}` et avant le DÉTAIL MODAL, ajouter :

```tsx
{/* BOTTOM SHEET ÉDITION */}
{produitEnEdition && (
  <div
    style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
    onClick={() => setProduitEnEdition(null)}
  >
    <div
      style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px', maxHeight: '90dvh', overflowY: 'auto' }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
      <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 16 }}>Modifier le produit</div>

      {erreurEdition && (
        <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
          {erreurEdition}
        </div>
      )}

      {/* Nom */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du produit</label>
        <input type="text" value={champsEdition.nom} onChange={e => setChampsEdition(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Savon Protex"
          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
      </div>

      {/* Unités par paquet */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Unités par paquet (optionnel)</label>
        <input type="number" value={champsEdition.tailleConditionnement} onChange={e => setChampsEdition(c => ({ ...c, tailleConditionnement: e.target.value }))} placeholder="Ex: 12" min="1"
          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
      </div>

      {/* Champs numériques */}
      {[
        { key: 'quantite', label: 'Quantité en stock', placeholder: '0' },
        { key: 'prixAchat', label: `Prix d'achat (${symbole})`, placeholder: '0' },
        { key: 'prixVente', label: `Prix de vente (${symbole})`, placeholder: '0' },
        { key: 'seuilAlerte', label: "Seuil d'alerte", placeholder: '5' },
      ].map(({ key, label, placeholder }) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
          <input type="number" value={champsEdition[key as keyof typeof champsEdition]} onChange={e => setChampsEdition(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} min="0"
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
        </div>
      ))}

      {/* Code-barres */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Code-barres (optionnel)</label>
        <input type="text" value={champsEdition.codeBarres} onChange={e => setChampsEdition(c => ({ ...c, codeBarres: e.target.value }))} placeholder="Ex: 3017620422003"
          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
      </div>

      {/* Catégorie */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 6 }}>Catégorie</label>
        <input type="text" value={champsEdition.categorie} onChange={e => setChampsEdition(c => ({ ...c, categorie: e.target.value }))} placeholder="Taper ou choisir..."
          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', marginBottom: categories.length > 0 ? 8 : 0 }} />
        {categories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setChampsEdition(c => ({ ...c, categorie: c.categorie === cat ? '' : cat }))}
                style={{ height: 28, borderRadius: 20, padding: '0 10px', fontSize: 12, fontWeight: 600, border: `1.5px solid ${champsEdition.categorie === cat ? T.accent : T.border}`, cursor: 'pointer', background: champsEdition.categorie === cat ? T.accentLight : 'transparent', color: champsEdition.categorie === cat ? T.accent : T.textSub }}>
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => setProduitEnEdition(null)} style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}>
          Annuler
        </button>
        <button onClick={handleEditer} style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}>
          Enregistrer
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Étape 7 : Vérifier la compilation TypeScript**

```bash
cd "C:\Users\HP\OneDrive - MONCCNB\Documents\SAAS\MargoPro\frontend" && npx tsc --noEmit
```

Résultat attendu : zéro erreur.

- [ ] **Étape 8 : Commiter**

```bash
git add app/stock/page.tsx
git commit -m "feat: modifier un produit par tap sur la carte stock"
```
