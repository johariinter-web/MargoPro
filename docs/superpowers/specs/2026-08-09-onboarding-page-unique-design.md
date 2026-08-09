# Onboarding en une seule page

**Date :** 2026-08-09
**Statut :** Approuvé
**Contexte :** L'onboarding actuel (`frontend/app/onboarding/page.tsx`) demande 3 étapes successives (nom du commerce → devise → récap + CGU) avant d'accéder à l'application. Juanita veut réduire les étapes pour les nouveaux abonnés.

## Problème

- 3 étapes pour ne recueillir que 2 informations réellement nécessaires (nom du commerce, devise) — la 3e étape ne collecte rien, elle affiche un récap et fait re-cocher les CGU.
- Les CGU sont déjà obligatoires à l'inscription (`frontend/app/auth/page.tsx`, case à cocher `cguAccepte` déjà requise avant de pouvoir créer un compte) — les re-demander à l'onboarding est redondant.
- La liste de fonctionnalités affichée à l'étape 3 ("Gérez votre stock", "Calculez vos marges", "Suivez vos ventes", "Fonctionne sans internet") ne couvre pas toutes les fonctionnalités réelles de l'app, et la page Abonnement fait déjà ce travail de présentation complète — la garder à jour à deux endroits serait une charge inutile.
- Le composant contient aussi un écran "slide" (illustration + "Scanne, enregistre, c'est tout") qui n'est en réalité jamais atteint : `phase` démarre directement à `'form'` et rien ne le remet à `'slide'`. Code mort à l'intérieur du même fichier qu'on réécrit de toute façon.

## Design

### Une seule page, deux champs

La page d'onboarding devient un formulaire unique :
1. Logo MargoPro + titre "Bienvenue sur MargoPro" + sous-titre "Gérez votre commerce simplement, même sans internet." (repris tel quel de l'étape 1 actuelle)
2. Champ **"Comment s'appelle ton commerce ?"** — texte libre, identique au champ actuel de l'étape 1 (style, placeholder "Ex: Boutique Aminata", `autoFocus`)
3. Champ **"Quelle devise tu utilises ?"** — menu déroulant natif (`<select>`), remplace la liste de boutons actuelle
4. Bouton **"Commencer"** — désactivé tant que le nom du commerce est vide ou qu'aucune devise n'est sélectionnée

Pas de barre de progression (plus d'étapes à indiquer), pas de bouton "Retour" (rien à quoi revenir).

### Supprimé

- L'écran de récap "C'est parti, {nom} !" et la liste des 4 fonctionnalités.
- La case à cocher CGU (déjà gérée à l'inscription — voir Problème ci-dessus).
- La barre de progression à 3 pastilles.
- Le code de l'écran "slide" jamais affiché (`phase`, `_Slide0Ill`, et tout le bloc `if (phase === 'slide')`).

### Menu déroulant des devises

Les 7 devises actuelles (`DEVISES`) restent toutes, sans exception — y compris XAF (zone CEMAC) que Juanita ne dessert pas encore activement aujourd'hui, gardée "au cas où" un client de cette zone s'inscrive quand même.

Deux des sept devises (XOF et XAF) partagent le même symbole affiché "FCFA" — pour ne pas les confondre dans un menu déroulant natif (qui n'affiche qu'une ligne par option, contrairement aux cartes actuelles avec description), chaque option précise la région entre parenthèses :

- `FCFA (UEMOA — Sénégal, Côte d'Ivoire, Mali...)`
- `FCFA (CEMAC — Cameroun, Gabon, Congo...)`
- `GNF — Guinée`
- `FC — RDC`
- `Ar — Madagascar`
- `MAD — Maroc`
- `TND — Tunisie`

Les 5 devises à symbole unique gardent un format court `SYMBOLE — Pays`, sans ambiguïté possible.

### Comportement à la soumission

Inchangé : au clic sur "Commencer", `saveConfig({ nomCommerce, devise: devise.code, symboleDevise: devise.symbole, onboardingComplete: true })` puis redirection vers `/`. La logique de consommation du code de parrainage (`consumeReferralCode`, dans le `useEffect` au montage) reste également inchangée.

### Hors scope

- Tout changement à la page Abonnement (déjà à jour, gère la présentation complète des fonctionnalités).
- Tout changement au flux d'inscription (`frontend/app/auth/page.tsx`) — les CGU y restent exactement comme aujourd'hui.
- Ajout ou retrait de devises dans la liste `DEVISES` — décision produit remise à plus tard si Juanita étend sa couverture géographique (ex: nouvel intégrateur de paiement pour la zone CEMAC).

## Ce qui change dans le code

- **Modifié** `frontend/app/onboarding/page.tsx` — remplace les 3 étapes (`phase`, `etape`, le bloc `slide`, `_Slide0Ill`) par un unique formulaire à 2 champs. `terminer()` reste identique. Le `useEffect` de parrainage reste identique.
- Aucun autre fichier touché — pas de migration Supabase, pas de changement de schéma (`onboardingComplete`, `nomCommerce`, `devise`, `symboleDevise` existent déjà dans `config`).
