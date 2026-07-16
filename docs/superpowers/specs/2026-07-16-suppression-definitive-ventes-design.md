# Suppression définitive dans l'historique des ventes supprimées

**Date :** 2026-07-16
**Statut :** Approuvé
**Contexte :** Repéré par Juanita en utilisant le bouton "Historique des suppressions" de l'onglet Ventes — la liste des ventes supprimées n'a aucun moyen de purge, elle grossit indéfiniment.

## Problème

`frontend/app/ventes/page.tsx` a un modal "Historique des suppressions" (`ventesSupprimees`, ventes avec `deleted: true`) purement en lecture seule — aucune action possible dessus. Une vente supprimée normalement (via "Supprimer cette vente" sur une vente active) reste indéfiniment dans cet historique, sans moyen de l'en retirer.

À distinguer de l'existant : juste après une suppression normale, un bandeau "Annuler" apparaît 6 secondes (restauration classique, soft-delete). Ce chantier ne touche pas à ça — il ajoute un second niveau, plus tard et volontaire, pour purger une entrée de l'historique.

## Design

### Comportement

**Suppression définitive** = retirée de l'appareil ET du cloud, irréversible (contrairement à la suppression normale qui ne fait que marquer `deleted: true`, gardée pour permettre l'annulation et rester visible dans l'historique).

**Aucun impact sur les chiffres ou les rapports** : une vente déjà supprimée (normalement) est déjà exclue du chiffre d'affaires, du bénéfice, et de tout rapport exporté (`frontend/app/sauvegarde/page.tsx` utilise le même `useVentes()` qui filtre `!deleted`). La suppression définitive ne fait que vider la liste d'historique elle-même — elle ne change aucun chiffre déjà correct.

**Hors ligne** : l'opération nécessite le réseau (elle supprime d'abord côté Supabase, puis localement seulement si ça réussit). Si hors ligne, message d'erreur clair plutôt que de risquer que la vente "revienne" plus tard via une synchronisation qui la retrouverait encore présente côté cloud.

### UX — même principe que les commandes fournisseur et les appareils connectés

Dans le modal "Historique des suppressions" : taper une vente la **sélectionne** (état radio, une seule à la fois). Un bouton unique **"Supprimer définitivement"** apparaît sous la liste quand une vente est sélectionnée, avec une étape de confirmation avant l'action irréversible.

### Technique

- Nouvelle fonction dans `lib/sync.ts` : appel direct Supabase (`.from('ventes').delete().eq('id', id)`) — la table `ventes` a déjà une policy RLS `for all` (couvre delete), aucune migration Supabase nécessaire.
- Nouvelle fonction dans le hook `useVentes` : tente la suppression cloud d'abord ; si ça échoue (pas de réseau), renvoie une erreur sans rien supprimer localement ; si ça réussit, supprime alors la ligne locale avec un vrai `db.ventes.delete(id)` (pas juste `deleted: true` — sinon elle réapparaîtrait dans l'historique local).
- UI : `frontend/app/ventes/page.tsx`, modal "Historique des suppressions" — ajoute l'état de sélection + la barre d'action.

## Hors scope

- Ne touche pas au bandeau "Annuler" existant (suppression normale, restauration à chaud)
- Ne s'applique qu'aux ventes déjà dans l'historique des suppressions, pas à une vente active
