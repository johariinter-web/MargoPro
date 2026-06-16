# Design : Conditionnement par paquet dans le stock

**Date :** 2026-05-30
**Statut :** Approuvé

---

## Contexte

Les petits commerçants achètent souvent leurs produits en paquets (cartons de 12, lots de 6, etc.) et les revendent à l'unité. Actuellement, MargoPro oblige l'utilisateur à calculer manuellement la quantité totale (ex : 3 cartons × 12 = 36) avant de saisir le stock. Cette fonctionnalité automatise ce calcul.

---

## Périmètre

- Ajout d'un champ optionnel `tailleConditionnement` sur le produit
- Modification du formulaire d'ajout de produit pour afficher un calculateur de paquets
- Aucune modification du système de ventes

---

## Modèle de données

### Type `Produit` (backend/types.ts)

Ajouter le champ optionnel :

```ts
tailleConditionnement?: number; // nombre d'unités par paquet
```

La quantité en stock (`quantite`) reste toujours exprimée en unités individuelles. Le champ `tailleConditionnement` est purement informatif et sert au calcul.

---

## Interface utilisateur

### Formulaire "Nouveau produit" (stock/page.tsx)

1. Ajouter un champ **"Unités par paquet (optionnel)"** après le champ "Seuil d'alerte".
2. Si ce champ est rempli (valeur > 0) :
   - Le label du champ "Quantité" devient **"Nombre de paquets reçus"**
   - Sous ce champ, afficher en temps réel : `X paquets × Y = Z unités`
   - La valeur enregistrée dans `quantite` est toujours `Z` (le total en unités)
3. Si ce champ est vide, le formulaire reste identique à aujourd'hui.

### Affichage dans la liste des produits

Si `tailleConditionnement` est défini, afficher une petite indication sous le nom du produit :
`Paquet de X unités`

---

## Flux de données

```
Utilisateur saisit tailleConditionnement = 12
Utilisateur saisit nombrePaquets = 3
→ quantite calculée = 3 × 12 = 36
→ Produit enregistré avec quantite: 36, tailleConditionnement: 12
```

---

## Ce qui ne change pas

- Le type `Vente` et le hook `useVentes` : aucun changement
- La déduction de stock sur vente : toujours en unités
- Les alertes de stock bas : toujours basées sur `quantite` en unités
- Les calculs de marges : inchangés
- Les produits existants sans `tailleConditionnement` : comportement identique

---

## Fichiers à modifier

1. `backend/types.ts` — ajouter `tailleConditionnement?: number`
2. `lib/hooks/useStock.ts` — inclure `tailleConditionnement` dans `ajouterProduit`
3. `app/stock/page.tsx` — ajouter champ + logique calculateur dans le formulaire
