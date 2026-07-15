# Fournisseurs — description de commande + suppression

**Date :** 2026-07-15
**Statut :** Approuvé
**Contexte :** évolution de [2026-07-14-fournisseurs-design.md](2026-07-14-fournisseurs-design.md), à la lumière du premier usage réel par Juanita.

## Problème

Deux manques repérés en utilisant la fonctionnalité Fournisseurs pour de vrai :

1. Une commande n'a qu'un montant global — impossible de noter ce qui est commandé (ex : un fournisseur de chaussures vend plusieurs sortes — babouches, talons compensés — et Juanita ne peut pas préciser laquelle une commande donnée concerne).
2. Aucun moyen de supprimer une commande de l'historique si elle n'est plus utile.

## Design

### Nouveaux champs sur `Commande` (optionnels)

- `description` (texte libre, optionnel) — ex : "Babouches", ou juste "Chaussures" si Juanita ne veut pas préciser. Aucune contrainte de format, aucune liste prédéfinie.
- `quantite` (nombre, optionnel)

Les deux restent optionnels : une commande sans description/quantité reste valide exactement comme avant (montant global seul), pour ne rien casser sur les commandes déjà enregistrées.

Une commande reste **un seul article à la fois** (pas de panier multi-articles) — si Juanita commande deux sortes de chaussures le même jour chez le même fournisseur, elle crée deux commandes séparées. Décision actée pendant le brainstorm : garder le formulaire rapide à remplir plutôt que d'introduire un système de lignes multiples.

### Formulaire "Nouvelle commande"

Ajoute deux champs à celui existant (date de commande, délai, montant) :
- Description (optionnel)
- Quantité (optionnel)

### Affichage dans l'historique

Chaque ligne de commande affiche la description (si renseignée) en plus du montant et de la quantité — ex : "Babouches · 50 unités · 150 000 FCFA". Si aucune description n'a été saisie, l'affichage reste comme avant (juste le montant).

### Suppression d'une commande — sélection unique

Même pattern que la sélection des appareils connectés dans Paramètres (voir [2026-07-10-appareils-selection-unique-design.md](2026-07-10-appareils-selection-unique-design.md)) : taper une commande dans l'historique la **sélectionne** (état radio, une seule à la fois — retaper la même ligne désélectionne). Un seul bouton **"Supprimer"** apparaît sous la liste quand une commande est sélectionnée, avec confirmation avant l'action. Pas de bouton par ligne — évite d'encombrer visuellement une liste qui peut contenir beaucoup de commandes.

La fonction `supprimerCommande` existe déjà dans `useFournisseurs()` (créée à la Task 3 du chantier précédent, jamais branchée à une UI) — cette tâche l'utilise enfin.

### Technique

- `Commande` (`backend/types.ts`) : ajoute `description?: string` et `quantite?: number`. Champs non indexés dans Dexie → **aucune nouvelle version de schéma nécessaire**, ils se stockent automatiquement sur les objets existants.
- `CommandeRow`/`commandeToRow`/`rowToCommande` (`lib/sync.ts`) : ajoute les colonnes correspondantes (`description`, `quantite`).
- Migration Supabase supplémentaire : `alter table public.commandes add column if not exists description text, add column if not exists quantite numeric;` — à exécuter par Juanita.
- `FournisseurFiche.tsx` : formulaire de commande étendu, affichage historique étendu, ajoute un état de sélection unique sur les lignes de commande + une barre d'action "Supprimer" (avec confirmation) qui apparaît quand une commande est sélectionnée. Le bouton "Marquer reçue" par ligne reste inchangé, indépendant de cette sélection.

## Hors scope (toujours)

- Panier multi-articles dans une seule commande — reconfirmé hors scope pendant ce brainstorm aussi
- Liste de descriptions prédéfinies/autocomplete — texte libre uniquement
