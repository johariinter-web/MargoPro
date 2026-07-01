# Gestion des appareils connectés — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au propriétaire du compte de voir tous les appareils connectés à son MargoPro et d'en bloquer/débloquer depuis les Paramètres.

**Architecture:** Chaque appareil génère un UUID stocké dans `localStorage` (`margo_device_id`). À chaque ouverture de l'app, il enregistre sa présence et vérifie son statut dans une table Supabase `device_sessions`. Si bloqué : déconnexion + message. La page Paramètres affiche la liste avec boutons Bloquer/Débloquer.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + RLS), Vitest

## Global Constraints

- `'use client'` obligatoire sur tout fichier utilisant `localStorage`, `navigator`, hooks React, ou router Next.js
- Inline styles uniquement (aucune classe Tailwind) — suivre le pattern de `parametres/page.tsx`
- Police : `fontFamily: 'Manrope, sans-serif'`
- Couleurs via `useColors()` de `@/lib/hooks/useColors` — ne jamais coder les couleurs en dur dans les composants
- Taille de police minimum 12px ; boutons minimum 44px de hauteur
- Supabase client : `createClient()` de `@/lib/supabase/client` (`createBrowserClient`)
- Pas de commentaires de code sauf si le WHY est non-obvie
- L'upsert vers `device_sessions` ne doit PAS inclure `is_blocked` dans le payload — PostgREST ne met à jour que les colonnes du payload, et on ne veut pas écraser un statut bloqué existant
- Tests : Vitest (`cd frontend && npm test`) — tester uniquement les fonctions pures

---

## Fichiers à créer ou modifier

| Action | Fichier | Rôle |
|---|---|---|
| Créer | `frontend/lib/deviceSession.ts` | Logique pure : ID appareil, nom, check/register, fetch, block, unblock |
| Créer | `frontend/lib/__tests__/deviceSession.test.ts` | Tests unitaires pour `parseDeviceName` |
| Créer | `frontend/lib/hooks/useDeviceSession.tsx` | `DeviceSessionStarter` : client component monté dans le layout |
| Créer | `frontend/components/Appareils.tsx` | Section "Appareils connectés" pour la page Paramètres |
| Modifier | `frontend/app/layout.tsx` | Ajouter `<DeviceSessionStarter />` à côté de `<SyncStarter />` |
| Modifier | `frontend/app/auth/page.tsx` | Afficher le message "appareil bloqué" si `sessionStorage` le signale |
| Modifier | `frontend/app/parametres/page.tsx` | Ajouter `<Appareils />` entre GROUP 3 et GROUP 4 |

---

## Task 1 : Table Supabase + `deviceSession.ts` + tests unitaires

**Files:**
- Create: `frontend/lib/deviceSession.ts`
- Create: `frontend/lib/__tests__/deviceSession.test.ts`

**Interfaces:**
- Produces:
  - `parseDeviceName(ua: string): string` — pure, testable
  - `getDeviceName(): string` — wrapper autour de `navigator.userAgent`
  - `getOrCreateDeviceId(): string` — lit/crée UUID dans `localStorage`
  - `DeviceSession` — type exporté
  - `checkAndRegisterDevice(supabase, userId): Promise<'ok' | 'blocked'>`
  - `fetchDevices(supabase, userId): Promise<DeviceSession[]>`
  - `blockDevice(supabase, sessionId): Promise<void>`
  - `unblockDevice(supabase, sessionId): Promise<void>`

- [ ] **Step 1 : Créer la table dans le dashboard Supabase**

Aller sur https://supabase.com → projet MargoPro → SQL Editor → New query. Coller et exécuter :

```sql
CREATE TABLE IF NOT EXISTS device_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id    TEXT NOT NULL,
  device_name  TEXT NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_blocked   BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_sessions_user_id_idx ON device_sessions(user_id);

ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_sessions_select" ON device_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "device_sessions_insert" ON device_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "device_sessions_update" ON device_sessions
  FOR UPDATE USING (auth.uid() = user_id);
```

Vérifier : pas d'erreur dans la sortie SQL.

- [ ] **Step 2 : Écrire les tests unitaires (ils vont échouer)**

Créer `frontend/lib/__tests__/deviceSession.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { parseDeviceName } from '../deviceSession';

describe('parseDeviceName', () => {
  it('identifie iPhone Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    expect(parseDeviceName(ua)).toBe('iPhone · Safari');
  });

  it('identifie Android Chrome', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';
    expect(parseDeviceName(ua)).toBe('Android · Chrome');
  });

  it('identifie Windows Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36';
    expect(parseDeviceName(ua)).toBe('Windows · Chrome');
  });

  it('identifie Mac Firefox', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0';
    expect(parseDeviceName(ua)).toBe('Mac · Firefox');
  });

  it('retourne fallback pour UA inconnu', () => {
    expect(parseDeviceName('')).toBe('Appareil · Navigateur');
  });
});
```

- [ ] **Step 3 : Vérifier que les tests échouent**

```bash
cd frontend && npm test
```

Attendu : FAIL — `Cannot find module '../deviceSession'`

- [ ] **Step 4 : Créer `frontend/lib/deviceSession.ts`**

```typescript
'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'margo_device_id';

export function parseDeviceName(ua: string): string {
  let browser = 'Navigateur';
  if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let platform = 'Appareil';
  if (/iPhone/.test(ua)) platform = 'iPhone';
  else if (/iPad/.test(ua)) platform = 'iPad';
  else if (/Android/.test(ua) && /Mobile/.test(ua)) platform = 'Android';
  else if (/Android/.test(ua)) platform = 'Tablette Android';
  else if (/Windows/.test(ua)) platform = 'Windows';
  else if (/Macintosh/.test(ua)) platform = 'Mac';
  else if (/Linux/.test(ua)) platform = 'Linux';

  return `${platform} · ${browser}`;
}

export function getDeviceName(): string {
  return parseDeviceName(navigator.userAgent);
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export type DeviceSession = {
  id: string;
  device_id: string;
  device_name: string;
  last_seen_at: string;
  is_blocked: boolean;
};

export async function checkAndRegisterDevice(
  supabase: SupabaseClient,
  userId: string,
): Promise<'ok' | 'blocked'> {
  const deviceId = getOrCreateDeviceId();

  const { data } = await supabase
    .from('device_sessions')
    .select('is_blocked')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (data?.is_blocked === true) return 'blocked';

  await supabase
    .from('device_sessions')
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_name: getDeviceName(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    );

  return 'ok';
}

export async function fetchDevices(
  supabase: SupabaseClient,
  userId: string,
): Promise<DeviceSession[]> {
  const { data, error } = await supabase
    .from('device_sessions')
    .select('id, device_id, device_name, last_seen_at, is_blocked')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeviceSession[];
}

export async function blockDevice(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('device_sessions')
    .update({ is_blocked: true })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function unblockDevice(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('device_sessions')
    .update({ is_blocked: false })
    .eq('id', sessionId);
  if (error) throw error;
}
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
cd frontend && npm test
```

Attendu :

```
✓ frontend/lib/__tests__/deviceSession.test.ts (5)
  ✓ parseDeviceName > identifie iPhone Safari
  ✓ parseDeviceName > identifie Android Chrome
  ✓ parseDeviceName > identifie Windows Chrome
  ✓ parseDeviceName > identifie Mac Firefox
  ✓ parseDeviceName > retourne fallback pour UA inconnu

Test Files  2 passed (2)
Tests       8 passed (8)
```

(Le fichier photoSync.test.ts existant doit aussi continuer à passer.)

- [ ] **Step 6 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Attendu : 0 erreur.

- [ ] **Step 7 : Commit**

```bash
git add frontend/lib/deviceSession.ts frontend/lib/__tests__/deviceSession.test.ts
git commit -m "feat: librairie deviceSession — ID, nom, check, fetch, block/unblock"
```

---

## Task 2 : `DeviceSessionStarter` + layout + message appareil bloqué

**Files:**
- Create: `frontend/lib/hooks/useDeviceSession.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/auth/page.tsx`

**Interfaces:**
- Consumes: `checkAndRegisterDevice` de `@/lib/deviceSession`
- Produces: `DeviceSessionStarter` — composant client à monter dans le layout (même pattern que `SyncStarter`)

- [ ] **Step 1 : Créer `frontend/lib/hooks/useDeviceSession.tsx`**

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAndRegisterDevice } from '@/lib/deviceSession';

export function DeviceSessionStarter() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function run() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;

      try {
        const result = await checkAndRegisterDevice(supabase, data.user.id);
        if (active && result === 'blocked') {
          sessionStorage.setItem('margo_bloque', '1');
          await supabase.auth.signOut();
          router.replace('/auth');
        }
      } catch {
        // Réseau absent ou Supabase indisponible : ne pas bloquer le démarrage.
      }
    }

    run();
    return () => { active = false; };
  }, [router]);

  return null;
}
```

- [ ] **Step 2 : Modifier `frontend/app/layout.tsx`**

Ajouter l'import de `DeviceSessionStarter` et le monter à côté de `SyncStarter`.

Fichier complet après modification :

```typescript
import type { Metadata, Viewport } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { SyncStarter } from "@/lib/hooks/useSync";
import { DeviceSessionStarter } from "@/lib/hooks/useDeviceSession";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MargoPro",
  description: "Gérez votre commerce simplement",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MargoPro",
  },
};

export const viewport: Viewport = {
  themeColor: "#D4601A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${manrope.variable} ${spaceGrotesk.variable} h-full`}>
      <head>
        {/* Init theme before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('margopro-theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body style={{ minHeight: '100%', background: 'var(--background)', color: 'var(--foreground)' }}>
        <SyncStarter />
        <DeviceSessionStarter />
        <main style={{ maxWidth: 480, margin: '0 auto', position: 'relative', minHeight: '100dvh' }}>
          {children}
          <BottomNav />
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3 : Modifier `frontend/app/auth/page.tsx` — afficher le message appareil bloqué**

Changer la ligne :
```typescript
const [erreur, setErreur] = useState('');
```

En :
```typescript
const [erreur, setErreur] = useState(() => {
  if (typeof window === 'undefined') return '';
  const bloque = sessionStorage.getItem('margo_bloque');
  if (bloque) {
    sessionStorage.removeItem('margo_bloque');
    return "Cet appareil a été bloqué par le propriétaire du compte. Contactez-le pour rétablir l'accès.";
  }
  return '';
});
```

Aucune autre modification dans ce fichier.

- [ ] **Step 4 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Attendu : 0 erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/lib/hooks/useDeviceSession.tsx frontend/app/layout.tsx frontend/app/auth/page.tsx
git commit -m "feat: DeviceSessionStarter — check au démarrage, blocage + message auth"
```

---

## Task 3 : `Appareils.tsx` + intégration Paramètres

**Files:**
- Create: `frontend/components/Appareils.tsx`
- Modify: `frontend/app/parametres/page.tsx`

**Interfaces:**
- Consumes:
  - `fetchDevices`, `blockDevice`, `unblockDevice`, `getOrCreateDeviceId`, `DeviceSession` de `@/lib/deviceSession`
  - `useColors` de `@/lib/hooks/useColors`
  - `createClient` de `@/lib/supabase/client`
- Produces: `Appareils` — composant à insérer dans la page Paramètres

- [ ] **Step 1 : Créer `frontend/components/Appareils.tsx`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { createClient } from '@/lib/supabase/client';
import {
  fetchDevices,
  blockDevice,
  unblockDevice,
  getOrCreateDeviceId,
  type DeviceSession,
} from '@/lib/deviceSession';

function tempsRelatif(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

function iconeAppareil(deviceName: string): string {
  if (/iPhone|iPad|Android|Tablette/.test(deviceName)) return '📱';
  return '💻';
}

export function Appareils() {
  const T = useColors();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [currentDeviceId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return getOrCreateDeviceId();
  });

  const loadDevices = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const list = await fetchDevices(supabase, data.user.id);
      setDevices(list);
      setError(null);
    } catch {
      setError('Impossible de charger les appareils. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  async function handleBlock(session: DeviceSession) {
    setConfirmingId(null);
    setActionId(session.id);
    try {
      const supabase = createClient();
      await blockDevice(supabase, session.id);
      setDevices(d => d.map(s => s.id === session.id ? { ...s, is_blocked: true } : s));
    } catch {
      setError('Erreur lors du blocage. Réessayez.');
    } finally {
      setActionId(null);
    }
  }

  async function handleUnblock(session: DeviceSession) {
    setActionId(session.id);
    try {
      const supabase = createClient();
      await unblockDevice(supabase, session.id);
      setDevices(d => d.map(s => s.id === session.id ? { ...s, is_blocked: false } : s));
    } catch {
      setError('Erreur lors du déblocage. Réessayez.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: T.textMuted,
        marginBottom: 6, paddingLeft: 4,
        fontFamily: 'Manrope, sans-serif',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Appareils connectés
      </div>
      <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>

        {loading && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: T.textMuted, fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>
            Chargement…
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', color: T.red, fontSize: 13, fontFamily: 'Manrope, sans-serif', background: T.redBg }}>
            {error}
          </div>
        )}

        {!loading && !error && devices.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: T.textMuted, fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>
            Aucun appareil enregistré.
          </div>
        )}

        {devices.map((session, idx) => {
          const isCurrent = session.device_id === currentDeviceId;
          const isLast = idx === devices.length - 1;
          const isConfirming = confirmingId === session.id;

          return (
            <div
              key={session.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
                background: T.surface,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>
                {iconeAppareil(session.device_name)}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                    {session.device_name}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: T.accent,
                      background: T.accentLight, borderRadius: 20,
                      padding: '2px 8px', flexShrink: 0, fontFamily: 'Manrope, sans-serif',
                    }}>
                      Cet appareil
                    </span>
                  )}
                  {session.is_blocked && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: T.red,
                      background: T.redBg, borderRadius: 20,
                      padding: '2px 8px', flexShrink: 0, fontFamily: 'Manrope, sans-serif',
                    }}>
                      Bloqué
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: 'Manrope, sans-serif' }}>
                  {tempsRelatif(session.last_seen_at)}
                </div>
              </div>

              {!isCurrent && (
                <>
                  {isConfirming ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setConfirmingId(null)}
                        style={{
                          padding: '6px 10px', borderRadius: 10, height: 34,
                          border: `1.5px solid ${T.border}`, background: T.bg,
                          color: T.textMuted, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleBlock(session)}
                        disabled={actionId === session.id}
                        style={{
                          padding: '6px 12px', borderRadius: 10, height: 34,
                          border: `1.5px solid ${T.red}`, background: T.redBg,
                          color: T.red, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', opacity: actionId === session.id ? 0.5 : 1,
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        Confirmer
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (session.is_blocked) handleUnblock(session);
                        else setConfirmingId(session.id);
                      }}
                      disabled={actionId === session.id}
                      style={{
                        padding: '6px 14px', borderRadius: 10, height: 34, flexShrink: 0,
                        border: `1.5px solid ${session.is_blocked ? T.green : T.red}`,
                        background: session.is_blocked ? T.greenBg : T.redBg,
                        color: session.is_blocked ? T.green : T.red,
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        opacity: actionId === session.id ? 0.5 : 1,
                        fontFamily: 'Manrope, sans-serif',
                      }}
                    >
                      {actionId === session.id ? '…' : session.is_blocked ? 'Débloquer' : 'Bloquer'}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Modifier `frontend/app/parametres/page.tsx`**

Ajouter l'import de `Appareils` en haut du fichier, après les imports existants (ligne 9) :

```typescript
import { Appareils } from '@/components/Appareils';
```

Ajouter le composant dans le JSX, entre le commentaire `{/* GROUP 3 : Système */}` (qui se termine vers la ligne 444) et `{/* GROUP 4 : Abonnement & Aide */}` :

```tsx
      {/* GROUP 4 : Appareils */}
      <Appareils />

      {/* GROUP 5 : Abonnement & Aide */}
```

(Les anciens "GROUP 4" et "GROUP 5" deviennent "GROUP 5" et "GROUP 6" — les commentaires sont cosmétiques, renommer si tu veux mais ce n'est pas obligatoire.)

- [ ] **Step 3 : Vérifier les types**

```bash
cd frontend && npm run type-check
```

Attendu : 0 erreur.

- [ ] **Step 4 : Lancer le dev server et tester manuellement**

```bash
cd frontend && npm run dev
```

1. Ouvrir http://localhost:3000/parametres
2. Vérifier que la section "Appareils connectés" apparaît, avec au moins 1 appareil (le tien) marqué "Cet appareil"
3. Se connecter depuis un autre navigateur (ou mode privé) avec le même compte
4. Rafraîchir http://localhost:3000/parametres sur le premier navigateur → 2 appareils dans la liste
5. Cliquer "Bloquer" sur le 2ème → confirmation → "Confirmer" → badge "Bloqué" apparaît
6. Ouvrir ou rafraîchir l'app dans le 2ème navigateur → doit être déconnecté et redirigé vers /auth avec le message bloqué
7. Cliquer "Débloquer" dans le premier navigateur → badge disparaît, bouton revient à "Bloquer"

- [ ] **Step 5 : Commit**

```bash
git add frontend/components/Appareils.tsx frontend/app/parametres/page.tsx
git commit -m "feat: section Appareils connectés dans les Paramètres"
```
