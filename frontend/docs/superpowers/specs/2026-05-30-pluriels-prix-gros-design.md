# Design : Pluriels — Prix en gros à la volée

**Date :** 2026-05-30
**Statut :** Approuvé

---

## Contexte

L'onglet "Pluriels" dans la page Marges affiche actuellement "Bientôt disponible". Les commerçants vendent parfois en gros à un prix différent du prix unitaire normal. Plutôt que de configurer des paliers complexes, on ajoute un champ optionnel dans les ventes et un calculateur de référence dans l'onglet Pluriels.

---

## Périmètre

- Ajout d'un champ "prix gros" optionnel dans le formulaire de vente (`app/ventes/page.tsx`)
- Remplacement du placeholder "Bientôt disponible" dans l'onglet Pluriels (`app/marges/page.tsx`)
- Aucun changement au modèle de données (le type `Vente` et `Produit` restent intacts)

---

## Partie 1 : Champ "Prix gros" dans les ventes

### Comportement

Dans le formulaire "Enregistrer une vente" :
- Ajouter un champ texte optionnel **"Prix unitaire gros (optionnel)"** après le champ Quantité
- Si ce champ est vide ou égal à 0 : la vente s'enregistre avec `produit.prixVente` (comportement actuel inchangé)
- Si ce champ est rempli avec une valeur > 0 : la vente s'enregistre avec ce prix gros comme `prixVente`
- Le bénéfice affiché en aperçu et enregistré se calcule avec le prix gros : `(prixGros - prixAchat) × quantite`
- Le champ se vide lors du reset du formulaire

### Aperçu en temps réel

Le bloc d'aperçu existant (Total + Bénéfice) se met à jour en temps réel quand le prix gros est saisi.

---

## Partie 2 : Onglet Pluriels dans Marges

### Comportement

Remplacer le placeholder par un calculateur de référence :

- Liste de tous les produits du stock
- Pour chaque produit : nom, prix de vente normal, prix d'achat
- Un champ "Qté" et un champ "Prix gros/unité" inline
- Affichage en temps réel du total et du bénéfice pour ces valeurs
- Aucune vente n'est enregistrée depuis cet écran — c'est uniquement un outil de calcul

### État local

L'état des champs (quantité, prix gros) est local à chaque ligne via `useState` dans un sous-composant `LignePluriels`. Il n'est pas persisté.

---

## Ce qui ne change pas

- Le type `Vente` : inchangé. `prixVente` dans une vente gros contiendra simplement le prix gros saisi.
- Le type `Produit` : inchangé.
- `useVentes` et `useStock` : inchangés.
- L'onglet `%Marge` et le calculateur existant dans Marges : inchangés.

---

## Fichiers à modifier

1. `app/ventes/page.tsx` — ajouter champ prix gros + mise à jour de l'aperçu et de `handleVente`
2. `app/marges/page.tsx` — remplacer le placeholder Pluriels par le calculateur
