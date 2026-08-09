# Connexion par numéro de téléphone (SMS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un compte de s'inscrire et se connecter avec un numéro de téléphone + mot de passe, en plus de l'email existant, avec un seul SMS envoyé (à l'inscription, pour vérifier le numéro).

**Architecture:** Supabase Auth gère nativement la connexion par téléphone + mot de passe (`signUp`, `signInWithPassword`, `verifyOtp`) — même mécanisme de session que l'email actuel. Un nouveau "Send SMS Hook" (route API Next.js, signature vérifiée) relaie l'envoi effectif du SMS vers Africa's Talking. Le frontend (`frontend/app/auth/page.tsx`) gagne un choix Email/Téléphone et un écran de saisie du code reçu par SMS.

**Tech Stack:** Next.js App Router (routes API), Supabase Auth (phone provider + Send SMS Hook), Africa's Talking (SDK `africastalking`, REST sous le capot), `standardwebhooks` (vérification de signature du hook).

## Global Constraints

- Un seul SMS envoyé par abonné, à l'inscription uniquement — jamais à chaque connexion. Toutes les connexions suivantes utilisent numéro + mot de passe.
- Le numéro de téléphone doit être saisi au format international complet (E.164, ex: `+2250123456789`) — pas de sélecteur de pays ni de formatage automatique dans cette version.
- La route API qui relaie vers Africa's Talking DOIT vérifier la signature du hook Supabase (via `standardwebhooks`) avant tout envoi — jamais de relai sans vérification, sous peine de facturation SMS incontrôlée par un tiers qui découvrirait l'URL.
- Ne jamais logger de secrets (clé API Africa's Talking, secret du hook) ni l'objet d'erreur brut d'un SDK qui pourrait les contenir — même règle déjà appliquée à `frontend/lib/fedapay.ts` (voir ses commentaires).
- L'email reste inchangé et pleinement fonctionnel — ce plan ajoute une option, n'en retire aucune.
- Style et conventions : suivre exactement le style déjà en place dans `frontend/app/auth/page.tsx` (objet de couleurs `T`, `inputStyle`, boutons, `fontFamily: 'Manrope, sans-serif'` partout) et dans `frontend/app/api/webhooks/fedapay/route.ts` (gestion d'erreur structurée, préfixe de log `[contexte]`, jamais de `console.error(err)` brut).
- Aucun test de composant/page (convention déjà établie dans ce projet : seule la logique pure a une couverture vitest, voir `frontend/lib/__tests__/`).

---

### Task 1: Helper d'envoi SMS Africa's Talking

**Files:**
- Create: `frontend/lib/africastalking.ts`
- Test: `frontend/lib/__tests__/africastalking.test.ts`
- Modify: `frontend/package.json` (dépendances)

**Interfaces:**
- Produces: `buildSmsOptions(phone: string, message: string): { to: string; message: string }` — fonction pure, utilisée par Task 2 et testée directement.
- Produces: `envoyerSms(phone: string, message: string): Promise<void>` — lève une erreur si l'envoi échoue (statut du destinataire différent de `"Success"`), utilisée par Task 2.

- [ ] **Step 1: Installer les dépendances**

```bash
cd frontend && npm install africastalking standardwebhooks && npm install -D @types/africastalking
```

- [ ] **Step 2: Écrire le test de la fonction pure `buildSmsOptions`**

```typescript
// frontend/lib/__tests__/africastalking.test.ts
import { describe, it, expect } from 'vitest';
import { buildSmsOptions } from '../africastalking';

describe('buildSmsOptions', () => {
  it('construit les options avec le numero et le message tels quels', () => {
    const options = buildSmsOptions('+2250123456789', 'Votre code MargoPro : 123456');
    expect(options).toEqual({
      to: '+2250123456789',
      message: 'Votre code MargoPro : 123456',
    });
  });
});
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `cd frontend && npx vitest run lib/__tests__/africastalking.test.ts`
Expected: FAIL avec "Cannot find module '../africastalking'" (le fichier n'existe pas encore)

- [ ] **Step 4: Créer `frontend/lib/africastalking.ts`**

```typescript
import AfricasTalking from 'africastalking';

const client = AfricasTalking({
  apiKey: process.env.AFRICASTALKING_API_KEY!,
  username: process.env.AFRICASTALKING_USERNAME!,
});

export function buildSmsOptions(phone: string, message: string): { to: string; message: string } {
  return { to: phone, message };
}

// Envoie un SMS. Leve une erreur si Africa's Talking ne confirme pas
// l'envoi (statut different de "Success" pour ce destinataire) - permet
// a l'appelant (route API du hook Supabase) de repondre une erreur
// structuree plutot que de repondre 200 sur un envoi qui a en realite
// echoue.
export async function envoyerSms(phone: string, message: string): Promise<void> {
  const options = buildSmsOptions(phone, message);
  let reponse;
  try {
    reponse = await client.SMS.send(options);
  } catch (err) {
    // Ne jamais logger l'objet d'erreur complet : peut contenir la cle API
    // dans la requete HTTP d'origine attachee par le SDK. Seul err.message
    // est sur a logger (meme regle que frontend/lib/fedapay.ts).
    throw new Error(err instanceof Error ? err.message : 'Erreur inconnue Africa\'s Talking');
  }
  const destinataire = reponse.SMSMessageData.Recipients[0];
  if (!destinataire || destinataire.status !== 'Success') {
    throw new Error(`Echec envoi SMS : ${destinataire?.status ?? 'aucun destinataire dans la reponse'}`);
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `cd frontend && npx vitest run lib/__tests__/africastalking.test.ts`
Expected: PASS

- [ ] **Step 6: Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 7: Commit**

```bash
git add frontend/lib/africastalking.ts frontend/lib/__tests__/africastalking.test.ts frontend/package.json frontend/package-lock.json
git commit -m "feat: helper d'envoi SMS via Africa's Talking"
```

---

### Task 2: Route API du Send SMS Hook Supabase

**Files:**
- Create: `frontend/app/api/auth/send-sms/route.ts`

**Interfaces:**
- Consumes: `envoyerSms` de Task 1 (`frontend/lib/africastalking.ts`).
- Produces: endpoint `POST /api/auth/send-sms`, à configurer manuellement dans le tableau de bord Supabase (Authentication → Hooks → Send SMS hook) une fois déployé — voir "Étapes manuelles" en fin de plan.

**Contrat exact du hook Supabase (Send SMS Hook, format "Standard Webhooks") :**
- Requête POST, corps JSON avec `{ user: {...}, sms: { otp: "123456" } }`.
- En-têtes de signature : `svix-id`, `svix-signature`, `svix-timestamp`.
- Secret fourni par Supabase au format `v1,whsec_<base64>` — stocké dans `SEND_SMS_HOOK_SECRET`, le préfixe `v1,whsec_` doit être retiré avant de construire le vérificateur.
- Réponse succès : `{}` avec statut 200. Réponse erreur : `{ "error": { "http_code": number, "message": string } }`.

- [ ] **Step 1: Créer `frontend/app/api/auth/send-sms/route.ts`**

```typescript
import { NextResponse, type NextRequest } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { envoyerSms } from '@/lib/africastalking';

interface HookPayload {
  user: { phone?: string };
  sms: { otp: string };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers = Object.fromEntries(request.headers);

  const secretBrut = process.env.SEND_SMS_HOOK_SECRET;
  if (!secretBrut) {
    console.error('[send-sms-hook] SEND_SMS_HOOK_SECRET manquant');
    return NextResponse.json({ error: { http_code: 500, message: 'Configuration manquante' } }, { status: 500 });
  }
  const secretBase64 = secretBrut.replace('v1,whsec_', '');

  let payload: HookPayload;
  try {
    const wh = new Webhook(secretBase64);
    payload = wh.verify(rawBody, headers) as HookPayload;
  } catch (err) {
    // Ne jamais logger le corps brut ici : peut contenir des donnees
    // utilisateur. Seul err.message est sur a logger.
    console.error('[send-sms-hook] signature invalide :', err instanceof Error ? err.message : 'erreur inconnue');
    return NextResponse.json({ error: { http_code: 401, message: 'Signature invalide' } }, { status: 401 });
  }

  const phone = payload.user.phone;
  const otp = payload.sms.otp;
  if (!phone || !otp) {
    console.error('[send-sms-hook] payload sans numero ou code');
    return NextResponse.json({ error: { http_code: 400, message: 'Payload incomplet' } }, { status: 400 });
  }

  try {
    await envoyerSms(phone, `Votre code MargoPro : ${otp}`);
  } catch (err) {
    console.error('[send-sms-hook] echec envoi SMS pour', phone, ':', err instanceof Error ? err.message : 'erreur inconnue');
    return NextResponse.json({ error: { http_code: 500, message: "Echec de l'envoi du SMS" } }, { status: 500 });
  }

  return NextResponse.json({});
}
```

- [ ] **Step 2: Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/auth/send-sms/route.ts
git commit -m "feat: route API du Send SMS Hook Supabase (relai vers Africa's Talking)"
```

---

### Task 3: Choix Email/Téléphone + inscription et connexion par téléphone

**Files:**
- Modify: `frontend/app/auth/page.tsx`

**Interfaces:**
- Consumes: rien de nouveau — utilise directement `supabase.auth.signUp`/`signInWithPassword` avec `phone` au lieu de `email`.
- Produces: nouvel état `identifiant: 'email' | 'telephone'`, consommé par Task 4 pour savoir quel écran de vérification afficher après une inscription par téléphone.

**Contexte exact du fichier actuel** (`frontend/app/auth/page.tsx`) : le composant a déjà un état `mode: 'connexion' | 'inscription' | 'oubli'`, un objet de couleurs `T`, un `inputStyle` partagé, et une fonction `soumettre()` qui gère signIn/signUp par email (lignes 114-158 au moment de ce plan). Ce Task ajoute le choix du type d'identifiant SANS toucher au flux "oubli" (mot de passe oublié) ni à la bannière "déjà connectée" ajoutées récemment.

- [ ] **Step 1: Ajouter l'état `identifiant` et le champ téléphone**

Juste après la ligne `const [email, setEmail] = useState('');`, ajouter :

```typescript
  const [identifiant, setIdentifiant] = useState<'email' | 'telephone'>('email');
  const [telephone, setTelephone] = useState('');
```

- [ ] **Step 2: Ajouter le sélecteur Email/Téléphone dans le formulaire**

Juste avant le bloc `<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>` qui contient le label "Adresse email" (dans le formulaire principal, mode `connexion`/`inscription`), ajouter :

```tsx
          <div style={{ display: 'flex', gap: 8, background: T.bg, borderRadius: 12, padding: 4 }}>
            {(['email', 'telephone'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { setIdentifiant(opt); setErreur(''); }}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: identifiant === opt ? T.accent : 'transparent',
                  color: identifiant === opt ? '#fff' : T.textSub,
                  fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                }}
              >
                {opt === 'email' ? 'Email' : 'Téléphone'}
              </button>
            ))}
          </div>
```

- [ ] **Step 3: Remplacer le champ email fixe par un champ conditionnel**

Remplacer le bloc du champ "Adresse email" (label + `<input type="email" ...>`) par :

```tsx
          {identifiant === 'email' ? (
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
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+2250123456789"
                autoComplete="tel"
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
              <span style={{ fontSize: 12, color: T.textMuted }}>Avec l&apos;indicatif du pays, ex: +225 pour la Côte d&apos;Ivoire.</span>
            </div>
          )}
```

- [ ] **Step 4: Mettre à jour `formulaireValide` pour valider le bon champ**

Remplacer :

```typescript
  const formulaireValide =
    email.trim() !== '' &&
    password.length >= 6 &&
    cguAccepte &&
    (mode === 'connexion' || confirmPassword === password);
```

par :

```typescript
  const identifiantValide = identifiant === 'email' ? email.trim() !== '' : /^\+[1-9]\d{6,14}$/.test(telephone.trim());
  const formulaireValide =
    identifiantValide &&
    password.length >= 6 &&
    cguAccepte &&
    (mode === 'connexion' || confirmPassword === password);
```

- [ ] **Step 5: Brancher `identifiant`/`telephone` dans `soumettre()`**

Remplacer le contenu de `soumettre()` (lignes 114-158 au moment de ce plan) par :

```typescript
  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formulaireValide) return;
    setLoading(true);
    setErreur('');

    const supabase = createClient();

    if (mode === 'connexion') {
      const { error } = identifiant === 'email'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signInWithPassword({ phone: telephone.trim(), password });
      if (error) {
        setErreur(identifiant === 'email' ? 'Email ou mot de passe incorrect.' : 'Numéro ou mot de passe incorrect.');
        setLoading(false);
        return;
      }
      router.push('/');
    } else {
      if (password !== confirmPassword) {
        setErreur('Les mots de passe ne correspondent pas.');
        setLoading(false);
        return;
      }
      if (identifiant === 'email') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) {
          setErreur(error.message.includes('already registered')
            ? 'Cet email est déjà utilisé. Connectez-vous.'
            : 'Erreur lors de la création du compte. Réessayez.');
          setLoading(false);
          return;
        }
        if (!data.session) {
          // Confirmation email activée côté Supabase : aucune session tant que le lien
          // n'a pas été cliqué. /onboarding est protégé par le middleware, donc on ne
          // redirige pas : on informe l'utilisateur à la place.
          setConfirmationEmailRequise(true);
          setLoading(false);
          return;
        }
        router.push('/onboarding');
      } else {
        const { data, error } = await supabase.auth.signUp({ phone: telephone.trim(), password });
        if (error) {
          setErreur(error.message.includes('already registered') || error.message.includes('already exists')
            ? 'Ce numéro est déjà utilisé. Connectez-vous.'
            : 'Erreur lors de la création du compte. Réessayez.');
          setLoading(false);
          return;
        }
        if (!data.session) {
          // Meme principe que l'email : aucune session tant que le code SMS
          // n'a pas ete verifie. Task 4 branche cet ecran.
          setConfirmationTelephoneRequise(true);
          setLoading(false);
          return;
        }
        router.push('/onboarding');
      }
    }
  }
```

Note : `setConfirmationTelephoneRequise` est introduit ici mais son état et son écran sont ajoutés en Task 4 — ce Task 3 doit donc déclarer l'état minimal `const [confirmationTelephoneRequise, setConfirmationTelephoneRequise] = useState(false);` juste après `confirmationEmailRequise` pour que ce fichier compile seul, mais l'écran associé (Step visuel) est fait en Task 4.

- [ ] **Step 6: Déclarer l'état minimal pour que le fichier compile**

Juste après `const [confirmationEmailRequise, setConfirmationEmailRequise] = useState(false);`, ajouter :

```typescript
  const [confirmationTelephoneRequise, setConfirmationTelephoneRequise] = useState(false);
```

Et dans la condition qui masque le formulaire principal (`{typeof sessionActiveEmail !== 'string' && mode !== 'oubli' && !confirmationEmailRequise && (`), ajouter `!confirmationTelephoneRequise` :

```tsx
        {typeof sessionActiveEmail !== 'string' && mode !== 'oubli' && !confirmationEmailRequise && !confirmationTelephoneRequise && (
```

(même ajout sur le bloc "Basculer mode" juste en dessous, qui a la même condition).

- [ ] **Step 7: Réinitialiser `telephone`/`identifiant` dans `basculerMode()`**

Dans `basculerMode()`, ajouter `setTelephone('');` et `setConfirmationTelephoneRequise(false);` aux réinitialisations existantes (garder `identifiant` tel quel — pas de raison de le réinitialiser en changeant connexion/inscription).

- [ ] **Step 8: Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 9: Tester manuellement dans le navigateur**

Run: `cd frontend && npm run dev`, ouvrir `/auth`, basculer sur "Téléphone", vérifier que le champ change, que le bouton reste désactivé tant que le numéro n'a pas le format `+...`, et que basculer connexion/inscription conserve le choix Email/Téléphone.

- [ ] **Step 10: Commit**

```bash
git add frontend/app/auth/page.tsx
git commit -m "feat: choix Email/Telephone, inscription et connexion par telephone"
```

---

### Task 4: Écran de vérification du code SMS

**Files:**
- Modify: `frontend/app/auth/page.tsx`

**Interfaces:**
- Consumes: état `confirmationTelephoneRequise`, `telephone` de Task 3.

**Contexte :** cet écran s'affiche à la place du formulaire quand `confirmationTelephoneRequise` est vrai (juste après une inscription par téléphone réussie côté Supabase, en attente du code). Il doit ressembler à l'écran "Confirmation email requise" déjà existant (mêmes styles), mais avec 6 cases de saisie et un bouton de renvoi.

- [ ] **Step 1: Ajouter l'état du code et du renvoi**

Juste après `const [confirmationTelephoneRequise, setConfirmationTelephoneRequise] = useState(false);` (ajouté en Task 3), ajouter :

```typescript
  const [codeSms, setCodeSms] = useState('');
  const [erreurCode, setErreurCode] = useState('');
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);
  const [renvoiMessage, setRenvoiMessage] = useState('');
```

- [ ] **Step 2: Ajouter les fonctions de vérification et de renvoi**

Juste après la fonction `soumettre()`, ajouter :

```typescript
  async function verifierCodeSms(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (codeSms.trim().length !== 6) return;
    setVerificationEnCours(true);
    setErreurCode('');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: telephone.trim(),
      token: codeSms.trim(),
      type: 'sms',
    });
    if (error) {
      setErreurCode('Code incorrect ou expiré. Réessaie ou demande un nouveau code.');
      setVerificationEnCours(false);
      return;
    }
    router.push('/onboarding');
  }

  async function renvoyerCodeSms() {
    setRenvoiEnCours(true);
    setRenvoiMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'sms', phone: telephone.trim() });
    setRenvoiEnCours(false);
    if (error) {
      // Supabase applique deja sa propre limite de frequence (~60s) et
      // renvoie une erreur explicite si on redemande trop vite - on
      // l'affiche telle quelle plutot que de reimplementer une limite.
      setRenvoiMessage(error.message.includes('security purposes')
        ? 'Merci de patienter avant de redemander un code.'
        : "Échec de l'envoi. Réessaie dans un instant.");
      return;
    }
    setRenvoiMessage('Nouveau code envoyé.');
  }
```

- [ ] **Step 3: Ajouter l'écran de saisie du code**

Juste après le bloc "Confirmation email requise après inscription" (qui se termine par `)}` avant le bloc `{typeof sessionActiveEmail !== 'string' && mode === 'oubli' && (`), ajouter :

```tsx
        {/* Confirmation téléphone requise après inscription */}
        {typeof sessionActiveEmail !== 'string' && mode === 'inscription' && confirmationTelephoneRequise && (
          <form onSubmit={verifierCodeSms} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
              Un code à 6 chiffres a été envoyé par SMS au {telephone}. Entre-le ci-dessous.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Code reçu par SMS
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={codeSms}
                onChange={(e) => setCodeSms(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontFamily: '"Space Grotesk", sans-serif' }}
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>
            {erreurCode && (
              <p style={{ fontSize: 13, fontWeight: 600, color: T.red, textAlign: 'center', background: T.redBg, borderRadius: 12, padding: '12px 16px', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
                {erreurCode}
              </p>
            )}
            <button
              type="submit"
              disabled={codeSms.trim().length !== 6 || verificationEnCours}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: T.accent, color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                opacity: (codeSms.trim().length !== 6 || verificationEnCours) ? 0.4 : 1,
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {verificationEnCours ? '...' : 'Vérifier'}
            </button>
            <button
              type="button"
              onClick={renvoyerCodeSms}
              disabled={renvoiEnCours}
              style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}
            >
              {renvoiEnCours ? '...' : "Je n'ai pas reçu le code, renvoyer"}
            </button>
            {renvoiMessage && (
              <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
                {renvoiMessage}
              </p>
            )}
            <button
              type="button"
              onClick={retourConnexion}
              style={{ color: T.textMuted, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}
            >
              Retour à la connexion
            </button>
          </form>
        )}
```

- [ ] **Step 4: Réinitialiser l'écran dans `retourConnexion()`**

Dans `retourConnexion()`, ajouter `setConfirmationTelephoneRequise(false); setCodeSms(''); setErreurCode(''); setRenvoiMessage('');` aux réinitialisations existantes.

- [ ] **Step 5: Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 6: Tester manuellement dans le navigateur**

Run: `cd frontend && npm run dev` (nécessite le hook Supabase configuré — voir "Étapes manuelles" — sinon l'inscription par téléphone échouera avant d'atteindre cet écran). Vérifier : l'écran de code s'affiche après inscription par téléphone, un code à 6 chiffres non-numérique est filtré automatiquement, le bouton "Vérifier" reste désactivé tant que 6 chiffres ne sont pas saisis, "Retour à la connexion" ramène au formulaire normal.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/auth/page.tsx
git commit -m "feat: ecran de verification du code SMS a l'inscription par telephone"
```

---

### Task 5: Mise à jour des CGU

**Files:**
- Modify: `frontend/app/cgu/page.tsx:48`

**Interfaces:** aucune — modification de texte uniquement.

- [ ] **Step 1: Remplacer le texte de la section 2**

Remplacer :

```tsx
          L&apos;accès à MargoPro nécessite la création d&apos;un compte via une adresse email et un mot de passe. Vous êtes responsable de la confidentialité de vos identifiants de connexion. Toute utilisation effectuée depuis votre compte vous est attribuée.
```

par :

```tsx
          L&apos;accès à MargoPro nécessite la création d&apos;un compte via une adresse email ou un numéro de téléphone, et un mot de passe. Vous êtes responsable de la confidentialité de vos identifiants de connexion. Toute utilisation effectuée depuis votre compte vous est attribuée.
```

- [ ] **Step 2: Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 3: Commit**

```bash
git add frontend/app/cgu/page.tsx
git commit -m "docs: CGU mises a jour pour la connexion par telephone"
```

---

## Étapes manuelles (hors code, à faire par Juanita avant que la fonctionnalité soit utilisable)

Ces étapes ne peuvent pas être automatisées par un agent (accès à des tableaux de bord externes) :

1. **Africa's Talking** : recharger le portefeuille prépayé d'un petit montant (le solde n'expire jamais) ; récupérer la clé API (`Settings → API Key`) et le nom d'utilisateur (username) du compte.
2. **Variables d'environnement Vercel** à ajouter : `AFRICASTALKING_API_KEY`, `AFRICASTALKING_USERNAME`, `SEND_SMS_HOOK_SECRET` (cette dernière est générée par Supabase à l'étape suivante, à copier après coup).
3. **Supabase Dashboard → Authentication → Providers** : activer "Phone".
4. **Supabase Dashboard → Authentication → Hooks → Send SMS hook** : activer, pointer vers `https://margopro.eidma.co/api/webhooks/send-sms` (une fois déployé), copier le secret généré (`v1,whsec_...`) dans `SEND_SMS_HOOK_SECRET` sur Vercel.
5. Tester un premier vrai SMS de bout en bout sur la preview Vercel avant de considérer la fonctionnalité prête pour de vrais utilisateurs.
