# Mot de passe oublié

**Date :** 2026-07-14
**Statut :** Approuvé
**Contexte :** l'app n'a aucun moyen de réinitialiser un mot de passe. Repéré en aidant Juanita à créer manuellement un compte gratuit pour quelqu'un via Supabase Dashboard — si elle donne un mot de passe temporaire, la personne ne peut jamais le changer elle-même.

## Problème

`app/auth/page.tsx` ne propose que Connexion / Inscription via `supabase.auth.signInWithPassword` / `signUp`. Aucun lien "mot de passe oublié", aucune page de réinitialisation, aucun appel à `resetPasswordForEmail` ou `updateUser` nulle part dans le code.

## Design

### Parcours utilisateur

1. Sur `/auth` en mode Connexion, un lien **"Mot de passe oublié ?"** apparaît sous le champ mot de passe.
2. Cliquer dessus bascule le formulaire vers un mode "oubli" : un seul champ email + bouton "Envoyer le lien" (les champs mot de passe/CGU du mode connexion disparaissent).
3. Après soumission, message **générique** affiché dans tous les cas (compte existant ou non) : *"Si un compte existe avec cet email, un lien de réinitialisation a été envoyé."* — anti-énumération d'emails, ne jamais révéler si l'email est enregistré.
4. Email envoyé par Supabase (service par défaut, pas de branding MargoPro, pas de config SMTP requise). Lien valable 1h, usage unique (comportement par défaut Supabase, rien à coder).
5. Le lien redirige vers une nouvelle page `/auth/nouveau-mot-de-passe`, où Supabase établit automatiquement une session de récupération à partir du token dans l'URL.
6. La page affiche un formulaire "Nouveau mot de passe" + "Confirmer" (mêmes règles que l'inscription : 6 caractères minimum, les deux champs doivent correspondre).
7. Validation → `supabase.auth.updateUser({ password })` → session de récupération devient une session normale → redirection automatique vers `/` (tableau de bord), sans reconnexion manuelle.

### Cas d'erreur

Si `/auth/nouveau-mot-de-passe` est ouverte sans session de récupération valide (lien expiré, déjà utilisé, ou visite directe de l'URL) : message clair *"Ce lien n'est plus valide."* + bouton **"Demander un nouveau lien"** qui ramène à `/auth` en mode "oubli" (étape 2). Pas de cul-de-sac — la personne peut toujours recommencer le parcours depuis le début.

### Sécurité

Tout repose sur les mécanismes intégrés de Supabase Auth, aucune logique de sécurité custom à écrire :
- Message générique anti-énumération (étape 3)
- Rate limiting intégré à Supabase sur l'envoi d'emails d'auth (quelques emails/heure par défaut)
- Token de récupération à usage unique, expiration 1h
- Mot de passe : mêmes règles de validation que l'inscription existante (`password.length >= 6`)

## Ce qui change dans le code

- **`frontend/app/auth/page.tsx`** : ajoute un troisième `Mode` (`'oubli'` en plus de `'connexion'`/`'inscription'`) avec son propre sous-formulaire (email seul) et son propre appel `supabase.auth.resetPasswordForEmail(email, { redirectTo: ... })`. Le lien "Mot de passe oublié ?" n'apparaît qu'en mode `'connexion'`.
- **`frontend/app/auth/nouveau-mot-de-passe/page.tsx`** (nouveau fichier) : détecte la session de récupération (écoute `onAuthStateChange` pour l'événement `PASSWORD_RECOVERY`, ou vérifie la session au montage), affiche le formulaire nouveau mot de passe + confirmation, appelle `supabase.auth.updateUser({ password })`, gère le cas "lien invalide".

## Étape manuelle (hors code)

Juanita doit ajouter l'URL `https://margopro.eidma.co/auth/nouveau-mot-de-passe` (et l'équivalent localhost pour les tests) dans **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**. Sans ça, Supabase refuse de rediriger vers cette page après clic sur le lien email. Comme les migrations SQL, c'est une action à faire une seule fois dans le dashboard.
