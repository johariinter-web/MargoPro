# Blocage des fonctionnalités Premium (Chantier A/B — écrans verrouillés)

**Date :** 2026-08-07
**Statut :** Approuvé
**Contexte :** Depuis le lancement, rien n'est réellement réservé au Premium dans le code à part la limite de 5 produits (`usePlan().canAddProduct`, déjà en place). La page `/abonnement` liste pourtant Photos & Catalogue, Marges & stock mort, Fournisseurs, Sauvegarde cloud comme avantages Premium — c'est du texte marketing jamais appliqué. Juanita veut que payer débloque réellement quelque chose. Décidé conjointement le 2026-08-07 : Marges (%Marge) reste gratuit pour tous (connaître ses marges est jugé essentiel, pas un luxe) ; Stock mort, Fournisseurs, Carnet, Packs, Historique des ventes (semaine/mois) + suppressions, et Alertes de stock bas deviennent Premium. La synchro photos/sauvegarde cloud est un chantier séparé (B), pas couvert ici.

## Problème

Aucune des fonctionnalités listées ci-dessus ne vérifie `usePlan()` aujourd'hui (confirmé par recherche dans le code : seul `frontend/app/stock/page.tsx` + `frontend/components/EcranExpiration.tsx` utilisent `usePlan`/`canAddProduct`/`isPremium`). Un compte gratuit dont l'essai est terminé a un accès identique à un compte Premium payant sur tout le reste de l'app.

## Design

### Règle d'accès

Un compte a accès aux fonctionnalités listées ci-dessous si `usePlan().status !== 'expired'` — c'est-à-dire pendant les 30 jours d'essai gratuit (`'trial'`/`'warning'`) ET pour un compte Premium payant (`'premium'`), exactement comme la limite de 5 produits déjà en place. Seul un compte dont l'essai est terminé et qui n'a pas payé (`'expired'`) est restreint.

### Composant réutilisable : `<AccesPremiumRequis>`

Un nouveau composant (`frontend/components/AccesPremiumRequis.tsx`), utilisé partout où un blocage est nécessaire. Style carte intégrée à la page (pas une modale, pas un écran plein comme `EcranExpiration` — celui-ci reste dédié à son propre cas, la limite de 5 produits). Contenu : icône, titre de la fonctionnalité, une ligne d'explication, bouton "Passer au Premium" qui ouvre la modale déjà existante `ModalUpgrade` (routée vers `/abonnement`, déjà branchée sur le vrai paiement FedaPay).

### Comportement par fonctionnalité

**Blocage simple (carte à la place du contenu, rien à consulter avant) :**
- **Stock mort** (`frontend/app/stock/page.tsx`, onglet `vueStock === 'mort'`) — vue de calcul sans données propres à conserver, blocage direct.
- **Alertes de stock bas** (`frontend/app/alertes/page.tsx`) — page dédiée, blocage direct de toute la page.

**Blocage avec consultation possible si des données existent déjà (aucun compte n'a de données aujourd'hui, mais le code doit gérer ce cas dès maintenant pour ne jamais faire disparaître les données d'un Premium qui laisse expirer son abonnement) :**
- **Packs** (`frontend/app/stock/page.tsx`, onglet `vueStock === 'packs'`, hook `usePacks()`) — si `packs.length === 0` → carte de blocage ; sinon la liste reste consultable, mais le bouton "Créer un pack" (ligne ~1177-1182) est désactivé/grisé avec le même message d'incitation.
- **Fournisseurs** (`frontend/components/Fournisseurs.tsx`, hook `useFournisseurs()`) — même logique : si `fournisseurs.length === 0` → carte de blocage ; sinon liste consultable, bouton "Ajouter un fournisseur" (ligne ~54/87) désactivé.
- **Carnet** (`frontend/app/ventes/page.tsx`, onglet `onglet === 'carnet'`, données `credits`/`soldes` de `useVentes()`) — si `credits.length === 0` → carte de blocage ; sinon liste consultable en lecture seule.

### Vente à crédit désactivée pour le gratuit

Dans le formulaire de nouvelle vente (`frontend/app/ventes/page.tsx`), l'option "Vente à crédit" (mode de règlement) est désactivée/grisée pour un compte sans accès — avec une info courte du type "Passe au Premium pour vendre à crédit". Seul le comptant reste disponible. Évite qu'un compte gratuit crée des créances qu'il ne peut ensuite plus consulter (Carnet bloqué).

### Historique des ventes — restriction partielle, pas un blocage total

Dans `frontend/app/ventes/page.tsx`, le sélecteur de période (pastilles Jour/Semaine/Mois, lignes ~439-454) : "Jour" reste toujours cliquable pour tous. "Semaine" et "Mois" sont désactivés/grisés pour un compte sans accès, avec le même message d'incitation au clic (pas de carte plein écran — l'onglet Ventes reste utilisable, seule la période change).

### Suppression de ventes — désactivée pour le gratuit

Le bouton "Supprimer cette vente" (bottom sheet, `frontend/app/ventes/page.tsx` lignes ~223-232) et la suppression définitive dans l'historique des suppressions (lignes ~82-89, ~244-324) sont désactivés/grisés pour un compte sans accès, même message d'incitation.

### Hors scope pour ce chantier

- Photos synchro cloud + Sauvegarde cloud multi-appareils (Chantier B, séparé — mécanisme différent : comportement de synchronisation en arrière-plan, pas un écran).
- Marges (%Marge) et Stock mort... non — **Marges reste gratuit**, seul Stock mort est concerné par ce chantier (voir ci-dessus). Précision pour éviter toute ambiguïté au moment du plan : ne jamais toucher à `frontend/app/marges/page.tsx` dans ce chantier, ce fichier reste inchangé.
- Onglet "Pluriels" (déjà caché de l'UI, hors scope, ne pas le réactiver par erreur en touchant `marges/page.tsx`).

## Ce qui change dans le code (aperçu, détail dans le plan)

- **Nouveau** `frontend/components/AccesPremiumRequis.tsx` — carte de blocage réutilisable.
- **Modifié** `frontend/app/stock/page.tsx` — Stock mort (blocage simple), Packs (blocage conditionnel + bouton désactivé).
- **Modifié** `frontend/components/Fournisseurs.tsx` — blocage conditionnel + bouton désactivé.
- **Modifié** `frontend/app/ventes/page.tsx` — Carnet (blocage conditionnel), option crédit désactivée dans le formulaire, période Semaine/Mois désactivée, suppression de vente désactivée (normale + définitive).
- **Modifié** `frontend/app/alertes/page.tsx` — blocage simple de toute la page.
- **Inchangé** `frontend/app/marges/page.tsx` — reste 100% gratuit, aucune modification.

## Étape manuelle (hors code)

Aucune — pas de migration Supabase, pas de nouvelle variable d'environnement.
