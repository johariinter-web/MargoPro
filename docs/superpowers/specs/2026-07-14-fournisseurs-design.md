# Fournisseurs

**Date :** 2026-07-14
**Statut :** Approuvé
**Contexte :** Juanita gère souvent plusieurs fournisseurs pour réapprovisionner sa boutique et veut un endroit pour noter leurs coordonnées, leurs conditions de commande, et suivre si une livraison attendue est en retard.

## Problème

MargoPro n'a aucune notion de fournisseur ni de commande fournisseur. Le réapprovisionnement existant (`champsReappro` dans `frontend/app/stock/page.tsx`) ne fait qu'ajouter du stock et changer le prix d'achat — il ne garde aucune trace de qui a fourni quoi, ni de quand la livraison est attendue.

## Design

### Emplacement

Nouvel onglet **"Fournisseurs"** ajouté au sélecteur déjà présent en haut de la page Stock, à côté des onglets existants. Le sélecteur devient : **Produits** (renommé depuis "Mes produits", pour faire de la place) / **Packs** / **Stock mort** / **Fournisseurs**.

### Modèle de données

Deux nouvelles entités, dans le même style que `Produit`/`Vente`/`Pack` (id, updatedAt, deleted, sync Supabase avec RLS par `user_id`) :

**Fournisseur** — conditions fixes, saisies une fois :
- `nom` (obligatoire)
- `contact` (téléphone, **optionnel** — beaucoup de commerçants n'ont pas envie de donner le vrai numéro de leur fournisseur tout de suite)
- `delaiHabituel` (jours, optionnel)
- `montantMinimum` (optionnel) — informationnel seulement, affiché comme rappel ; l'app ne bloque pas la création d'une commande dont le montant est inférieur
- `modePaiement` (texte libre, optionnel — les moyens de paiement varient trop d'un pays à l'autre pour une liste fixe : Mobile Money, Wave, Orange Money, espèces, virement, etc.)

**Commande** — une par livraison attendue, rattachée à un fournisseur (`fournisseurId`) :
- `dateCommande` (aujourd'hui par défaut)
- `delaiJours` (pré-rempli avec `delaiHabituel` du fournisseur si renseigné, modifiable)
- `dateLivraisonPrevue` — **calculée** (`dateCommande + delaiJours`), jamais saisie directement
- `montant`
- `recue` (booléen, `false` par défaut) — passe à `true` via un bouton "Marquer reçue"

Une commande est **en retard** si `!recue && aujourd'hui > dateLivraisonPrevue`.

### Écrans

**Liste des fournisseurs** (contenu de l'onglet Fournisseurs) : lignes compactes façon liste de produits — nom du fournisseur, et un badge 🔴 si ce fournisseur a au moins une commande en retard. Taper une ligne ouvre la fiche complète (nouvelle vue, pas un dépliant sur place — comme pour ouvrir un produit).

**Fiche fournisseur** : ses infos (nom, contact, délai habituel, montant minimum, mode de paiement) en haut, éditables ; bouton **"Nouvelle commande"** ; en dessous, l'historique de ses commandes (plus récente en premier), chaque ligne affichant date de commande, date de livraison prévue, montant, et un badge 🔴 si en retard + bouton "Marquer reçue". Une commande reçue s'affiche visuellement estompée/cochée (même esprit que les crédits soldés du Carnet).

**Formulaire "Nouvelle commande"** (depuis la fiche fournisseur, donc le fournisseur est déjà déterminé) : date de commande, délai en jours (avec la date de livraison prévue affichée en direct au fur et à mesure qu'on tape), montant. 3 champs.

**Formulaire "Nouveau fournisseur" / édition** : nom, contact, délai habituel, montant minimum, mode de paiement. 5 champs, mais seul le nom est obligatoire — les autres peuvent rester vides et être complétés plus tard.

### Alertes

Une commande en retard (voir définition ci-dessus) déclenche :
- Un badge visuel rouge sur sa ligne dans la fiche fournisseur, et sur la ligne du fournisseur dans la liste
- Un rappel sur le tableau de bord (Accueil) — total des commandes en retard, dans le même esprit que les alertes de stock bas déjà présentes sur cet écran

### Technique

- Deux nouvelles tables Dexie (`fournisseurs`, `commandes`) suivant le pattern existant de `db.ts` (nouvelle version de schéma, migration `upgrade()` si besoin)
- Deux nouvelles tables Supabase avec RLS `user_id = auth.uid()`, migration SQL à exécuter par Juanita (comme les précédentes)
- Extension de `lib/sync.ts` (mappers + push/pull) pour ces deux tables, suivant exactement le pattern de `produits`/`ventes`/`packs`
- `clearLocalData()` (ajoutée aujourd'hui pour corriger la fuite de données entre comptes) doit aussi vider ces deux nouvelles tables

## Hors scope (pour l'instant)

- Détail produit par produit dans une commande (juste un montant total) — décidé explicitement pendant le brainstorm
- Liste de modes de paiement prédéfinie — texte libre pour rester flexible entre pays
- Suppression définitive d'un fournisseur ayant des commandes (soft-delete standard suffit, cohérent avec le reste de l'app)
