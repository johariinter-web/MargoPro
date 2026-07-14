# Mot de passe oublié Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un utilisateur de réinitialiser son mot de passe MargoPro depuis l'écran de connexion, sans intervention manuelle de Juanita.

**Architecture:** Utilise exclusivement les mécanismes intégrés de Supabase Auth (`resetPasswordForEmail` + `updateUser`) — aucune logique de sécurité custom, aucun service d'email tiers. Le client Supabase du projet (`@supabase/ssr` `createBrowserClient`) utilise le flow PKCE avec `detectSessionInUrl: true` par défaut : quand la personne clique le lien reçu par email, Supabase la redirige vers `/auth/nouveau-mot-de-passe?code=...`, et le SDK échange automatiquement ce code contre une session de récupération dès qu'un client Supabase est créé sur cette page — aucun parsing d'URL manuel nécessaire.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase Auth (`@supabase/ssr` v0.10.3, `@supabase/supabase-js` v2.106.1)

## Global Constraints

- `'use client'` obligatoire sur tout fichier utilisant des hooks React ou `window`/`localStorage`
- Inline styles uniquement (aucune classe Tailwind) — suivre le pattern existant de `frontend/app/auth/page.tsx`
- Police : `fontFamily: 'Manrope, sans-serif'`
- Palette locale déjà définie dans `frontend/app/auth/page.tsx` (objet `T` en haut du fichier, PAS `useColors()` — cette page n'a pas de config chargée puisqu'elle précède la connexion)
- Mot de passe : minimum 6 caractères, même règle que l'inscription existante
- Message affiché après une demande de réinitialisation : **toujours le même**, que l'email existe ou non (anti-énumération — ne jamais faire de branchement UI sur le résultat de `resetPasswordForEmail`)
- Pas de commentaires de code sauf si le WHY est non-évident
- Pas de service d'email tiers, pas de branding custom — email Supabase par défaut (décision déjà validée par Juanita)

---

## Fichiers à créer ou modifier

| Action | Fichier | Rôle |
|---|---|---|
| Modifier | `frontend/app/auth/page.tsx` | Ajoute le mode `'oubli'` : lien "Mot de passe oublié ?", formulaire email seul, appel `resetPasswordForEmail` |
| Créer | `frontend/app/auth/nouveau-mot-de-passe/page.tsx` | Détecte la session de récupération, formulaire nouveau mot de passe, appel `updateUser` |

---

## Task 1 : Page `/auth/nouveau-mot-de-passe`

**Files:**
- Create: `frontend/app/auth/nouveau-mot-de-passe/page.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/client` (déjà existant, aucune modification)
- Produces: page Next.js montée sur la route `/auth/nouveau-mot-de-passe`, aucune autre partie du code n'en dépend

- [ ] **Step 1 : Créer le fichier avec la détection de session de récupération et le formulaire**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const T = {
  accent: '#D4601A',
  accentLight: '#FEF0E6',
  bg: '#FAF7F3',
  surface: '#FFFFFF',
  text: '#1C1811',
  textSub: '#6A5D52',
  textMuted: '#9E8E84',
  border: '#E6DDD3',
  redBg: '#FDECEA',
  red: '#C4341A',
};

const inputStyle = {
  width: '100%',
  border: `2px solid ${T.border}`,
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 16,
  color: T.text,
  background: T.surface,
  outline: 'none',
  fontFamily: 'Manrope, sans-serif',
  boxSizing: 'border-box' as const,
};

export default function NouveauMotDePasse() {
  const router = useRouter();
  const [verification, setVerification] = useState(true);
  const [sessionValide, setSessionValide] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let actif = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!actif) return;
      if (event === 'PASSWORD_RECOVERY') {
        setSessionValide(true);
        setVerification(false);
      }
    });

    // Filet de sécurité : si l'échange du code (PKCE) a déjà eu lieu avant
    // que ce composant ne monte, onAuthStateChange ne se redéclenchera pas.
    supabase.auth.getSession().then(({ data }) => {
      if (!actif) return;
      if (data.session) setSessionValide(true);
      setVerification(false);
    });

    return () => { actif = false; subscription.unsubscribe(); };
  }, []);

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) { setErreur('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirmPassword) { setErreur('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    setErreur('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErreur('Erreur lors de la mise à jour. Réessayez.');
      setLoading(false);
      return;
    }
    router.push('/');
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '40px 24px 32px', maxWidth: 400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24, boxSizing: 'border-box' }}>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 72, height: 72, borderRadius: 18, boxShadow: '0 4px 16px rgba(212,96,26,0.18)' }} />
        </div>

        {verification && (
          <p style={{ textAlign: 'center', fontSize: 14, color: T.textMuted, fontFamily: 'Manrope, sans-serif' }}>
            Vérification du lien...
          </p>
        )}

        {!verification && !sessionValide && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif', margin: 0 }}>
              Ce lien n&apos;est plus valide.
            </p>
            <p style={{ fontSize: 13, color: T.textMuted, fontFamily: 'Manrope, sans-serif', margin: 0 }}>
              Il a peut-être expiré ou déjà été utilisé. Tu peux en demander un nouveau.
            </p>
            <button
              onClick={() => router.push('/auth')}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: T.accent, color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Demander un nouveau lien
            </button>
          </div>
        )}

        {!verification && sessionValide && (
          <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif', margin: 0, textAlign: 'center' }}>
              Choisis ton nouveau mot de passe
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répète ton mot de passe"
                autoComplete="new-password"
                required
                style={inputStyle}
              />
            </div>

            {erreur && (
              <p style={{ fontSize: 13, fontWeight: 600, color: T.red, textAlign: 'center', background: T.redBg, borderRadius: 12, padding: '12px 16px', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
                {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: T.accent, color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                opacity: loading ? 0.4 : 1,
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {loading ? '...' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier les types**

```bash
cd frontend && npx tsc --noEmit
```

Attendu : aucune sortie (0 erreur).

- [ ] **Step 3 : Vérifier manuellement l'état "lien invalide"**

```bash
cd frontend && npm run dev
```

Ouvrir `http://localhost:3000/auth/nouveau-mot-de-passe` directement (sans code dans l'URL). Attendu : après un court instant "Vérification du lien...", le message "Ce lien n'est plus valide." apparaît avec le bouton "Demander un nouveau lien" qui ramène vers `/auth`. Arrêter le serveur dev (Ctrl+C) une fois vérifié.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/auth/nouveau-mot-de-passe/page.tsx
git commit -m "feat: page de reinitialisation du mot de passe"
```

---

## Task 2 : Lien "Mot de passe oublié ?" + demande de réinitialisation

**Files:**
- Modify: `frontend/app/auth/page.tsx`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/client` (déjà importé dans ce fichier)
- Produces: aucune interface exportée, page terminale

- [ ] **Step 1 : Étendre le type `Mode` et ajouter les états du mode "oubli"**

Dans `frontend/app/auth/page.tsx`, remplacer :

```typescript
type Mode = 'connexion' | 'inscription';
```

par :

```typescript
type Mode = 'connexion' | 'inscription' | 'oubli';
```

Puis, juste après la ligne `const [showConfirm, setShowConfirm] = useState(false);`, ajouter :

```typescript
  const [oubliEnvoye, setOubliEnvoye] = useState(false);
  const [oubliLoading, setOubliLoading] = useState(false);
```

- [ ] **Step 2 : Ajouter les fonctions de navigation et d'envoi**

Juste après la fonction `basculerMode` existante (celle qui bascule connexion/inscription), ajouter :

```typescript
  function voirOubli() {
    setMode('oubli');
    setErreur('');
    setOubliEnvoye(false);
  }

  function retourConnexion() {
    setMode('connexion');
    setErreur('');
    setOubliEnvoye(false);
  }

  async function envoyerReinitialisation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setOubliLoading(true);
    const supabase = createClient();
    // Le résultat n'est jamais branché dans l'UI (succès ou email inexistant
    // affichent le même message) pour ne jamais révéler si un compte existe.
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/nouveau-mot-de-passe`,
    });
    setOubliLoading(false);
    setOubliEnvoye(true);
  }
```

- [ ] **Step 3 : Cacher le formulaire connexion/inscription en mode "oubli"**

Repérer le bloc `<form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>` (le formulaire principal) et le bloc `<p>` juste après qui contient "Pas encore de compte ?" / "Déjà un compte ?". Ces deux blocs doivent être englobés dans une condition. Remplacer :

```typescript
        {/* Formulaire */}
        <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
```

par :

```typescript
        {/* Formulaire */}
        {mode !== 'oubli' && (
        <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
```

Puis repérer la fermeture `</form>` de ce même formulaire (juste avant le commentaire `{/* Basculer mode */}`) et le `</p>` qui ferme le paragraphe "Pas encore de compte ?". Remplacer :

```typescript
        </form>

        {/* Basculer mode */}
        <p style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, margin: 0, fontFamily: 'Manrope, sans-serif' }}>
          {mode === 'connexion' ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
          <button
            onClick={basculerMode}
            style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
          >
            {mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
```

par :

```typescript
        </form>
        )}

        {/* Basculer mode */}
        {mode !== 'oubli' && (
        <p style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, margin: 0, fontFamily: 'Manrope, sans-serif' }}>
          {mode === 'connexion' ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
          <button
            onClick={basculerMode}
            style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
          >
            {mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
        )}
```

- [ ] **Step 4 : Ajouter le lien "Mot de passe oublié ?" en mode connexion**

Repérer le bloc du champ mot de passe (le `<div>` contenant le `<label>Mot de passe</label>` et son `<input>`), juste avant le bloc `{mode === 'inscription' && (`. Juste après la fermeture de ce bloc mot de passe (son `</div>` de fermeture, avant le `{mode === 'inscription' && (`), insérer :

```typescript
          {mode === 'connexion' && (
            <button
              type="button"
              onClick={voirOubli}
              style={{ alignSelf: 'flex-end', marginTop: -8, color: T.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
            >
              Mot de passe oublié ?
            </button>
          )}
```

- [ ] **Step 5 : Ajouter le bloc JSX du mode "oubli"**

Juste avant la fermeture `</div>` finale du conteneur principal (celle qui suit le bloc "Basculer mode" et précède `</div>\n    </div>\n  );`), ajouter :

```typescript
        {mode === 'oubli' && (
          oubliEnvoye ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6, margin: 0 }}>
                Si un compte existe avec cet email, un lien de réinitialisation a été envoyé. Vérifie ta boîte de réception (et les spams).
              </p>
              <button
                onClick={retourConnexion}
                style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={envoyerReinitialisation} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', margin: 0, textAlign: 'center' }}>
                Entre ton email, on t&apos;envoie un lien pour choisir un nouveau mot de passe.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemple@email.com"
                  autoComplete="email"
                  required
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={!email.trim() || oubliLoading}
                style={{
                  width: '100%', height: 52, borderRadius: 14,
                  background: T.accent, color: '#fff',
                  fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                  opacity: (!email.trim() || oubliLoading) ? 0.4 : 1,
                  fontFamily: 'Manrope, sans-serif',
                }}
              >
                {oubliLoading ? '...' : 'Envoyer le lien'}
              </button>
              <button
                type="button"
                onClick={retourConnexion}
                style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}
              >
                Retour à la connexion
              </button>
            </form>
          )
        )}
```

- [ ] **Step 6 : Vérifier les types**

```bash
cd frontend && npx tsc --noEmit
```

Attendu : aucune sortie (0 erreur).

- [ ] **Step 7 : Vérifier manuellement le parcours de demande**

```bash
cd frontend && npm run dev
```

Ouvrir `http://localhost:3000/auth`. Vérifier :
1. Le lien "Mot de passe oublié ?" apparaît sous le champ mot de passe en mode Connexion, mais pas en mode Inscription.
2. Cliquer dessus fait disparaître le formulaire connexion/inscription et affiche le champ email seul.
3. Taper un email et cliquer "Envoyer le lien" affiche le message de confirmation générique et le bouton "Retour à la connexion".
4. "Retour à la connexion" ramène bien à l'écran de connexion normal.

Arrêter le serveur dev (Ctrl+C) une fois vérifié.

- [ ] **Step 8 : Commit**

```bash
git add frontend/app/auth/page.tsx
git commit -m "feat: lien et formulaire mot de passe oublie sur l'ecran de connexion"
```

---

## Task 3 : Configuration Supabase (étape manuelle, hors code)

**Files:** aucun — étape à effectuer par Juanita dans le dashboard Supabase, pas dans le code.

- [ ] **Step 1 : Ajouter les URLs de redirection autorisées**

Dans Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs**, ajouter :
- `https://margopro.eidma.co/auth/nouveau-mot-de-passe`
- `http://localhost:3000/auth/nouveau-mot-de-passe` (pour pouvoir tester en local)

Sans cette étape, Supabase refuse de rediriger vers cette page après le clic sur le lien email (erreur "redirect_to not allowed").

- [ ] **Step 2 : Test de bout en bout par Juanita**

Une fois Task 1 et Task 2 déployées en production (poussées sur `main`, Vercel a redéployé) et Task 3 Step 1 faite :
1. Sur `margopro.eidma.co/auth`, cliquer "Mot de passe oublié ?", entrer un email réel qu'elle possède.
2. Vérifier la réception de l'email Supabase (et le dossier spam si rien n'arrive après 1-2 minutes).
3. Cliquer le lien dans l'email → doit arriver sur la page "Choisis ton nouveau mot de passe".
4. Entrer un nouveau mot de passe → doit être connectée automatiquement et arriver sur le tableau de bord.
5. Se déconnecter puis se reconnecter avec ce nouveau mot de passe pour confirmer que ça a bien été enregistré.

C'est la seule étape du plan qui ne peut pas être vérifiée par l'agent qui implémente (nécessite de recevoir un vrai email).
