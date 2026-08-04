# Abonnement Premium — paiement manuel FedaPay (Chantier 1/2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le bouton "Renouveler" de `/abonnement` fonctionnel : paiement réel via FedaPay Checkout (Mobile Money/Wave/carte), confirmation vérifiée côté serveur, compte client passé en Premium pour 30 jours.

**Architecture:** Une transaction FedaPay est créée côté serveur (clé secrète jamais exposée) avec l'id Supabase du client en métadonnée. Le client est redirigé vers la page de paiement hébergée par FedaPay. FedaPay notifie un webhook serveur du résultat ; le webhook ne fait jamais confiance au contenu reçu — il revérifie toujours le statut réel directement auprès de l'API FedaPay avant de accorder le Premium, via un client Supabase à clé de service (le seul autorisé, par un trigger Postgres, à modifier les colonnes `is_premium` / `premium_expires_at`). Le renouvellement automatique (Chantier 2, plan séparé) n'est pas couvert ici — ce chantier livre uniquement le paiement manuel, complet et testable seul.

**Tech Stack:** Next.js 16 App Router (Route Handlers), TypeScript, package npm `fedapay` (SDK officiel Node.js), Supabase (Postgres + `@supabase/supabase-js` en clé de service), Vitest.

## Global Constraints

- Prix : 3500 FCFA/mois, défini une seule fois dans `frontend/lib/fedapay.ts`.
- Aucune clé FedaPay ni secret ne doit apparaître dans le code — uniquement `process.env.*`, jamais de valeur en dur.
- Le webhook ne doit jamais faire confiance au statut transmis dans la requête reçue — toujours revérifier via `Transaction.retrieve()` avant d'accorder le Premium.
- Seules les colonnes `is_premium` et `premium_expires_at` de `public.config` doivent être protégées contre l'écriture client (via trigger Postgres) — pas les autres colonnes.
- Ce chantier ne couvre PAS le renouvellement automatique optionnel (numéro Mobile Money, cron quotidien) — c'est un chantier séparé, à ne pas anticiper ici au-delà des noms de colonnes déjà réservés dans la fiche technique.
- `frontend/middleware.ts` (déjà en place) protège déjà `/abonnement` et toute route `/api/*` non listée dans `frontend/lib/authGate.ts` — les routes API de ce chantier doivent quand même revérifier la session elles-mêmes en défense en profondeur (pattern déjà utilisé : `createClient()` de `frontend/lib/supabase/server.ts` + `auth.getUser()`).

---

### Task 1 : Retirer la dépendance Flutterwave inutilisée

**Files:**
- Modify: `frontend/package.json`

**Interfaces:** Aucune — nettoyage isolé, sans lien avec les tâches suivantes.

- [ ] **Step 1 : Confirmer qu'elle n'est utilisée nulle part**

Run: `cd frontend && grep -rn "flutterwave" app lib backend components 2>/dev/null`
Expected: aucune sortie (déjà vérifié en amont, mais à reconfirmer avant de supprimer).

- [ ] **Step 2 : Retirer la dépendance**

Run: `cd frontend && npm uninstall flutterwave-react-v3`

- [ ] **Step 3 : Vérifier que l'app compile toujours**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4 : Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: retirer flutterwave-react-v3, jamais utilisee"
```

---

### Task 2 : Migration Supabase — colonne `premium_expires_at` + trigger de protection

**Files:**
- Create: `frontend/supabase-migration-2026-08-02-abonnement-fedapay.sql`

**Interfaces:**
- Produces : colonne `public.config.premium_expires_at` (bigint, nullable) — consommée par Task 3 (mapping TS) et Task 8 (webhook).
- Produces : garantie que seule une requête avec la clé de service Supabase peut modifier `is_premium` ou `premium_expires_at` — condition de sécurité dont dépend tout le reste du chantier.

- [ ] **Step 1 : Écrire la migration**

Créer `frontend/supabase-migration-2026-08-02-abonnement-fedapay.sql` :

```sql
-- Ajoute la date d'expiration Premium (distincte de date_abonnement, qui ne
-- sert qu'a l'affichage d'un compteur independant du vrai statut Premium).
alter table public.config
  add column if not exists premium_expires_at bigint;

-- Protection : seule une requete authentifiee avec la cle de service
-- Supabase (utilisee uniquement par le webhook/serveur FedaPay, jamais par
-- l'app cliente) peut modifier is_premium ou premium_expires_at. Sans ce
-- trigger, n'importe quel client pourrait se donner Premium gratuitement
-- via une simple synchronisation locale (push()).
create or replace function public.proteger_colonnes_premium()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    new.is_premium := false;
    new.premium_expires_at := null;
  else
    new.is_premium := old.is_premium;
    new.premium_expires_at := old.premium_expires_at;
  end if;

  return new;
end;
$$;

drop trigger if exists config_proteger_premium on public.config;
create trigger config_proteger_premium
  before insert or update on public.config
  for each row
  execute function public.proteger_colonnes_premium();
```

- [ ] **Step 2 : Note pour Juanita (à exécuter par elle, hors code)**

Cette migration doit être collée et exécutée dans **Supabase Dashboard → SQL Editor**, comme les migrations précédentes. Elle n'a pas besoin d'être lancée pendant l'implémentation des tâches suivantes (le code peut être écrit et son typage vérifié sans elle), mais elle doit être appliquée avant tout test réel de paiement.

- [ ] **Step 3 : Commit**

```bash
git add frontend/supabase-migration-2026-08-02-abonnement-fedapay.sql
git commit -m "feat: migration - premium_expires_at + protection colonnes premium"
```

---

### Task 3 : Champ `premiumExpiresAt` dans le type Config et la synchronisation

**Files:**
- Modify: `frontend/backend/types.ts:48-58`
- Modify: `frontend/lib/sync.ts:62-72` (`ConfigRow`), `frontend/lib/sync.ts:167-193` (`configToRow` / `rowToConfig`)

**Interfaces:**
- Consumes : colonne `premium_expires_at` de la Task 2.
- Produces : `Config.premiumExpiresAt?: number` — consommé par Task 4 (`usePlan.ts`) et Task 9 (UI `/abonnement`).

- [ ] **Step 1 : Ajouter le champ au type `Config`**

Dans `frontend/backend/types.ts`, modifier l'interface (ligne 48-58) :

```ts
export interface Config {
  id: 'singleton';
  nomCommerce: string;
  devise: string;
  symboleDevise: string;
  onboardingComplete: boolean;
  trialStart?: number;  // timestamp ms du premier produit ajouté
  isPremium?: boolean;  // true = plan Premium actif
  premiumExpiresAt?: number;  // timestamp ms de fin de la periode Premium en cours
  dateAbonnement?: number;
  updatedAt?: number;
}
```

- [ ] **Step 2 : Ajouter le champ à `ConfigRow`**

Dans `frontend/lib/sync.ts`, modifier le type (ligne 62-72) :

```ts
type ConfigRow = {
  user_id: string;
  nom_commerce: string | null;
  devise: string | null;
  symbole_devise: string | null;
  onboarding_complete: boolean;
  date_abonnement: number | null;
  trial_start: number | null;
  is_premium: boolean;
  premium_expires_at: number | null;
  updated_at: number;
};
```

- [ ] **Step 3 : Mapper le champ dans `configToRow` et `rowToConfig`**

Dans `frontend/lib/sync.ts`, modifier les deux fonctions (ligne 167-193) :

```ts
function configToRow(c: Config, userId: string): ConfigRow {
  return {
    user_id: userId,
    nom_commerce: c.nomCommerce ?? null,
    devise: c.devise ?? null,
    symbole_devise: c.symboleDevise ?? null,
    onboarding_complete: c.onboardingComplete ?? false,
    date_abonnement: c.dateAbonnement ?? null,
    trial_start: c.trialStart ?? null,
    is_premium: c.isPremium ?? false,
    premium_expires_at: c.premiumExpiresAt ?? null,
    updated_at: c.updatedAt ?? Date.now(),
  };
}

function rowToConfig(r: ConfigRow): Config {
  return {
    id: 'singleton',
    nomCommerce: r.nom_commerce ?? '',
    devise: r.devise ?? '',
    symboleDevise: r.symbole_devise ?? '',
    onboardingComplete: r.onboarding_complete ?? false,
    dateAbonnement: r.date_abonnement ?? undefined,
    trialStart: r.trial_start ?? undefined,
    isPremium: r.is_premium ?? false,
    premiumExpiresAt: r.premium_expires_at ?? undefined,
    updatedAt: Number(r.updated_at),
  };
}
```

Note : envoyer `premium_expires_at`/`is_premium` dans `configToRow` reste inoffensif même si le client les modifie localement — le trigger de la Task 2 les ignore silencieusement côté serveur sauf pour les écritures faites avec la clé de service.

- [ ] **Step 4 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/backend/types.ts frontend/lib/sync.ts
git commit -m "feat: champ premiumExpiresAt dans Config et la synchronisation"
```

---

### Task 4 : `usePlan.ts` — respecter `premiumExpiresAt` dans le calcul du statut

**Files:**
- Modify: `frontend/lib/hooks/usePlan.ts:22-47` (`computePlanStatus`), `frontend/lib/hooks/usePlan.ts:49-60` (`usePlan`)
- Test: `frontend/lib/__tests__/usePlan.test.ts`

**Interfaces:**
- Consumes : `Config.premiumExpiresAt` (Task 3).
- Produces : `computePlanStatus(trialStart, isPremium, activeProductCount, now?, premiumExpiresAt?)` — signature étendue, 5e paramètre optionnel, rétrocompatible avec les 9 tests existants qui ne le passent pas.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `frontend/lib/__tests__/usePlan.test.ts`, à la fin du bloc `describe('computePlanStatus', ...)` (avant la dernière accolade fermante) :

```ts
  it('reste premium si premiumExpiresAt est dans le futur', () => {
    const now = Date.now();
    const r = computePlanStatus(undefined, true, 2, now, now + 10 * DAY);
    expect(r.status).toBe('premium');
    expect(r.canAddProduct).toBe(true);
  });

  it('retombe sur le calcul trial/expired si premiumExpiresAt est depasse', () => {
    const now = Date.now();
    // isPremium encore true localement (pas resynchronise), mais la date
    // de fin est passee : ne doit plus etre traite comme premium actif.
    const r = computePlanStatus(now - 31 * DAY, true, 8, now, now - 1 * DAY);
    expect(r.status).toBe('expired');
    expect(r.canAddProduct).toBe(false);
  });

  it('reste premium si premiumExpiresAt est absent (comportement historique)', () => {
    const r = computePlanStatus(undefined, true, 100, Date.now());
    expect(r.status).toBe('premium');
  });
```

- [ ] **Step 2 : Lancer les tests et vérifier qu'ils échouent**

Run: `cd frontend && npx vitest run lib/__tests__/usePlan.test.ts`
Expected: FAIL sur les 2 premiers nouveaux tests (le 3e passe déjà, c'est le comportement actuel) — `computePlanStatus` ignore actuellement le 5e argument.

- [ ] **Step 3 : Modifier `computePlanStatus`**

Dans `frontend/lib/hooks/usePlan.ts`, remplacer (lignes 22-47) :

```ts
export function computePlanStatus(
  trialStart: number | undefined,
  isPremium: boolean,
  activeProductCount: number,
  now: number = Date.now(),
  premiumExpiresAt?: number
): PlanInfo {
  const premiumActif = isPremium && (premiumExpiresAt === undefined || premiumExpiresAt > now);

  if (premiumActif) {
    return { status: 'premium', daysRemaining: 0, isPremium: true, activeProductCount, canAddProduct: true };
  }

  if (trialStart === undefined) {
    return { status: 'trial', daysRemaining: TRIAL_DAYS, isPremium: false, activeProductCount, canAddProduct: true };
  }

  const elapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - elapsed);

  let status: PlanStatus;
  if (remaining === 0) status = 'expired';
  else if (remaining <= WARNING_DAYS) status = 'warning';
  else status = 'trial';

  const canAddProduct = status !== 'expired' || activeProductCount < 5;

  return { status, daysRemaining: remaining, isPremium: false, activeProductCount, canAddProduct };
}
```

- [ ] **Step 4 : Transmettre `premiumExpiresAt` depuis `usePlan()`**

Dans `frontend/lib/hooks/usePlan.ts`, modifier l'appel dans `usePlan()` (ligne ~55) :

```ts
    return computePlanStatus(
      config?.trialStart,
      config?.isPremium ?? false,
      activeProductCount,
      Date.now(),
      config?.premiumExpiresAt
    );
```

- [ ] **Step 5 : Lancer les tests et vérifier qu'ils passent**

Run: `cd frontend && npx vitest run lib/__tests__/usePlan.test.ts`
Expected: PASS — 12/12 tests (9 existants + 3 nouveaux).

- [ ] **Step 6 : Lancer la suite complète**

Run: `cd frontend && npm test`
Expected: tous les fichiers passent, sortie propre.

- [ ] **Step 7 : Commit**

```bash
git add frontend/lib/hooks/usePlan.ts frontend/lib/__tests__/usePlan.test.ts
git commit -m "feat: usePlan respecte premiumExpiresAt pour determiner le statut"
```

---

### Task 5 : Module `lib/fedapay.ts` — création et vérification de transaction

**Files:**
- Create: `frontend/lib/fedapay.ts`
- Test: `frontend/lib/__tests__/fedapay.test.ts`

**Interfaces:**
- Produces : `PRIX_PREMIUM_FCFA: number`, `buildTransactionPayload(userId: string, callbackUrl: string): TransactionPayload` (pure, testée), `creerTransactionAbonnement(userId: string, callbackUrl: string): Promise<{ transactionId: number; url: string }>`, `verifierTransaction(transactionId: number): Promise<{ status: string; userId: string | undefined }>`, `verifierSignatureWebhook(rawBody: string, signature: string): FedapayEvent` — consommées par Task 7 (route `/api/paiement/creer`) et Task 8 (webhook).

- [ ] **Step 1 : Installer le SDK FedaPay**

Run: `cd frontend && npm install fedapay`

- [ ] **Step 2 : Écrire le test qui échoue (partie pure, testable sans réseau)**

Créer `frontend/lib/__tests__/fedapay.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import { buildTransactionPayload, PRIX_PREMIUM_FCFA } from '../fedapay';

describe('PRIX_PREMIUM_FCFA', () => {
  it('vaut 3500', () => {
    expect(PRIX_PREMIUM_FCFA).toBe(3500);
  });
});

describe('buildTransactionPayload', () => {
  it('construit le payload avec le bon montant, la bonne devise et la metadata utilisateur', () => {
    const payload = buildTransactionPayload('user-abc-123', 'https://margopro.eidma.co/abonnement?paiement=retour');
    expect(payload.amount).toBe(3500);
    expect(payload.currency).toEqual({ iso: 'XOF' });
    expect(payload.callback_url).toBe('https://margopro.eidma.co/abonnement?paiement=retour');
    expect(payload.custom_metadata).toEqual({ supabase_user_id: 'user-abc-123' });
    expect(payload.description).toContain('MargoPro');
  });
});
```

- [ ] **Step 3 : Lancer le test et vérifier qu'il échoue**

Run: `cd frontend && npx vitest run lib/__tests__/fedapay.test.ts`
Expected: FAIL — `Cannot find module '../fedapay'`

- [ ] **Step 4 : Avant d'écrire l'implémentation — vérifier la forme exacte des objets FedaPay installés**

Le SDK `fedapay` est maintenant dans `node_modules/fedapay`. Avant d'écrire `verifierSignatureWebhook` et `verifierTransaction`, inspecter le code source installé pour confirmer (ces détails ne sont pas garantis à 100% par la documentation publique consultée en amont) :
- La forme exacte de l'objet retourné par `Webhook.constructEvent(rawBody, sig, secret)` — en particulier où se trouve l'id de la transaction concernée (probablement `event.entity.id` ou `event.data.object.id` — à confirmer en lisant `node_modules/fedapay/lib/Webhook.js` ou équivalent).
- Que `Transaction.retrieve(id)` renvoie bien `custom_metadata` dans l'objet transaction (nécessaire pour retrouver `supabase_user_id`).

Run: `grep -rn "constructEvent\|custom_metadata" frontend/node_modules/fedapay/lib/ 2>/dev/null | head -30`

Adapter le code des étapes suivantes à ce que cette inspection révèle. Si `custom_metadata` n'apparaît pas dans la réponse de `Transaction.retrieve`, chercher `Transaction.retrieve(id, { expand: [...] })` ou équivalent dans le SDK — sinon, escalader (BLOCKED) plutôt que de deviner.

- [ ] **Step 5 : Écrire l'implémentation**

Créer `frontend/lib/fedapay.ts` :

```ts
import { FedaPay, Transaction, Webhook } from 'fedapay';

FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY!);
FedaPay.setEnvironment((process.env.FEDAPAY_ENVIRONMENT as 'sandbox' | 'live') ?? 'sandbox');

export const PRIX_PREMIUM_FCFA = 3500;

export interface TransactionPayload {
  description: string;
  amount: number;
  currency: { iso: string };
  callback_url: string;
  custom_metadata: { supabase_user_id: string };
}

export function buildTransactionPayload(userId: string, callbackUrl: string): TransactionPayload {
  return {
    description: 'Abonnement Premium MargoPro - 1 mois',
    amount: PRIX_PREMIUM_FCFA,
    currency: { iso: 'XOF' },
    callback_url: callbackUrl,
    custom_metadata: { supabase_user_id: userId },
  };
}

export async function creerTransactionAbonnement(
  userId: string,
  callbackUrl: string
): Promise<{ transactionId: number; url: string }> {
  const transaction = await Transaction.create(buildTransactionPayload(userId, callbackUrl));
  const { url } = await transaction.generateToken();
  return { transactionId: transaction.id, url };
}

export async function verifierTransaction(
  transactionId: number
): Promise<{ status: string; userId: string | undefined }> {
  const transaction = await Transaction.retrieve(transactionId);
  return {
    status: transaction.status,
    userId: transaction.custom_metadata?.supabase_user_id,
  };
}

export function verifierSignatureWebhook(rawBody: string, signature: string) {
  return Webhook.constructEvent(rawBody, signature, process.env.FEDAPAY_WEBHOOK_SECRET!);
}
```

Ajuster `verifierTransaction` et `verifierSignatureWebhook` selon ce que l'inspection de l'étape 4 a révélé si la forme réelle diffère de ce qui précède.

- [ ] **Step 6 : Lancer le test et vérifier qu'il passe**

Run: `cd frontend && npx vitest run lib/__tests__/fedapay.test.ts`
Expected: PASS — 2/2 tests (les fonctions réseau ne sont pas testées ici, cohérent avec la convention du projet : seule la logique pure est testée en unitaire, `verifierTransaction`/`creerTransactionAbonnement`/`verifierSignatureWebhook` seront vérifiées manuellement à l'intégration, une fois de vraies clés disponibles).

- [ ] **Step 7 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 8 : Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/lib/fedapay.ts frontend/lib/__tests__/fedapay.test.ts
git commit -m "feat: module fedapay.ts - creation et verification de transaction"
```

---

### Task 6 : Client Supabase à clé de service

**Files:**
- Create: `frontend/lib/supabase/service.ts`

**Interfaces:**
- Produces : `createServiceClient(): SupabaseClient` — consommée par Task 8 (webhook), seule autorisée par le trigger de la Task 2 à modifier `is_premium`/`premium_expires_at`.

- [ ] **Step 1 : Écrire le fichier**

Créer `frontend/lib/supabase/service.ts`, en suivant le style de `frontend/lib/supabase/client.ts` et `frontend/lib/supabase/server.ts` déjà présents dans le projet :

```ts
import { createClient } from '@supabase/supabase-js';

// Client à clé de service : contourne les policies RLS. Réservé aux
// routes serveur qui doivent modifier des données au nom d'un utilisateur
// autre que celui de la requête entrante (ex: webhook FedaPay). Ne jamais
// utiliser cette clé côté navigateur.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/lib/supabase/service.ts
git commit -m "feat: client Supabase a cle de service pour les routes serveur"
```

---

### Task 7 : Route `POST /api/paiement/creer`

**Files:**
- Create: `frontend/app/api/paiement/creer/route.ts`

**Interfaces:**
- Consumes : `creerTransactionAbonnement(userId, callbackUrl)` (Task 5), `createClient()` de `frontend/lib/supabase/server.ts` (déjà existant, utilisé par `frontend/middleware.ts`).
- Produces : `POST /api/paiement/creer` → `{ url: string }` (200) ou `{ error: string }` (401/500) — consommée par Task 9 (UI).

- [ ] **Step 1 : Écrire la route**

Créer `frontend/app/api/paiement/creer/route.ts` :

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { creerTransactionAbonnement } from '@/lib/fedapay';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const callbackUrl = new URL('/abonnement?paiement=retour', request.url).toString();

  try {
    const { url } = await creerTransactionAbonnement(user.id, callbackUrl);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Erreur lors de la création du paiement" }, { status: 500 });
  }
}
```

- [ ] **Step 2 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur, build réussi (route listée dans la sortie `npm run build`).

- [ ] **Step 3 : Vérification manuelle — sans session**

Run: `cd frontend && npm run dev`, puis dans un autre terminal :

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/paiement/creer`
Expected : `307` (redirection vers `/auth` par le middleware, avant même d'atteindre la route — comportement attendu, cohérent avec le verrou d'auth déjà en place).

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/api/paiement/creer/route.ts
git commit -m "feat: route API creation de transaction FedaPay"
```

---

### Task 8 : Webhook `POST /api/webhooks/fedapay`

**Files:**
- Create: `frontend/app/api/webhooks/fedapay/route.ts`
- Modify: `frontend/lib/authGate.ts` (ajouter le webhook aux routes publiques — FedaPay n'a pas de session Supabase)

**Interfaces:**
- Consumes : `verifierSignatureWebhook(rawBody, signature)` et `verifierTransaction(transactionId)` (Task 5), `createServiceClient()` (Task 6).
- Produces : met à jour `public.config.is_premium` / `premium_expires_at` pour l'utilisateur concerné.

- [ ] **Step 1 : Rendre le webhook accessible sans session Supabase**

FedaPay n'a pas de compte MargoPro — sa requête n'aura jamais de cookie de session. Le fichier `frontend/lib/authGate.ts` contient actuellement exactement :

```ts
const WILDCARD_PUBLIC_PATHS = ['/auth'];
const EXACT_PUBLIC_PATHS = ['/cgu'];

export function isPublicPath(pathname: string): boolean {
  if (EXACT_PUBLIC_PATHS.includes(pathname)) return true;
  return WILDCARD_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
```

Modifier la première ligne pour ajouter le préfixe du webhook (accès en wildcard, comme `/auth`, puisque `/api/webhooks/fedapay` est le seul chemin exact mais qu'un préfixe reste plus sûr si d'autres webhooks s'ajoutent plus tard) :

```ts
const WILDCARD_PUBLIC_PATHS = ['/auth', '/api/webhooks'];
```

Le reste du fichier ne change pas.

- [ ] **Step 2 : Écrire la route**

Créer `frontend/app/api/webhooks/fedapay/route.ts` :

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifierSignatureWebhook, verifierTransaction } from '@/lib/fedapay';
import { createServiceClient } from '@/lib/supabase/service';

const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-fedapay-signature') ?? '';

  let event;
  try {
    event = verifierSignatureWebhook(rawBody, signature);
  } catch {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  // Ne jamais faire confiance au statut transmis dans l'evenement recu :
  // revenir a l'API FedaPay pour lire le vrai statut, comme recommande
  // par FedaPay elle-meme (une personne malveillante pourrait sinon
  // forger une requete pretendant qu'un paiement a reussi).
  const transactionId = event.entity?.id;
  if (typeof transactionId !== 'number') {
    return NextResponse.json({ error: 'Evenement sans id de transaction' }, { status: 400 });
  }

  const { status, userId } = await verifierTransaction(transactionId);

  if (status !== 'approved' || !userId) {
    return NextResponse.json({ ok: true, ignore: true });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('config')
    .update({
      is_premium: true,
      premium_expires_at: Date.now() + TRENTE_JOURS_MS,
      updated_at: Date.now(),
    })
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Echec de mise a jour Supabase' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

Adapter `event.entity?.id` à la forme réelle confirmée pendant la Task 5 Step 4 si elle diffère.

- [ ] **Step 3 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 4 : Vérification manuelle — route accessible sans session, mais rejette une signature invalide**

Run: `cd frontend && npm run dev`, puis :

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/fedapay -d '{}'`
Expected : `400` (atteint la route sans redirection vers `/auth` — confirme que l'ajout à `authGate.ts` fonctionne — et rejette faute de signature valide).

- [ ] **Step 5 : Commit**

```bash
git add frontend/app/api/webhooks/fedapay/route.ts frontend/lib/authGate.ts
git commit -m "feat: webhook FedaPay - verification et activation du Premium"
```

---

### Task 9 : UI `/abonnement` — paiement réel

**Files:**
- Modify: `frontend/app/abonnement/page.tsx`

**Interfaces:**
- Consumes : `POST /api/paiement/creer` (Task 7), `Config.premiumExpiresAt` via `usePlan()` (Task 4), `requestSync()` de `frontend/lib/syncController.ts` (déjà existant).

- [ ] **Step 1 : Remplacer la modale par le vrai paiement**

Dans `frontend/app/abonnement/page.tsx`, remplacer l'état et le bouton "Renouveler" (actuellement lignes 45, 62-90, 178-193) :

- Retirer `const [showModal, setShowModal] = useState(false);` et le bloc `{showModal && (...)}`.
- Ajouter en haut du composant :

```tsx
import { usePlan } from '@/lib/hooks/usePlan';
import { requestSync } from '@/lib/syncController';
```

- Ajouter dans le composant, avant le `return` :

```tsx
  const { status: planStatus } = usePlan();
  const [paiementEnCours, setPaiementEnCours] = useState(false);
  const [erreurPaiement, setErreurPaiement] = useState('');
  const [verificationRetour, setVerificationRetour] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('paiement') !== 'retour') return;
    setVerificationRetour(true);
    requestSync();
    const interval = setInterval(() => requestSync(), 3000);
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setVerificationRetour(false);
    }, 20000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    if (verificationRetour && planStatus === 'premium') {
      setVerificationRetour(false);
    }
  }, [verificationRetour, planStatus]);

  async function lancerPaiement() {
    setPaiementEnCours(true);
    setErreurPaiement('');
    try {
      const res = await fetch('/api/paiement/creer', { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErreurPaiement("Impossible de lancer le paiement. Réessaie dans un instant.");
        setPaiementEnCours(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErreurPaiement("Impossible de lancer le paiement. Réessaie dans un instant.");
      setPaiementEnCours(false);
    }
  }
```

- Remplacer le bouton "Renouveler" (`onClick={() => setShowModal(true)}`) par `onClick={lancerPaiement}`, `disabled={paiementEnCours}`, et le texte du bouton par `{paiementEnCours ? 'Redirection...' : 'Renouveler (+30 jours)'}`.
- Juste avant le bouton, afficher les messages d'état :

```tsx
        {verificationRetour && (
          <div style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, marginBottom: 8 }}>
            Vérification du paiement...
          </div>
        )}
        {erreurPaiement && (
          <div style={{ textAlign: 'center', fontSize: 13, color: T.red, marginBottom: 8 }}>
            {erreurPaiement}
          </div>
        )}
```

- [ ] **Step 2 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 3 : Vérification manuelle**

Run: `cd frontend && npm run dev`, se connecter avec un compte de test dans le navigateur, ouvrir `/abonnement`, cliquer "Renouveler". Sans clés FedaPay valides configurées (`FEDAPAY_SECRET_KEY` absente en local), la requête `/api/paiement/creer` échouera — vérifier que le message d'erreur s'affiche proprement plutôt qu'un écran cassé. Ce test complet (vrai paiement bout-en-bout) nécessite les clés FedaPay et est à refaire une fois qu'elles seront disponibles sur Vercel.

- [ ] **Step 4 : Commit**

```bash
git add frontend/app/abonnement/page.tsx
git commit -m "feat: bouton Renouveler branche sur le vrai paiement FedaPay"
```

---

## Étapes manuelles restantes (hors code, après ce plan)

- **⚠️ OBLIGATOIRE AVANT LE DÉPLOIEMENT DE CETTE BRANCHE (pas seulement avant de tester les paiements) : Juanita exécute la migration de la Task 2 dans Supabase SQL Editor.** `configToRow` (dans `frontend/lib/sync.ts`) envoie désormais `premium_expires_at` dans **chaque** upsert de config, pour **tous** les utilisateurs, à chaque synchronisation — pas seulement ceux qui paient. Si la colonne n'existe pas encore côté Supabase au moment où ce code est déployé, Supabase rejette l'upsert de config, et cette erreur est fatale (`throw`) : elle interrompt toute la fonction `push()`, donc la synchronisation cloud des produits, ventes, packs, fournisseurs et commandes s'arrête aussi pour tout le monde, pas seulement les champs liés à Premium. Ordre à respecter impérativement : migration Supabase d'abord, déploiement du code ensuite — jamais l'inverse.
- Juanita ajoute dans Vercel (variables d'environnement) : `FEDAPAY_SECRET_KEY`, `FEDAPAY_ENVIRONMENT` (`sandbox` ou `live`), `FEDAPAY_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` (déjà visible dans Supabase Dashboard → Settings → API, jamais utilisée jusqu'ici dans ce projet).
- Juanita configure l'URL du webhook dans FedaPay Dashboard (section Webhooks) : `https://margopro.eidma.co/api/webhooks/fedapay`, et copie le secret généré dans `FEDAPAY_WEBHOOK_SECRET`.
- Test de paiement réel une fois tout branché (voir Task 9 Step 3).
