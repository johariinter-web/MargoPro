# Design : Modifier un produit depuis l'onglet Stock

**Date :** 2026-05-30
**Statut :** Approuvé

---

## Contexte

L'onglet Stock ne permet actuellement que la suppression des produits (bouton ×). Si un commerçant fait une erreur de saisie (mauvais prix, mauvaise quantité, nom incorrect), il doit supprimer et recréer le produit. On ajoute une fonctionnalité d'édition par tap sur la carte.

Note : la suppression d'une vente restaure déjà le stock automatiquement via `supprimerVente` dans `useVentes.ts` — aucun changement nécessaire côté ventes.

---

## Périmètre

- Tap sur une carte produit (hors bouton ×) → bottom sheet d'édition pré-rempli
- Tous les champs modifiables : nom, tailleConditionnement, quantite, prixAchat, prixVente, seuilAlerte, codeBarres, categorie
- Sauvegarde via `modifierProduit` (déjà disponible dans `useStock`)
- Un seul fichier modifié : `app/stock/page.tsx`

---

## Interface utilisateur

### Déclencheur

Tapper n'importe où sur la carte produit, sauf le bouton × de suppression, ouvre le bottom sheet d'édition. Le bouton × garde son comportement actuel (suppression immédiate).

### Bottom sheet d'édition

- Apparaît en bas de l'écran avec fond semi-transparent (même style que le modal Détail existant)
- Titre : "Modifier le produit"
- Champs pré-remplis dans cet ordre :
  1. Nom du produit
  2. Unités par paquet (optionnel) — `tailleConditionnement`
  3. Quantité en stock — `quantite` (valeur actuelle en unités, pas de calcul par paquets en mode édition)
  4. Prix d'achat
  5. Prix de vente
  6. Seuil d'alerte
  7. Code-barres (optionnel)
  8. Catégorie (avec chips de sélection)
- Deux boutons : "Annuler" (ferme sans sauvegarder) et "Enregistrer" (appelle `modifierProduit`)
- Message d'erreur si la validation échoue (même pattern que le formulaire d'ajout)

### État local

Un nouvel état `produitEnEdition: Produit | null` contrôle l'affichage du bottom sheet. `null` = fermé, `Produit` = ouvert avec ce produit. Les champs du formulaire d'édition sont dans un état séparé `champsEdition` (même structure que `CHAMPS_VIDES`).

---

## Données

### Lecture

Les champs sont initialisés depuis le produit cliqué : `champsEdition = { nom: produit.nom, quantite: String(produit.quantite), ... }`.

### Écriture

À la sauvegarde, `modifierProduit(produitEnEdition.id, data)` est appelé. Le hook valide et met à jour Dexie. En cas d'erreur retournée, elle s'affiche dans le formulaire.

### Validation

Réutilise `validerProduit` via le hook `modifierProduit` existant. Aucune logique de validation nouvelle.

---

## Ce qui ne change pas

- `useStock`, `backend/types.ts`, `backend/stock.ts` : inchangés
- Le bouton × de suppression : inchangé
- Le formulaire d'ajout "Nouveau produit" : inchangé
- Toutes les autres pages : inchangées

---

## Fichiers à modifier

1. `app/stock/page.tsx` — ajouter état `produitEnEdition` + `champsEdition`, rendre la carte cliquable, ajouter le bottom sheet d'édition
