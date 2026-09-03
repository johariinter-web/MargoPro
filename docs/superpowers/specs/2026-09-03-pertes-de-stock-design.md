# Pertes de stock

**Date :** 2026-09-03
**Statut :** Approuvé
**Contexte :** Suite au chantier "vraie marge et seuil de rentabilité" (livré le 2026-09-02), Juanita veut pouvoir déclarer les produits perdus (abîmés à la livraison, cassés par accident) — de la marchandise déjà payée qui ne peut plus être vendue. Ce n'est ni une vente (aucun argent qui rentre) ni une charge en FCFA (pas une dépense), mais ça représente une vraie perte financière qui doit compter dans le calcul du seuil de rentabilité, sinon "vraie marge" et "seuil de rentabilité" restent faux.

## Problème

Aujourd'hui, MargoPro n'a aucun moyen de retirer du stock autrement que par une vente. Un produit cassé ou abîmé reste soit compté dans le stock (faussant les quantités affichées), soit doit être retiré manuellement en modifiant la quantité du produit (ce qui ne garde aucune trace de la perte et ne l'inclut jamais dans le calcul de rentabilité construit le 2026-09-02).

## Design

### Modèle de données : `Perte`

Nouvelle entité, même style que `Vente` (id, updatedAt, deleted, sync Supabase avec RLS par `user_id`) :
- `produitId`, `produitNom` (comme `Vente`, pour garder le nom même si le produit est renommé/supprimé plus tard)
- `quantite` (obligatoire, > 0)
- `prixAchat` (figé au moment de la déclaration — comme `Vente.prixAchat` — pas recalculé après coup si le prix d'achat du produit change)
- `date` (au moment de la déclaration)

La valeur perdue (`prixAchat × quantite`) se calcule à la volée, jamais stockée séparément — même logique que `Vente.total`/`benefice`, mais calculée par une fonction plutôt que stockée puisqu'il n'y a que ce seul nombre à en tirer (pas besoin de dupliquer le pattern de champs pré-calculés de `Vente`).

**Explicitement exclu :** aucun champ "raison" (abîmé à la livraison / cassé par accident) — décidé explicitement pendant le brainstorm, juste la quantité pour rester ultra-simple.

### Où et comment déclarer une perte

Dans la fiche produit de l'onglet Stock (`frontend/app/stock/page.tsx`), à côté du bouton existant "J'ai reçu de la marchandise" (réapprovisionnement), un nouveau bouton **"J'ai perdu de la marchandise"** — même style visuel (bordure au lieu de fond plein, pour le distinguer visuellement du réapprovisionnement), ouvre une fenêtre du même type :
- Un champ quantité perdue, avec aperçu en direct : "→ -X unités → Y unités restants"
- Validation : la quantité perdue ne peut pas dépasser la quantité actuellement en stock (contrairement au réapprovisionnement qui n'a pas de plafond)
- Bouton "Confirmer la perte" : décrémente le stock du produit (comme une vente, sans CA généré) et crée l'enregistrement `Perte`

Pas de bouton par produit dans la liste, pas de sélecteur de produit séparé — on est déjà sur le bon produit puisqu'on a ouvert sa fiche (décidé explicitement pendant le brainstorm, pour éviter la surcharge visuelle d'un bouton par ligne).

Accès **gratuit**, comme le réapprovisionnement et la gestion de stock en général — seul l'effet sur le calcul de rentabilité reste visible uniquement en Premium (comme aujourd'hui pour le Seuil de rentabilité).

### Intégration dans le Seuil de rentabilité

Dans `frontend/components/SeuilRentabilite.tsx`, la carte "Charges du mois" affiche désormais deux lignes distinctes plutôt qu'un seul total :
- **Dépenses** : le journal existant (loyer, transport...)
- **Pertes de stock** : calculé automatiquement à partir des `Perte` du mois en cours, rien à ressaisir

Les deux sont additionnées pour obtenir le total utilisé dans `margePlancher()` et `objectifVenteParJour()` (mêmes fonctions qu'aujourd'hui, seule la valeur `chargesDuMois` passée en argument change — elle inclut maintenant `totalDepenses(...) + totalPertes(...)`). Les afficher séparément (plutôt que fondues) évite que Juanita se demande d'où vient un montant qu'elle n'a pas saisi elle-même dans le journal de dépenses.

Cette même somme (dépenses + pertes) doit être utilisée partout où `chargesDuMoisCourant` est calculé aujourd'hui : `frontend/components/MargeTab.tsx` (marge plancher, repère, seuil de la liste par catégorie) et `frontend/app/marges/page.tsx` (pré-remplissage et alerte du calculateur "Prix de vente").

### Technique

- Nouvelle table Dexie `pertes` (nouvelle version de schéma dans `frontend/lib/db.ts`, pattern identique à `depenses`/`ventes` : `'id, produitId, date, updatedAt, deleted'`)
- Nouvelle table Supabase `pertes` avec RLS `user_id = auth.uid()`, migration SQL à exécuter par Juanita
- Extension de `lib/sync.ts` (mappers + push/pull, non-fatal try/catch) pour cette table, suivant exactement le pattern de `depenses`
- `clearLocalData()` doit aussi vider `pertes`
- Nouveau `frontend/backend/pertes.ts` : `pertesDuMois` (filtrée sur le mois calendaire en cours, avec la même borne haute que `depensesDuMois` — voir la correction du 2026-09-02 sur les dates non bornées), `totalPertes` — même forme que les fonctions équivalentes de `backend/depenses.ts`, ne pas les dupliquer dans `depenses.ts`. Pas de `validerPerte` séparée : la seule règle métier (quantité perdue ≤ quantité en stock) a besoin du produit courant pour être vérifiée, donc elle vit directement dans le hook `usePertes` (qui a déjà chargé le produit), pas dans une fonction pure isolée comme pour `Depense`
- Nouveau hook `frontend/lib/hooks/usePertes.ts` : CRUD + `deduireStockPourPerte` (décrémente `produit.quantite`, crée la `Perte`, dans une transaction Dexie comme le fait déjà `enregistrerVentePack` pour la cohérence stock+vente)
- `frontend/app/stock/page.tsx` : nouveau bouton + fenêtre "J'ai perdu de la marchandise", même emplacement que le réapprovisionnement
- `frontend/components/SeuilRentabilite.tsx`, `frontend/components/MargeTab.tsx`, `frontend/app/marges/page.tsx` : `chargesDuMoisCourant` devient `totalDepenses(...) + totalPertes(...)`

## Hors scope (pour l'instant)

- Champ "raison" de la perte — décidé explicitement pendant le brainstorm
- Historique/liste consultable des pertes passées (comme l'historique des ventes) — seul le total du mois compte pour l'instant
- Annuler/restaurer une perte déclarée par erreur — pas demandé, à ajouter plus tard si besoin (cohérent avec le fait que les dépenses elles-mêmes n'ont pas de restauration après suppression)
- Pertes calculées automatiquement (ex. péremption détectée) — uniquement déclaratif, à la main, pour l'instant
