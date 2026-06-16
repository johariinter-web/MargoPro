# Pluriels — Prix en gros à la volée

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'enregistrer une vente au prix gros via un champ optionnel, et afficher un calculateur de référence dans l'onglet Pluriels.

**Architecture:** Deux modifications indépendantes dans deux fichiers. Task 1 : champ `prixGros` optionnel dans le formulaire de vente (`app/ventes/page.tsx`). Task 2 : remplacement du placeholder Pluriels par un calculateur inline dans `app/marges/page.tsx`. Aucun changement aux types ou hooks.

**Tech Stack:** Next.js 16, TypeScript, React hooks, Dexie (IndexedDB), Tailwind-free inline styles

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `app/ventes/page.tsx` | Ajouter état `prixGros`, champ dans le formulaire, mise à jour aperçu et `handleVente` |
| `app/marges/page.tsx` | Remplacer placeholder Pluriels par calculateur avec sous-composant `LignePluriels` |

---

## Task 1 : Champ "Prix gros" dans le formulaire de vente

**Files:**
- Modify: `app/ventes/page.tsx`

- [ ] **Étape 1 : Ajouter l'état `prixGros`**

Dans `app/ventes/page.tsx`, après la ligne `const [erreur, setErreur] = useState('');`, ajouter :

```ts
const [prixGros, setPrixGros] = useState('');
```

- [ ] **Étape 2 : Calculer `prixEffectif` pour l'aperçu**

Remplacer la ligne :
```ts
const selectedProduit = produits.find(p => p.id === produitId);
const qteNum = Number(quantite) || 0;
```

Par :
```ts
const selectedProduit = produits.find(p => p.id === produitId);
const qteNum = Number(quantite) || 0;
const prixEffectif = selectedProduit && Number(prixGros) > 0
  ? Number(prixGros)
  : selectedProduit?.prixVente ?? 0;
```

- [ ] **Étape 3 : Mettre à jour `handleVente` pour utiliser `prixGros` et réinitialiser l'état**

Remplacer la fonction `handleVente` par :

```ts
async function handleVente() {
  setErreur('');
  const produit = produits.find(p => p.id === produitId);
  if (!produit) { setErreur('Choisissez un produit'); return; }
  const qte = Number(quantite);
  if (!qte || qte <= 0) { setErreur('Quantité invalide'); return; }
  if (qte > produit.quantite) { setErreur(`Stock insuffisant (${produit.quantite} disponibles)`); return; }
  const prixFinal = Number(prixGros) > 0 ? Number(prixGros) : produit.prixVente;
  await enregistrerVente(produit.id, produit.nom, qte, prixFinal, produit.prixAchat);
  await deduireStock(produit.id, qte);
  setProduitId('');
  setQuantite('1');
  setPrixGros('');
  setShowForm(false);
}
```

- [ ] **Étape 4 : Ajouter le champ "Prix unitaire gros" dans le formulaire**

Dans le formulaire de vente, après le bloc `<div style={{ marginBottom: 12 }}>` du champ Quantité et avant le bloc d'aperçu `{selectedProduit && (`, ajouter :

```tsx
<div style={{ marginBottom: 12 }}>
  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
    Prix unitaire gros (optionnel)
  </label>
  <input
    type="number"
    value={prixGros}
    onChange={e => setPrixGros(e.target.value)}
    placeholder={selectedProduit ? `Normal : ${fmtF(selectedProduit.prixVente)} ${symbole}` : 'Prix gros par unité'}
    min="0"
    style={{
      width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
      fontSize: 15, color: T.text, background: T.bg, outline: 'none',
      fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
    }}
  />
</div>
```

- [ ] **Étape 5 : Mettre à jour l'aperçu Total + Bénéfice pour utiliser `prixEffectif`**

Remplacer le bloc d'aperçu existant :
```tsx
{selectedProduit && (
  <div style={{ background: T.bgSubtle, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
    <span style={{ fontSize: 13, color: T.textSub }}>
      Total : <strong style={{ color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(selectedProduit.prixVente * qteNum)} {symbole}</strong>
      {'  ·  Bénéfice : '}
      <strong style={{ color: T.green, fontFamily: '"Space Grotesk", sans-serif' }}>+{fmtF((selectedProduit.prixVente - selectedProduit.prixAchat) * qteNum)} {symbole}</strong>
    </span>
  </div>
)}
```

Par :
```tsx
{selectedProduit && (
  <div style={{ background: T.bgSubtle, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
    <span style={{ fontSize: 13, color: T.textSub }}>
      Total : <strong style={{ color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(prixEffectif * qteNum)} {symbole}</strong>
      {'  ·  Bénéfice : '}
      <strong style={{ color: T.green, fontFamily: '"Space Grotesk", sans-serif' }}>+{fmtF((prixEffectif - selectedProduit.prixAchat) * qteNum)} {symbole}</strong>
    </span>
    {Number(prixGros) > 0 && (
      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
        Prix gros appliqué ({fmtF(Number(prixGros))} {symbole}/unité)
      </div>
    )}
  </div>
)}
```

- [ ] **Étape 6 : Réinitialiser `prixGros` quand on ferme le formulaire sans vendre**

Trouver le bouton "Annuler" dans le formulaire de vente :
```tsx
onClick={() => { setShowForm(false); setErreur(''); }}
```

Remplacer par :
```tsx
onClick={() => { setShowForm(false); setErreur(''); setPrixGros(''); }}
```

- [ ] **Étape 7 : Vérifier la compilation TypeScript**

```bash
cd "C:\Users\HP\OneDrive - MONCCNB\Documents\SAAS\MargoPro\frontend" && npx tsc --noEmit
```

Résultat attendu : zéro erreur.

- [ ] **Étape 8 : Commiter**

```bash
git add app/ventes/page.tsx
git commit -m "feat: champ prix gros optionnel dans le formulaire de vente"
```

---

## Task 2 : Calculateur Pluriels dans l'onglet Marges

**Files:**
- Modify: `app/marges/page.tsx`

- [ ] **Étape 1 : Ajouter le sous-composant `LignePluriels` avant `MargesPage`**

Dans `app/marges/page.tsx`, après la fonction `fmtF` et avant `type TabMode`, ajouter ce composant. Il appelle `useColors()` directement (plus simple que de passer T en prop) :

```tsx
function LignePluriels({ produit, symbole }: {
  produit: { id: string; nom: string; prixVente: number; prixAchat: number; quantite: number };
  symbole: string;
}) {
  const T = useColors();
  const [qte, setQte] = useState('');
  const [prixGros, setPrixGros] = useState('');
  const qteNum = Number(qte) || 0;
  const prixNum = Number(prixGros) || 0;
  const total = prixNum > 0 && qteNum > 0 ? prixNum * qteNum : 0;
  const benefice = prixNum > 0 && qteNum > 0 ? (prixNum - produit.prixAchat) * qteNum : 0;

  return (
    <div style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', boxShadow: T.shadow, marginBottom: 8 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {produit.nom}
      </div>
      <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10, fontFamily: '"Space Grotesk", sans-serif' }}>
        Prix normal : {fmtF(produit.prixVente)} {symbole}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: total > 0 ? 10 : 0 }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>Qté</label>
          <input
            type="number"
            value={qte}
            onChange={e => setQte(e.target.value)}
            placeholder="0"
            min="1"
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: T.textSub, marginBottom: 4 }}>Prix gros/unité ({symbole})</label>
          <input
            type="number"
            value={prixGros}
            onChange={e => setPrixGros(e.target.value)}
            placeholder={fmtF(produit.prixVente)}
            min="0"
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
          />
        </div>
      </div>
      {total > 0 && (
        <div style={{ background: T.bgSubtle, borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: T.textSub }}>
            Total : <strong style={{ color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(total)} {symbole}</strong>
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: benefice >= 0 ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif' }}>
            {benefice >= 0 ? '+' : ''}{fmtF(benefice)} {symbole}
          </span>
        </div>
      )}
    </div>
  );
}

- [ ] **Étape 2 : Remplacer le placeholder Pluriels par le calculateur**

Dans `MargesPage`, remplacer :
```tsx
{tab === 'Pluriels' && (
  <div style={{ textAlign: 'center', padding: '60px 16px', color: T.textMuted }}>
    <div style={{ fontSize: 36, marginBottom: 12 }}>🛒</div>
    <div style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>Prix en gros</div>
    <div style={{ fontSize: 13, marginTop: 6 }}>Bientôt disponible</div>
  </div>
)}
```

Par :
```tsx
{tab === 'Pluriels' && (
  <div style={{ padding: '0 16px' }}>
    {produits.length === 0 ? (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun produit</div>
        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Ajoutez des produits dans l&apos;onglet Stock</div>
      </div>
    ) : (
      <>
        <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12, fontWeight: 600 }}>
          Simulez un prix en gros par produit — aucune vente n&apos;est enregistrée ici
        </div>
        {produits.map(p => (
          <LignePluriels key={p.id} produit={p} symbole={symbole} />
        ))}
      </>
    )}
  </div>
)}
```

- [ ] **Étape 3 : Vérifier la compilation TypeScript**

```bash
cd "C:\Users\HP\OneDrive - MONCCNB\Documents\SAAS\MargoPro\frontend" && npx tsc --noEmit
```

Résultat attendu : zéro erreur.

- [ ] **Étape 4 : Commiter**

```bash
git add app/marges/page.tsx
git commit -m "feat: calculateur pluriels dans l'onglet marges"
```
