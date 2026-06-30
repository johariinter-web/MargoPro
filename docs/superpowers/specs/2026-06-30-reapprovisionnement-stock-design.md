# Réapprovisionnement du stock — Design

**Date :** 2026-06-30
**Statut :** Validé (en attente relecture utilisatrice)

## Problème

Quand un produit est en stock bas, le seul moyen de le réapprovisionner est
d'ouvrir « Modifier le produit » et de changer le champ « Quantité en stock ».
Ce champ **remplace** la valeur : la commerçante doit donc calculer elle-même
`stock restant + marchandise reçue` et taper le total. C'est lent et source
d'erreurs en boutique.

## Objectif

Permettre d'**ajouter** la marchandise reçue au stock existant, sans calcul
mental, sans confondre avec la correction d'un total.

## Périmètre

- **Inclus :** un encadré « J'ai reçu de la marchandise » dans la fenêtre
  « Modifier le produit » de la page Stock.
- **Exclu :** aucun changement aux ventes, au tableau de bord, à la sync, ni à
  la liste des produits. Pas d'historique des réceptions (v2 éventuelle).

## Comportement détaillé

L'encadré apparaît dans le bottom sheet « Modifier le produit », visuellement
distinct (fond/bordure accent vert), entre le champ « Quantité » et le champ
« Prix d'achat ».

Champs de l'encadré :

1. **Quantité reçue** — saisie « intelligente », identique à l'ajout d'un
   produit :
   - Si le produit a une `tailleConditionnement` > 0 → libellé
     « Paquets reçus », et affichage en direct du calcul
     `n paquets × taille = X unités ajoutées ».
   - Sinon → libellé « Unités reçues ».
2. **Nouveau prix d'achat (optionnel)** — placeholder = prix d'achat actuel.
   Laissé vide = prix inchangé.

Bouton **« Ajouter au stock »** :

- Calcule la quantité reçue en unités
  (`reçu × tailleConditionnement` si paquets, sinon `reçu`).
- **Additionne** au champ « Quantité » du formulaire (qui s'exprime déjà en
  paquets ou en unités selon le produit) → le champ affiche le nouveau total.
- Si un nouveau prix d'achat est renseigné, remplit le champ « Prix d'achat »
  du formulaire avec cette valeur.
- Vide les champs de l'encadré et affiche une confirmation courte
  (ex. « +24 unités → 27 au total »).

Le bouton **« Enregistrer »** existant valide l'ensemble (réappro + toute autre
correction) via `modifierProduit`. Un seul point de sauvegarde, aucune
double-validation.

## Principe clé : ajouter vs corriger

| Élément | Rôle | Effet sur la quantité |
|---|---|---|
| Champ « Quantité en stock » | Corriger une erreur de comptage | Remplace le total |
| Encadré « J'ai reçu… » | Enregistrer une réception | Additionne au total |

Les deux sont séparés visuellement pour éviter toute confusion.

## Implémentation (vue d'ensemble)

- Fichier touché : `frontend/app/stock/page.tsx` (uniquement le bottom sheet
  d'édition `produitEnEdition`).
- Nouvel état local : `champsReappro` (`{ quantite, prixAchat }`) +
  message de confirmation.
- Le bouton « Ajouter au stock » manipule `champsEdition` (quantité, prix
  d'achat) — pas d'appel base de données direct ; la persistance reste via
  `handleEditer` → `modifierProduit`.
- Aucune modification du hook `useStock` ni du backend.

## Validation / cas limites

- Réappro = 0 ou vide → bouton sans effet (pas d'erreur).
- Produit en paquets → l'addition se fait en paquets dans le champ Quantité,
  cohérent avec l'affichage existant.
- Prix d'achat optionnel vide → le champ Prix d'achat n'est pas modifié.
- Annuler ferme le sheet sans rien enregistrer (comportement actuel conservé).
