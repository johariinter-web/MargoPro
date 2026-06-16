# Conditionnement par paquet dans le stock — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre aux commerçants d'entrer leur stock en nombre de paquets plutôt qu'en unités individuelles, avec calcul automatique de la quantité totale.

**Architecture:** Ajout d'un champ optionnel `tailleConditionnement` sur le type `Produit`. Le formulaire d'ajout de produit affiche un calculateur quand ce champ est rempli. La quantité stockée reste toujours en unités. Aucune migration Dexie nécessaire (champ non indexé).

**Tech Stack:** Next.js 16, TypeScript, Dexie (IndexedDB), React hooks

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `backend/types.ts` | Ajouter `tailleConditionnement?: number` à `Produit` |
| `app/stock/page.tsx` | Ajouter champ + calculateur dans le formulaire, affichage dans la liste |

`lib/hooks/useStock.ts`, `backend/stock.ts` et `lib/db.ts` **ne changent pas** : `ajouterProduit` accepte déjà `Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>` donc le nouveau champ passe automatiquement.

---

## Task 1 : Ajouter `tailleConditionnement` au type Produit

**Files:**
- Modify: `backend/types.ts`

- [ ] **Étape 1 : Modifier le type Produit**

Dans `backend/types.ts`, ajouter `tailleConditionnement?: number;` après `categorie?: string;` :

```ts
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
  createdAt: number;
  updatedAt: number;
}
```

- [ ] **Étape 2 : Vérifier la compilation TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Étape 3 : Commiter**

```bash
git add backend/types.ts
git commit -m "feat: ajouter tailleConditionnement au type Produit"
```

---

## Task 2 : Formulaire et affichage dans la page Stock

**Files:**
- Modify: `app/stock/page.tsx`

- [ ] **Étape 1 : Ajouter `tailleConditionnement` à CHAMPS_VIDES**

Remplacer :
```ts
const CHAMPS_VIDES = {
  nom: '', quantite: '', prixAchat: '', prixVente: '',
  seuilAlerte: '5', codeBarres: '', categorie: '',
};
```

Par :
```ts
const CHAMPS_VIDES = {
  nom: '', quantite: '', prixAchat: '', prixVente: '',
  seuilAlerte: '5', codeBarres: '', categorie: '', tailleConditionnement: '',
};
```

- [ ] **Étape 2 : Mettre à jour handleAjouter pour calculer la quantité et passer le champ**

Remplacer la fonction `handleAjouter` existante par :

```ts
async function handleAjouter() {
  setErreur('');
  const taille = Number(champs.tailleConditionnement);
  const quantiteCalculee = taille > 0
    ? Number(champs.quantite) * taille
    : Number(champs.quantite);

  const data: Parameters<typeof ajouterProduit>[0] = {
    nom: champs.nom.trim(),
    quantite: quantiteCalculee,
    prixAchat: Number(champs.prixAchat),
    prixVente: Number(champs.prixVente),
    seuilAlerte: Number(champs.seuilAlerte) || 5,
  };
  if (champs.codeBarres.trim()) data.codeBarres = champs.codeBarres.trim();
  if (champs.categorie.trim()) {
    data.categorie = champs.categorie.trim();
    if (!categories.includes(champs.categorie.trim())) {
      ajouterCategorie(champs.categorie.trim());
    }
  }
  if (taille > 0) data.tailleConditionnement = taille;

  const err = await ajouterProduit(data);
  if (err) { setErreur(err); return; }
  setChamps(CHAMPS_VIDES);
  setShowForm(false);
}
```

- [ ] **Étape 3 : Remplacer le bloc de champs texte/numérique dans le formulaire**

Remplacer entièrement le tableau `.map(...)` existant par ces champs dans cet ordre (tailleConditionnement AVANT quantite pour que le label change avant que l'utilisateur remplisse la quantité) :

```tsx
{/* Nom */}
<div style={{ marginBottom: 10 }}>
  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du produit</label>
  <input type="text" value={champs.nom} onChange={e => setChamps(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Savon Protex"
    style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
</div>

{/* Unités par paquet — AVANT quantite pour que le label change en temps réel */}
<div style={{ marginBottom: 10 }}>
  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Unités par paquet (optionnel)</label>
  <input type="number" value={champs.tailleConditionnement} onChange={e => setChamps(c => ({ ...c, tailleConditionnement: e.target.value }))} placeholder="Ex: 12 pour un carton de 12" min="1"
    style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
</div>

{/* Quantité — label dynamique */}
<div style={{ marginBottom: 10 }}>
  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
    {Number(champs.tailleConditionnement) > 0 ? 'Nombre de paquets reçus' : 'Quantité'}
  </label>
  <input type="number" value={champs.quantite} onChange={e => setChamps(c => ({ ...c, quantite: e.target.value }))} placeholder="0" min="0"
    style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
  {Number(champs.tailleConditionnement) > 0 && Number(champs.quantite) > 0 && (
    <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginTop: 4 }}>
      {champs.quantite} paquet{Number(champs.quantite) > 1 ? 's' : ''} × {champs.tailleConditionnement} = {Number(champs.quantite) * Number(champs.tailleConditionnement)} unités
    </div>
  )}
</div>

{/* Autres champs */}
{[
  { key: 'prixAchat', label: `Prix d'achat (${symbole})`, placeholder: '0', type: 'number' },
  { key: 'prixVente', label: `Prix de vente (${symbole})`, placeholder: '0', type: 'number' },
  { key: 'seuilAlerte', label: "Seuil d'alerte stock bas", placeholder: '5', type: 'number' },
  { key: 'codeBarres', label: 'Code-barres (optionnel)', placeholder: 'Ex: 3017620422003', type: 'text' },
].map(({ key, label, placeholder, type }) => (
  <div key={key} style={{ marginBottom: 10 }}>
    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
    <input type={type} value={champs[key as keyof typeof champs]} onChange={e => setChamps(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} min={type === 'number' ? '0' : undefined}
      style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
  </div>
))}
```

- [ ] **Étape 4 : Afficher "Paquet de X unités" dans la liste des produits**

Dans la carte produit, après le bloc `{produit.categorie && ...}`, ajouter :

```tsx
{produit.tailleConditionnement && (
  <span style={{ fontSize: 11, fontWeight: 600, background: T.bgSubtle, color: T.textSub, borderRadius: 20, padding: '1px 7px' }}>
    Paquet de {produit.tailleConditionnement}
  </span>
)}
```

- [ ] **Étape 5 : Vérifier la compilation TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Résultat attendu : aucune erreur.

- [ ] **Étape 6 : Tester manuellement**

1. Lancer `npm run dev` dans `frontend/`
2. Aller dans Stock > bouton "Ajouter"
3. Remplir "Unités par paquet" avec `12`
4. Remplir "Nombre de paquets reçus" avec `3`
5. Vérifier que le texte `3 paquets × 12 = 36 unités` apparaît
6. Compléter les autres champs et sauvegarder
7. Vérifier que la carte produit affiche "Paquet de 12"
8. Vérifier que la quantité affichée est bien 36

- [ ] **Étape 7 : Commiter**

```bash
git add app/stock/page.tsx
git commit -m "feat: calculateur de paquets dans le formulaire stock"
```
