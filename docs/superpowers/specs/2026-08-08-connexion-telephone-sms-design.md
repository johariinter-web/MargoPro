# Connexion par numéro de téléphone (SMS)

**Date :** 2026-08-08
**Statut :** Approuvé
**Contexte :** MargoPro n'accepte aujourd'hui que la connexion par email + mot de passe (`frontend/app/auth/page.tsx`). Beaucoup de commerçants ciblés en Afrique francophone n'ont pas de compte email/Gmail, mais ont tous un téléphone — l'email seul est un frein réel à l'inscription. Juanita veut ajouter le numéro de téléphone comme identifiant alternatif, sans retirer l'email existant (les deux doivent coexister).

## Problème

- Aucun champ téléphone n'existe aujourd'hui dans le modèle de compte (`auth.users` ou `public.config`).
- Un SMS envoyé à chaque connexion serait bien trop cher (0,03 $ à 0,55 $ selon le fournisseur et le pays — jusqu'à 300 FCFA par SMS chez Twilio) pour un usage répété plusieurs fois par jour.
- FedaPay (déjà utilisé pour les paiements) ne propose aucun service SMS — vérifié directement dans sa documentation officielle.

## Design

### Règle centrale : un seul SMS par abonné, jamais plus

Le SMS ne sert **qu'une fois**, à l'inscription, pour vérifier que le numéro appartient bien à la personne. Toutes les connexions suivantes se font avec **numéro + mot de passe**, exactement comme email + mot de passe aujourd'hui — aucun SMS à chaque connexion.

Le seul autre cas où un SMS est renvoyé : mot de passe oublié (rare, pas systématique — équivalent du lien de réinitialisation par email actuel).

### Fournisseur SMS : Africa's Talking

Compte créé par Juanita, tarif de base confirmé à **0,05 $ par SMS (~30 FCFA)**, largement suffisant pour couvrir ses 8 pays cibles (zone UEMOA/FCFA XOF : Bénin, Burkina Faso, Côte d'Ivoire, Guinée-Bissau, Mali, Niger, Sénégal, Togo). Fournisseur établi et documenté, préféré à des alternatives moins chères mais non vérifiées (ex. "A2P Pro", trouvé uniquement via un site de comparaison tiers, jamais validé indépendamment).

**Piste écartée pour l'instant :** WhatsApp Business API — nécessite un numéro dédié neuf (pas le numéro WhatsApp actuel de contact), une vérification d'entreprise Meta Business (5 jours à 8 semaines selon les documents disponibles), et l'approbation de modèles de message. Beaucoup trop lourd pour être fait "aujourd'hui" ; reste une option pour plus tard si Juanita le souhaite.

### Architecture technique

Supabase Auth gère nativement la connexion par téléphone + mot de passe (`signUp({ phone, password })`, `signInWithPassword({ phone, password })`, `verifyOtp({ phone, token, type: 'sms' })`) — même mécanisme de session/sécurité que l'email actuel, rien à réinventer.

Il ne manque qu'un "messager" : Supabase a un mécanisme **Send SMS Hook** qui appelle une URL HTTP de notre choix chaque fois qu'un SMS doit être envoyé. On crée une nouvelle route API Next.js (même pattern que `frontend/app/api/webhooks/fedapay/route.ts`) qui reçoit cet appel et le relaie vers l'API d'Africa's Talking, en utilisant une clé API stockée dans les variables d'environnement Vercel (jamais exposée côté client).

Supabase gère tout le reste (création du compte, génération et vérification du code, sécurité, session) — Africa's Talking ne fait qu'envoyer le SMS.

La nouvelle route doit vérifier que chaque appel vient bien de Supabase (signature du hook, même principe que la vérification déjà en place sur `frontend/app/api/webhooks/fedapay/route.ts`) avant de relayer quoi que ce soit à Africa's Talking — sans ça, n'importe qui découvrant l'URL pourrait déclencher l'envoi de SMS payants à volonté, à la charge de Juanita.

### Coexistence avec les comptes existants et "Appareils connectés"

Un compte = un seul identifiant (email OU téléphone), choisi à l'inscription, lié à un seul abonnement. Rien ne change pour le partage entre appareils : plusieurs personnes peuvent continuer à se connecter avec le **même** identifiant + mot de passe sur leurs propres téléphones (fonctionnalité "Appareils connectés" déjà existante, indépendante du choix email/téléphone). Un nouveau numéro de téléphone qui s'inscrit crée un nouveau compte séparé, avec son propre abonnement — exactement comme un nouvel email aujourd'hui.

### Écrans

Sur `frontend/app/auth/page.tsx`, un choix **"Email" / "Téléphone"** en haut du formulaire change simplement le champ affiché (le champ email devient un champ numéro de téléphone). Le reste du formulaire (mot de passe, CGU, bouton) reste identique pour les deux modes.

Pour l'inscription par téléphone spécifiquement, une étape supplémentaire après avoir saisi numéro + mot de passe :
1. Un SMS est envoyé avec un code à 6 chiffres.
2. Un nouvel écran affiche 6 cases pour saisir le code.
3. Code correct → compte activé → redirection vers le tableau de bord (même comportement qu'après confirmation email aujourd'hui).
4. Un lien "Je n'ai pas reçu le code, renvoyer" est disponible, limité à un renvoi par minute (empêche qu'un clic répété — volontaire ou accidentel — déclenche l'envoi de nombreux SMS payants pour une seule inscription).

### Cas d'erreur à gérer

- Numéro déjà utilisé par un autre compte → message clair, comme pour un email déjà pris.
- Code SMS incorrect → message d'erreur, nouvelle saisie possible.
- Code expiré → bouton "Renvoyer" disponible (respecte la limite d'une minute).
- Renvoi trop fréquent → bouton désactivé jusqu'à la fin du délai.
- Échec d'envoi côté Africa's Talking (panne, etc.) → message d'erreur clair ; aucun compte à moitié créé qui bloquerait une réinscription ultérieure avec le même numéro.

### CGU à mettre à jour

`frontend/app/cgu/page.tsx`, section 2 ("Accès au service") dit actuellement : *"L'accès à MargoPro nécessite la création d'un compte via une adresse email et un mot de passe."* — à reformuler pour inclure le numéro de téléphone comme alternative.

### Hors scope pour ce chantier

- WhatsApp Business API (voir ci-dessus, piste pour plus tard).
- Toute modification du flux email existant.
- Toute modification de "Appareils connectés", déjà indépendant de l'identifiant utilisé.

## Ce qui change dans le code (aperçu, détail dans le plan)

- **Modifié** `frontend/app/auth/page.tsx` — choix Email/Téléphone, écran de saisie du code SMS, gestion du renvoi limité.
- **Modifié** `frontend/app/cgu/page.tsx` — section 2 mise à jour.
- **Nouveau** une route API Next.js (Send SMS Hook) qui relaie vers Africa's Talking.
- **Configuration Supabase (hors code)** : activer l'authentification par téléphone, configurer le Send SMS Hook vers la nouvelle route.

## Étapes manuelles (hors code)

- Compte Africa's Talking déjà créé par Juanita ; recharger le portefeuille prépayé d'un petit montant avant les premiers tests réels (le solde n'expire jamais).
- Récupérer la clé API Africa's Talking et l'ajouter aux variables d'environnement Vercel.
- Activer la connexion par téléphone dans le tableau de bord Supabase (Authentication) et configurer le Send SMS Hook vers la nouvelle route une fois déployée.
