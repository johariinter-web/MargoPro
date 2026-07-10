# Programme de parrainage / affiliation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let MargoPro subscribers and non-subscribers earn a reward (free month or recurring commission) for referring new paying subscribers, with a code system, a public tracking page, and manual payout/reward handling by Juanita.

**Architecture:** Three new Supabase tables (`affiliates`, `parrainages`, `parrainage_paiements`) with public-read RLS for the no-login tracking page. `frontend/lib/parrainage.ts` holds pure calculation functions (unit-tested) plus thin Supabase I/O wrappers (untested, matching the existing `deviceSession.ts` convention). A new "Parrainage" section in Paramètres lets subscribers get their code and pick a reward. The landing page (`eidma-landing`, a **separate git repository**) gets an `#affiliation` section, a WhatsApp intake form for non-subscribers, a `?ref=` propagation script, and a standalone public tracking page.

**Tech Stack:** Next.js 15 App Router (client components), Supabase (`@supabase/supabase-js`), Vitest for unit tests, plain HTML/JS for the landing site (no build step there).

## Global Constraints

- Referral data lives only in Supabase — it is **not** synced to IndexedDB. This is a deliberate exception to "offline-first": parrainage is a manual, server-managed growth feature, not core commerce data (per the approved spec).
- No file under the Marges page (4th tab, "Pluriels", etc.) is touched — parrainage lives exclusively in Paramètres.
- Commission rate is fixed at **15%**, capped at **12 months per filleul**.
- Free month: **1 month per 4 filleuls who became paying**, cumulative, never re-granted for the same threshold.
- `parrainage_paiements` is never written by the app — only Juanita via the Supabase table editor (no insert/update RLS policy for it).
- `frontend/lib/parrainage.ts`: only the pure functions (code generation, commission calc, free-month progression) get unit tests. The thin Supabase CRUD wrappers are untested, matching the existing `deviceSession.ts` precedent (no Supabase mocking exists anywhere in this repo's tests).
- `eidma-landing` is a **separate git repository** at `C:\Users\HP\OneDrive\Documents\SAAS\Ed-main\eidma-landing`. Its changes must be committed separately from the MargoPro/frontend changes.
- Supabase migrations are written to a `.sql` file but **executed manually by Juanita** in the Supabase SQL Editor — no task in this plan runs SQL against the live database.

---

### Task 1: `parrainage.ts` — types + affiliate code generator

**Files:**
- Create: `frontend/lib/parrainage.ts`
- Test: `frontend/lib/__tests__/parrainage.test.ts`

**Interfaces:**
- Produces: `generateAffiliateCode(nom: string): string` — used by Task 4's `getOrCreateAffiliate`.

- [ ] **Step 1: Write the failing test**

Create `frontend/lib/__tests__/parrainage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateAffiliateCode } from '../parrainage';

describe('generateAffiliateCode', () => {
  it('utilise les 3 premières lettres du nom en préfixe', () => {
    const code = generateAffiliateCode('Boutique Aminata');
    expect(code.startsWith('BOU-')).toBe(true);
  });

  it('ignore les accents', () => {
    const code = generateAffiliateCode('Épicerie');
    expect(code.startsWith('EPI-')).toBe(true);
  });

  it('retombe sur MGP si le nom ne contient aucune lettre', () => {
    const code = generateAffiliateCode('123');
    expect(code.startsWith('MGP-')).toBe(true);
  });

  it('complète avec X si le nom fait moins de 3 lettres', () => {
    const code = generateAffiliateCode('Ay');
    expect(code.startsWith('AYX-')).toBe(true);
  });

  it('respecte le format PREFIXE-SUFFIXE', () => {
    const code = generateAffiliateCode('Boutique Aminata');
    expect(code).toMatch(/^[A-Z]{3}-[A-Z2-9]{4}$/);
  });

  it('génère des codes différents à chaque appel', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateAffiliateCode('Test')));
    expect(codes.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts`
Expected: FAIL with "Cannot find module '../parrainage'" (file doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

Create `frontend/lib/parrainage.ts`:

```ts
'use client';

const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function suffixeAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return Array.from(octets, o => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
}

export function generateAffiliateCode(nom: string): string {
  const lettres = nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const prefixe = (lettres.slice(0, 3) || 'MGP').padEnd(3, 'X');
  return `${prefixe}-${suffixeAleatoire(4)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/parrainage.ts frontend/lib/__tests__/parrainage.test.ts
git commit -m "feat: générateur de code d'affilié pour le parrainage"
```

---

### Task 2: `parrainage.ts` — calcul de la commission

**Files:**
- Modify: `frontend/lib/parrainage.ts`
- Test: `frontend/lib/__tests__/parrainage.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ParrainagePaiement` type and `computeCommissionSolde(paiements: ParrainagePaiement[]): number` — used by Task 4's `fetchAffiliatePaiements` caller (the Parrainage component, Task 9) and by the standalone tracking page (Task 11, reimplemented in vanilla JS there since it's a separate static site).

- [ ] **Step 1: Write the failing test**

Append to `frontend/lib/__tests__/parrainage.test.ts`:

```ts
import { computeCommissionSolde, type ParrainagePaiement } from '../parrainage';

describe('computeCommissionSolde', () => {
  it('calcule 15% du montant payé', () => {
    const solde = computeCommissionSolde([
      { parrainage_id: 'f1', mois: '2026-01', montant_paye: 3500, commission_versee: false },
    ]);
    expect(solde).toBe(525);
  });

  it('additionne plusieurs filleuls', () => {
    const solde = computeCommissionSolde([
      { parrainage_id: 'f1', mois: '2026-01', montant_paye: 3500, commission_versee: false },
      { parrainage_id: 'f2', mois: '2026-01', montant_paye: 3500, commission_versee: false },
    ]);
    expect(solde).toBe(1050);
  });

  it('ignore les commissions déjà versées', () => {
    const solde = computeCommissionSolde([
      { parrainage_id: 'f1', mois: '2026-01', montant_paye: 3500, commission_versee: true },
      { parrainage_id: 'f1', mois: '2026-02', montant_paye: 3500, commission_versee: false },
    ]);
    expect(solde).toBe(525);
  });

  it('plafonne à 12 mois par filleul', () => {
    const paiements: ParrainagePaiement[] = Array.from({ length: 13 }, (_, i) => ({
      parrainage_id: 'f1',
      mois: `2026-${String(i + 1).padStart(2, '0')}`,
      montant_paye: 1000,
      commission_versee: false,
    }));
    const solde = computeCommissionSolde(paiements);
    expect(solde).toBe(12 * 1000 * 0.15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts`
Expected: FAIL with "computeCommissionSolde is not exported" / "ParrainagePaiement" type error

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/lib/parrainage.ts`:

```ts
export interface ParrainagePaiement {
  parrainage_id: string;
  mois: string; // format 'YYYY-MM'
  montant_paye: number;
  commission_versee: boolean;
}

const TAUX_COMMISSION = 0.15;
const PLAFOND_MOIS_COMMISSION = 12;

export function computeCommissionSolde(paiements: ParrainagePaiement[]): number {
  const parFilleul = new Map<string, ParrainagePaiement[]>();
  for (const p of paiements) {
    const liste = parFilleul.get(p.parrainage_id) ?? [];
    liste.push(p);
    parFilleul.set(p.parrainage_id, liste);
  }

  let solde = 0;
  for (const liste of parFilleul.values()) {
    const douzeMoisTries = [...liste]
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .slice(0, PLAFOND_MOIS_COMMISSION);
    for (const p of douzeMoisTries) {
      if (!p.commission_versee) solde += p.montant_paye * TAUX_COMMISSION;
    }
  }
  return Math.round(solde);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts`
Expected: PASS (10 tests total)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/parrainage.ts frontend/lib/__tests__/parrainage.test.ts
git commit -m "feat: calcul du solde de commission de parrainage"
```

---

### Task 3: `parrainage.ts` — progression vers le mois gratuit

**Files:**
- Modify: `frontend/lib/parrainage.ts`
- Test: `frontend/lib/__tests__/parrainage.test.ts`

**Interfaces:**
- Consumes: `ParrainagePaiement` (Task 2).
- Produces: `ProgressionMoisGratuit` type and `computeMoisGratuitProgress(paiements, moisGratuitsAccordes): ProgressionMoisGratuit` — used by the Parrainage component (Task 9).

- [ ] **Step 1: Write the failing test**

Append to `frontend/lib/__tests__/parrainage.test.ts`:

```ts
import { computeMoisGratuitProgress } from '../parrainage';

describe('computeMoisGratuitProgress', () => {
  it('compte les filleuls distincts ayant au moins un paiement', () => {
    const r = computeMoisGratuitProgress([
      { parrainage_id: 'f1', mois: '2026-01', montant_paye: 3500, commission_versee: false },
      { parrainage_id: 'f1', mois: '2026-02', montant_paye: 3500, commission_versee: false },
      { parrainage_id: 'f2', mois: '2026-01', montant_paye: 3500, commission_versee: false },
    ], 0);
    expect(r.filleulsPayants).toBe(2);
  });

  it('accorde 1 mois gratuit tous les 4 filleuls payants', () => {
    const paiements = ['f1', 'f2', 'f3', 'f4'].map(id => ({
      parrainage_id: id, mois: '2026-01', montant_paye: 3500, commission_versee: false,
    }));
    const r = computeMoisGratuitProgress(paiements, 0);
    expect(r.moisDus).toBe(1);
  });

  it('ne redonne pas un mois déjà accordé', () => {
    const paiements = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'].map(id => ({
      parrainage_id: id, mois: '2026-01', montant_paye: 3500, commission_versee: false,
    }));
    const r = computeMoisGratuitProgress(paiements, 1);
    expect(r.moisDus).toBe(0);
  });

  it('accorde un 2e mois au 8e filleul payant', () => {
    const paiements = Array.from({ length: 8 }, (_, i) => ({
      parrainage_id: `f${i}`, mois: '2026-01', montant_paye: 3500, commission_versee: false,
    }));
    const r = computeMoisGratuitProgress(paiements, 1);
    expect(r.moisDus).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts`
Expected: FAIL with "computeMoisGratuitProgress is not exported"

- [ ] **Step 3: Write minimal implementation**

Append to `frontend/lib/parrainage.ts`:

```ts
export interface ProgressionMoisGratuit {
  filleulsPayants: number;
  moisDus: number;
}

export function computeMoisGratuitProgress(
  paiements: ParrainagePaiement[],
  moisGratuitsAccordes: number,
): ProgressionMoisGratuit {
  const filleulsPayants = new Set(paiements.map(p => p.parrainage_id)).size;
  const moisDus = Math.max(0, Math.floor(filleulsPayants / 4) - moisGratuitsAccordes);
  return { filleulsPayants, moisDus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts`
Expected: PASS (14 tests total)

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/parrainage.ts frontend/lib/__tests__/parrainage.test.ts
git commit -m "feat: calcul de la progression vers le mois gratuit"
```

---

### Task 4: `parrainage.ts` — I/O Supabase (affilié)

**Files:**
- Modify: `frontend/lib/parrainage.ts`

**Interfaces:**
- Consumes: `generateAffiliateCode` (Task 1), `ParrainagePaiement` (Task 2).
- Produces: `Affiliate`, `RecompenseType` types; `getOrCreateAffiliate(supabase, userId, nom): Promise<Affiliate>`; `updateRecompense(supabase, affiliateId, recompense): Promise<void>`; `fetchAffiliatePaiements(supabase, affiliateId): Promise<ParrainagePaiement[]>` — all consumed by the Parrainage component (Task 9). No test (matches `deviceSession.ts` convention: Supabase CRUD wrappers are untested in this repo).

- [ ] **Step 1: Write the implementation**

Append to `frontend/lib/parrainage.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export type RecompenseType = 'mois_gratuit' | 'commission';

export interface Affiliate {
  id: string;
  code: string;
  nom: string;
  type: 'abonne' | 'non_abonne';
  recompense: RecompenseType | null;
  mois_gratuits_accordes: number;
}

export async function getOrCreateAffiliate(
  supabase: SupabaseClient,
  userId: string,
  nom: string,
): Promise<Affiliate> {
  const { data: existant } = await supabase
    .from('affiliates')
    .select('id, code, nom, type, recompense, mois_gratuits_accordes')
    .eq('user_id', userId)
    .maybeSingle();
  if (existant) return existant as Affiliate;

  for (let tentative = 0; tentative < 5; tentative++) {
    const code = generateAffiliateCode(nom);
    const { data, error } = await supabase
      .from('affiliates')
      .insert({ user_id: userId, code, nom, type: 'abonne' })
      .select('id, code, nom, type, recompense, mois_gratuits_accordes')
      .single();
    if (!error) return data as Affiliate;
    if (!error.message.includes('duplicate key')) throw error;
  }
  throw new Error("Impossible de générer un code de parrainage unique.");
}

export async function updateRecompense(
  supabase: SupabaseClient,
  affiliateId: string,
  recompense: RecompenseType,
): Promise<void> {
  const { error } = await supabase
    .from('affiliates')
    .update({ recompense })
    .eq('id', affiliateId);
  if (error) throw error;
}

interface ParrainageAvecPaiements {
  id: string;
  parrainage_paiements: ParrainagePaiement[];
}

export async function fetchAffiliatePaiements(
  supabase: SupabaseClient,
  affiliateId: string,
): Promise<ParrainagePaiement[]> {
  const { data, error } = await supabase
    .from('parrainages')
    .select('id, parrainage_paiements(parrainage_id, mois, montant_paye, commission_versee)')
    .eq('affiliate_id', affiliateId);
  if (error) throw error;
  return ((data ?? []) as ParrainageAvecPaiements[]).flatMap(p => p.parrainage_paiements ?? []);
}
```

- [ ] **Step 2: Verify existing tests still pass and types check**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts && npx tsc --noEmit`
Expected: 14 tests still PASS, no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/parrainage.ts
git commit -m "feat: I/O Supabase pour la génération et la mise à jour de l'affilié"
```

---

### Task 5: `parrainage.ts` — capture et consommation du code de parrainage

**Files:**
- Modify: `frontend/lib/parrainage.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `storeReferralCode(): void` — consumed by `ReferralCapture.tsx` (Task 7). `consumeReferralCode(supabase, userId, filleulNom): Promise<void>` — consumed by `onboarding/page.tsx` (Task 8). No test (Supabase I/O + browser `localStorage`/`window.location`, matches convention).

- [ ] **Step 1: Write the implementation**

Append to `frontend/lib/parrainage.ts`:

```ts
const REFERRAL_STORAGE_KEY = 'margo_referral_code';

/** Lit `?ref=CODE` dans l'URL courante et le garde en mémoire jusqu'à l'inscription. */
export function storeReferralCode(): void {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('ref');
  if (code) localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase());
}

/** Rattache le nouveau compte au code de parrainage stocké, si présent. Échoue silencieusement
 *  si le code est invalide : ne doit jamais bloquer l'inscription. */
export async function consumeReferralCode(
  supabase: SupabaseClient,
  userId: string,
  filleulNom: string,
): Promise<void> {
  const code = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!code) return;

  try {
    const { data: dejaParraine } = await supabase
      .from('parrainages')
      .select('id')
      .eq('filleul_user_id', userId)
      .maybeSingle();
    if (dejaParraine) return;

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!affiliate) return;

    await supabase.from('parrainages').insert({
      affiliate_id: affiliate.id,
      filleul_nom: filleulNom,
      filleul_user_id: userId,
      code_utilise: code,
    });
  } finally {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  }
}
```

- [ ] **Step 2: Verify existing tests still pass and types check**

Run: `cd frontend && npx vitest run lib/__tests__/parrainage.test.ts && npx tsc --noEmit`
Expected: 14 tests still PASS, no type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/parrainage.ts
git commit -m "feat: capture et consommation du code de parrainage à l'inscription"
```

---

### Task 6: Migration Supabase — tables et RLS du parrainage

**Files:**
- Create: `frontend/supabase-migration-2026-07-10c-parrainage.sql`

**Interfaces:**
- Produces: tables `public.affiliates`, `public.parrainages`, `public.parrainage_paiements` — consumed by every Supabase call in Tasks 4, 5, 9, 11.

- [ ] **Step 1: Write the migration file**

Create `frontend/supabase-migration-2026-07-10c-parrainage.sql`:

```sql
-- =====================================================================
-- MargoPro — Migration 2026-07-10c
-- Programme de parrainage / affiliation
--
-- Crée les tables affiliates / parrainages / parrainage_paiements et
-- leurs policies RLS. Voir docs/superpowers/specs/2026-07-10-parrainage-design.md
-- pour le design complet.
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

create table if not exists public.affiliates (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  nom          text not null,
  contact      text,
  type         text not null check (type in ('abonne', 'non_abonne')),
  user_id      uuid references auth.users(id) on delete set null,
  recompense   text check (recompense in ('mois_gratuit', 'commission')),
  mois_gratuits_accordes integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists affiliates_user_id_idx on public.affiliates(user_id);

create table if not exists public.parrainages (
  id               uuid primary key default gen_random_uuid(),
  affiliate_id     uuid not null references public.affiliates(id) on delete cascade,
  filleul_nom      text not null,
  filleul_contact  text,
  filleul_user_id  uuid references auth.users(id) on delete set null,
  code_utilise     text not null,
  date_inscription timestamptz not null default now()
);
create index if not exists parrainages_affiliate_id_idx on public.parrainages(affiliate_id);

create table if not exists public.parrainage_paiements (
  id                 uuid primary key default gen_random_uuid(),
  parrainage_id      uuid not null references public.parrainages(id) on delete cascade,
  mois               text not null,           -- format 'YYYY-MM'
  montant_paye       numeric not null,        -- montant payé par le filleul ce mois-là
  commission_versee  boolean not null default false,
  created_at         timestamptz not null default now(),
  unique (parrainage_id, mois)
);

alter table public.affiliates enable row level security;
alter table public.parrainages enable row level security;
alter table public.parrainage_paiements enable row level security;

-- Un abonné gère sa propre ligne affilié
drop policy if exists "affiliates_owner" on public.affiliates;
create policy "affiliates_owner" on public.affiliates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Lecture publique par code (page de suivi, sans login) — l'app ne
-- sélectionne jamais `contact` depuis ce canal public
drop policy if exists "affiliates_public_read" on public.affiliates;
create policy "affiliates_public_read" on public.affiliates
  for select using (true);

drop policy if exists "parrainages_public_read" on public.parrainages;
create policy "parrainages_public_read" on public.parrainages
  for select using (true);

drop policy if exists "parrainage_paiements_public_read" on public.parrainage_paiements;
create policy "parrainage_paiements_public_read" on public.parrainage_paiements
  for select using (true);

-- Écriture (nouveau filleul) réservée à l'utilisateur qui vient de
-- s'inscrire, pour rattacher son propre user_id
drop policy if exists "parrainages_insert_self" on public.parrainages;
create policy "parrainages_insert_self" on public.parrainages
  for insert with check (auth.uid() = filleul_user_id);

-- parrainage_paiements : aucune policy insert/update publique — Juanita
-- gère via l'éditeur Supabase (accès service role, ignore RLS)
```

- [ ] **Step 2: Ask Juanita to run it**

This file is not executed by this plan. Tell Juanita: "Exécute `frontend/supabase-migration-2026-07-10c-parrainage.sql` dans Supabase → SQL Editor avant de tester la section Parrainage."

- [ ] **Step 3: Commit**

```bash
git add frontend/supabase-migration-2026-07-10c-parrainage.sql
git commit -m "feat: migration SQL pour les tables du parrainage"
```

---

### Task 7: Capture globale du code de parrainage (`?ref=`)

**Files:**
- Create: `frontend/components/ReferralCapture.tsx`
- Modify: `frontend/app/layout.tsx`

**Interfaces:**
- Consumes: `storeReferralCode` (Task 5).
- Produces: nothing consumed by later tasks — this is a side-effect-only mount, same pattern as `DeviceSessionStarter`.

- [ ] **Step 1: Write the component**

Create `frontend/components/ReferralCapture.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { storeReferralCode } from '@/lib/parrainage';

export function ReferralCapture() {
  useEffect(() => {
    storeReferralCode();
  }, []);

  return null;
}
```

- [ ] **Step 2: Mount it in the root layout**

In `frontend/app/layout.tsx`, add the import next to the other starter components:

```tsx
import { DeviceSessionStarter } from "@/lib/hooks/useDeviceSession";
import { ReferralCapture } from "@/components/ReferralCapture";
```

And mount it next to `<DeviceSessionStarter />`:

```tsx
        <SyncStarter />
        <DeviceSessionStarter />
        <ReferralCapture />
```

- [ ] **Step 3: Verify the build type-checks**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/components/ReferralCapture.tsx frontend/app/layout.tsx
git commit -m "feat: capture du code de parrainage depuis l'URL sur toutes les pages"
```

---

### Task 8: Consommer le code de parrainage après inscription

**Files:**
- Modify: `frontend/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `consumeReferralCode` (Task 5), `createClient` (existing `@/lib/supabase/client`).

- [ ] **Step 1: Write the implementation**

In `frontend/app/onboarding/page.tsx`, add imports:

```tsx
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { consumeReferralCode } from '@/lib/parrainage';
```

(replace the existing `import { useState } from 'react';` at the top of the file with the `useState, useEffect` line above.)

Add this effect inside `OnboardingPage`, right after the existing `useState` declarations:

```tsx
  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (active && data.user) {
        await consumeReferralCode(supabase, data.user.id, data.user.email ?? 'Filleul');
      }
    })();
    return () => { active = false; };
  }, []);
```

- [ ] **Step 2: Verify types and existing tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Manual check**

Run `cd frontend && npm run dev`, then in a browser visit `http://localhost:3000/onboarding?ref=TESTCODE`, open dev tools → Application → Local Storage, confirm `margo_referral_code` is set to `TESTCODE`. This only proves capture (Task 7); consumption requires a real signup and a matching `affiliates` row, which needs Task 6's migration run and a real affiliate — defer full end-to-end verification to manual testing after Task 9 is also done.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/onboarding/page.tsx
git commit -m "feat: rattacher le nouveau compte au parrain après inscription"
```

---

### Task 9: Section "Parrainage" dans Paramètres

**Files:**
- Create: `frontend/components/Parrainage.tsx`

**Interfaces:**
- Consumes: `getOrCreateAffiliate`, `updateRecompense`, `fetchAffiliatePaiements`, `computeCommissionSolde`, `computeMoisGratuitProgress`, `Affiliate`, `RecompenseType` (Tasks 1–4), `useColors` (existing), `useConfig` (existing), `createClient` (existing).
- Produces: `<Parrainage />` component — mounted in `parametres/page.tsx` (Task 10).

- [ ] **Step 1: Write the component**

Create `frontend/components/Parrainage.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import { createClient } from '@/lib/supabase/client';
import {
  getOrCreateAffiliate,
  updateRecompense,
  fetchAffiliatePaiements,
  computeCommissionSolde,
  computeMoisGratuitProgress,
  type Affiliate,
  type RecompenseType,
} from '@/lib/parrainage';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function Parrainage() {
  const T = useColors();
  const { config } = useConfig();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [solde, setSolde] = useState(0);
  const [progression, setProgression] = useState({ filleulsPayants: 0, moisDus: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);

  const charger = useCallback(async () => {
    if (!config?.nomCommerce) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const a = await getOrCreateAffiliate(supabase, data.user.id, config.nomCommerce);
      setAffiliate(a);

      const paiements = await fetchAffiliatePaiements(supabase, a.id);
      setSolde(computeCommissionSolde(paiements));
      setProgression(computeMoisGratuitProgress(paiements, a.mois_gratuits_accordes));
      setError(null);
    } catch {
      setError('Impossible de charger le parrainage. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [config?.nomCommerce]);

  useEffect(() => { charger(); }, [charger]);

  async function choisirRecompense(recompense: RecompenseType) {
    if (!affiliate) return;
    setAffiliate({ ...affiliate, recompense });
    try {
      const supabase = createClient();
      await updateRecompense(supabase, affiliate.id, recompense);
    } catch {
      setError('Erreur lors de la sauvegarde. Réessayez.');
    }
  }

  function copierCode() {
    if (!affiliate) return;
    navigator.clipboard.writeText(affiliate.code);
    setCopie(true);
    setTimeout(() => setCopie(false), 1500);
  }

  function partagerWhatsApp() {
    if (!affiliate) return;
    const texte = `Je gère mon commerce avec MargoPro, l'appli qui suit stock, ventes et marges. Inscris-toi avec mon code ${affiliate.code} : https://eidma.co/?ref=${affiliate.code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank');
  }

  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: T.textMuted,
        marginBottom: 6, paddingLeft: 4,
        fontFamily: 'Manrope, sans-serif',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Parrainage
      </div>
      <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden', padding: 16 }}>

        {loading && (
          <div style={{ textAlign: 'center', color: T.textMuted, fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>
            Chargement…
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', margin: '-16px -16px 12px', color: T.red, fontSize: 13, fontFamily: 'Manrope, sans-serif', background: T.redBg }}>
            {error}
          </div>
        )}

        {!loading && affiliate && (
          <>
            <p style={{ fontSize: 13, color: T.textSub, marginTop: 0, marginBottom: 12, fontFamily: 'Manrope, sans-serif' }}>
              Partagez votre code. Vous gagnez une récompense pour chaque commerçant qui s&apos;abonne grâce à vous.
            </p>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.accentLight, borderRadius: 12, padding: '12px 14px', marginBottom: 12,
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: T.accent, letterSpacing: '1px', fontFamily: '"Space Grotesk", sans-serif' }}>
                {affiliate.code}
              </span>
              <button
                onClick={copierCode}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 9, border: 'none',
                  background: copie ? T.green : T.accent, color: 'white',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                }}
              >
                {copie ? 'Copié' : 'Copier'}
              </button>
            </div>

            <button
              onClick={partagerWhatsApp}
              style={{
                width: '100%', height: 44, borderRadius: 12, border: 'none',
                background: T.green, color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif', marginBottom: 16,
              }}
            >
              Partager via WhatsApp
            </button>

            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}>
              Votre récompense
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['mois_gratuit', 'commission'] as RecompenseType[]).map(r => (
                <button
                  key={r}
                  onClick={() => choisirRecompense(r)}
                  style={{
                    flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${affiliate.recompense === r ? T.accent : T.border}`,
                    background: affiliate.recompense === r ? T.accentLight : T.bg,
                    fontFamily: 'Manrope, sans-serif',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                    {r === 'mois_gratuit' ? '1 mois gratuit' : 'Commission 15%'}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {r === 'mois_gratuit' ? 'Tous les 4 filleuls payants' : 'Chaque mois, 12 mois max'}
                  </div>
                </button>
              ))}
            </div>

            {affiliate.recompense === 'commission' && (
              <div style={{ background: T.greenBg, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: 'Manrope, sans-serif' }}>
                  Solde de commission : {fmtF(solde)} FCFA
                </span>
              </div>
            )}

            {affiliate.recompense === 'mois_gratuit' && (
              <div style={{ background: T.greenBg, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: 'Manrope, sans-serif' }}>
                  {progression.filleulsPayants % 4} / 4 filleuls payants vers le prochain mois gratuit
                </span>
              </div>
            )}

            <a
              href={`https://eidma.co/parrainage.html?code=${affiliate.code}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: T.accent, fontWeight: 600, fontFamily: 'Manrope, sans-serif', textDecoration: 'underline' }}
            >
              Voir le suivi complet →
            </a>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify types**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/components/Parrainage.tsx
git commit -m "feat: section Parrainage dans Paramètres"
```

---

### Task 10: Monter `<Parrainage />` dans Paramètres

**Files:**
- Modify: `frontend/app/parametres/page.tsx`

**Interfaces:**
- Consumes: `Parrainage` component (Task 9).

- [ ] **Step 1: Add the import**

In `frontend/app/parametres/page.tsx`, next to the existing `Appareils` import:

```tsx
import { Appareils } from '@/components/Appareils';
import { Parrainage } from '@/components/Parrainage';
```

- [ ] **Step 2: Mount it under "Appareils connectés"**

Replace:

```tsx
      {/* GROUP 4 : Appareils */}
      <Appareils />
```

with:

```tsx
      {/* GROUP 4 : Appareils */}
      <Appareils />

      {/* GROUP 4b : Parrainage */}
      <Parrainage />
```

- [ ] **Step 3: Manual verification in the browser**

Run `cd frontend && npm run dev`, log in, go to Paramètres. Confirm a "Parrainage" card appears below "Appareils connectés" showing a generated code, the two reward-choice buttons, and the "Voir le suivi complet" link. Click each reward button and confirm the selection highlights and persists after a page reload. This requires Task 6's migration to have been run against Supabase first.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/parametres/page.tsx
git commit -m "feat: afficher la section Parrainage dans Paramètres"
```

---

### Task 11: Page de suivi publique (`eidma-landing`)

**Files:**
- Create: `C:\Users\HP\OneDrive\Documents\SAAS\Ed-main\eidma-landing\parrainage.html`

**Interfaces:**
- Consumes: `public.affiliates`, `public.parrainages`, `public.parrainage_paiements` (Task 6) via the Supabase JS CDN client and the public anon key (same project as `frontend/.env.local`'s `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to embed since it's the public browser key already shipped in the MargoPro app bundle).

**Note:** this file lives in the separate `eidma-landing` git repository — commit it there, not in MargoPro.

- [ ] **Step 1: Write the page**

Create `C:\Users\HP\OneDrive\Documents\SAAS\Ed-main\eidma-landing\parrainage.html`:

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Suivi de parrainage — MargoPro</title>
  <meta name="robots" content="noindex">
  <style>
    body{font-family:'DM Sans',system-ui,sans-serif;color:#1F2937;background:#FAFAF8;line-height:1.5;margin:0;padding:32px 20px}
    .wrap{max-width:480px;margin:0 auto}
    .card{background:white;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:24px;margin-bottom:16px}
    h1{font-family:'Space Grotesk',sans-serif;font-size:22px;font-weight:800;margin:0 0 6px}
    .code{font-family:'Space Grotesk',sans-serif;font-size:24px;font-weight:800;color:#C2501A;letter-spacing:1px}
    .muted{color:#6B7280;font-size:14px}
    .row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(0,0,0,.06)}
    .row:last-child{border-bottom:none}
    .badge{font-size:12px;font-weight:700;padding:3px 10px;border-radius:100px}
    .badge-attente{background:#FEF3D8;color:#92650A}
    .badge-payant{background:#EAF5EE;color:#166534}
    .solde{font-size:28px;font-weight:800;color:#166534;font-family:'Space Grotesk',sans-serif}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Suivi de parrainage</h1>
      <p class="muted" id="intro">Chargement…</p>
    </div>
    <div class="card" id="stats-card" style="display:none">
      <p class="muted" style="margin:0 0 6px" id="stats-label"></p>
      <div class="solde" id="stats-valeur"></div>
    </div>
    <div class="card" id="liste-card" style="display:none">
      <p class="muted" style="margin:0 0 10px;font-weight:700;color:#1F2937">Vos filleuls</p>
      <div id="liste"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <script>
  (function () {
    var SUPABASE_URL = 'https://qkyvzvehqmjjepkaihte.supabase.co';
    var SUPABASE_ANON_KEY = 'sb_publishable_cMzkFR9BIOQYvMq0Qp8QLA_5cdKI53H';
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    var code = new URLSearchParams(window.location.search).get('code');
    var intro = document.getElementById('intro');

    if (!code) {
      intro.textContent = 'Code introuvable.';
      return;
    }

    async function charger() {
      var res = await supabase
        .from('affiliates')
        .select('id, code, recompense, mois_gratuits_accordes')
        .eq('code', code)
        .maybeSingle();
      var affiliate = res.data;

      if (!affiliate) {
        intro.textContent = 'Code introuvable.';
        return;
      }

      intro.innerHTML = 'Code <span class="code">' + affiliate.code + '</span>';

      var parrainagesRes = await supabase
        .from('parrainages')
        .select('id, filleul_nom, date_inscription')
        .eq('affiliate_id', affiliate.id)
        .order('date_inscription', { ascending: false });
      var parrainages = parrainagesRes.data || [];

      var paiementsRes = await supabase
        .from('parrainage_paiements')
        .select('parrainage_id, mois, montant_paye, commission_versee')
        .in('parrainage_id', parrainages.map(function (p) { return p.id; }));
      var paiements = paiementsRes.data || [];

      afficherStats(affiliate, paiements);
      afficherListe(parrainages, paiements);
    }

    function afficherStats(affiliate, paiements) {
      var statsCard = document.getElementById('stats-card');
      var label = document.getElementById('stats-label');
      var valeur = document.getElementById('stats-valeur');
      statsCard.style.display = 'block';

      if (affiliate.recompense === 'mois_gratuit') {
        var filleulsPayants = new Set(paiements.map(function (p) { return p.parrainage_id; })).size;
        label.textContent = 'Progression vers le prochain mois gratuit';
        valeur.textContent = (filleulsPayants % 4) + ' / 4 filleuls payants';
      } else {
        var parFilleul = {};
        paiements.forEach(function (p) {
          (parFilleul[p.parrainage_id] = parFilleul[p.parrainage_id] || []).push(p);
        });
        var solde = 0;
        Object.keys(parFilleul).forEach(function (id) {
          var douzeMois = parFilleul[id]
            .slice()
            .sort(function (a, b) { return a.mois.localeCompare(b.mois); })
            .slice(0, 12);
          douzeMois.forEach(function (p) {
            if (!p.commission_versee) solde += p.montant_paye * 0.15;
          });
        });
        label.textContent = 'Solde de commission';
        valeur.textContent = Math.round(solde).toLocaleString('fr-FR') + ' FCFA';
      }
    }

    function afficherListe(parrainages, paiements) {
      var listeCard = document.getElementById('liste-card');
      var liste = document.getElementById('liste');
      listeCard.style.display = 'block';
      if (parrainages.length === 0) {
        liste.innerHTML = '<p class="muted">Aucun filleul pour l\'instant.</p>';
        return;
      }
      var payants = new Set(paiements.map(function (p) { return p.parrainage_id; }));
      liste.innerHTML = parrainages.map(function (p) {
        var estPayant = payants.has(p.id);
        return '<div class="row"><span>' + p.filleul_nom + '</span>' +
          '<span class="badge ' + (estPayant ? 'badge-payant' : 'badge-attente') + '">' +
          (estPayant ? 'Payant' : 'En attente') + '</span></div>';
      }).join('');
    }

    charger().catch(function () {
      intro.textContent = 'Code introuvable.';
    });
  })();
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

Open the file directly in a browser (`file://.../parrainage.html?code=UNCODEQUIEXISTE`) once Task 6's migration has run and at least one affiliate row exists. Confirm: unknown code shows "Code introuvable.", a known code shows its filleuls list and the correct stat block (commission or mois-gratuit) depending on `recompense`.

- [ ] **Step 3: Commit (in the `eidma-landing` repo)**

```bash
cd "C:\Users\HP\OneDrive\Documents\SAAS\Ed-main\eidma-landing"
git add parrainage.html
git commit -m "feat: page de suivi public du parrainage"
```

---

### Task 12: Section `#affiliation` + propagation du `?ref=` (`eidma-landing/index.html`)

**Files:**
- Modify: `C:\Users\HP\OneDrive\Documents\SAAS\Ed-main\eidma-landing\index.html`

**Interfaces:**
- Consumes: nothing internal — this is the entry point that produces the `?ref=CODE` query string consumed by `ReferralCapture.tsx` (Task 7).

**Note:** this file lives in the separate `eidma-landing` git repository — commit it there, not in MargoPro. The nav already has a working `<a href="#affiliation">` link (added 2026-07-09) — this task only needs to add the matching section and scripts, not touch the nav.

- [ ] **Step 1: Insert the `#affiliation` section**

In `index.html`, the "Tarifs" section (`<section id="tarifs" ...>`) closes with `</section>` right before the comment `<!-- FAQ -->` (a second, duplicate `id="faq"` section already exists later in the file — pre-existing, not part of this task). Insert the new section right after that `</section>`:

```html
<!-- ── AFFILIATION ── -->
<section id="affiliation" style="background:white;padding:96px 0">
  <div style="max-width:720px;margin:0 auto;padding:0 64px">
    <div style="text-align:center;margin-bottom:48px">
      <div style="display:inline-flex;background:#FEF0E8;border:1px solid #F4B896;border-radius:100px;padding:7px 16px;margin-bottom:18px"><span style="font-size:13px;color:#C2501A;font-weight:600">Affiliation</span></div>
      <h2 style="font-family:'Space Grotesk',sans-serif;font-size:30px;font-weight:800;color:#1F2937;letter-spacing:-.02em;margin-bottom:14px">Gagnez en recommandant MargoPro</h2>
      <p style="font-size:16px;color:#6B7280;max-width:520px;margin:0 auto;line-height:1.65">Que vous utilisiez déjà MargoPro ou non, vous pouvez gagner une récompense pour chaque commerçant qui s'abonne grâce à vous.</p>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:48px">
      <div style="background:#FAFAF8;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:26px">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#1F2937;margin-bottom:8px">Déjà abonné ?</div>
        <p style="font-size:14px;color:#6B7280;line-height:1.6;margin-bottom:14px">Générez votre code directement dans l'application, dans Paramètres → Parrainage. Choisissez entre 1 mois gratuit tous les 4 filleuls, ou 15% de commission récurrente.</p>
        <a href="https://margopro.eidma.co" target="_blank" rel="noopener" style="text-decoration:none;color:#C2501A;font-size:14px;font-weight:700">Ouvrir MargoPro →</a>
      </div>
      <div style="background:#FAFAF8;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:26px">
        <div style="font-family:'Space Grotesk',sans-serif;font-size:16px;font-weight:700;color:#1F2937;margin-bottom:8px">Pas encore d'abonnement ?</div>
        <p style="font-size:14px;color:#6B7280;line-height:1.6">Recevez 15% de commission récurrente (12 mois max par filleul) en recommandant MargoPro autour de vous. Remplissez le formulaire ci-dessous pour recevoir votre code.</p>
      </div>
    </div>

    <div id="affiliation-wrap" style="max-width:420px;margin:0 auto">
      <form id="affiliation-form">
        <div style="margin-bottom:14px">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Votre nom *</label>
          <input type="text" name="nom" required placeholder="Aminata Diop" style="width:100%;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:9px;font-size:14px;font-family:inherit;color:#1F2937;outline:none;box-sizing:border-box">
        </div>
        <div style="margin-bottom:20px">
          <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px">Votre numéro WhatsApp *</label>
          <input type="tel" name="whatsapp" required placeholder="+221 77 000 00 00" style="width:100%;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:9px;font-size:14px;font-family:inherit;color:#1F2937;outline:none;box-sizing:border-box">
        </div>
        <button type="submit" style="width:100%;background:#C2501A;color:white;padding:14px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit">Recevoir mon code d'affilié</button>
      </form>
      <div id="affiliation-thanks" style="display:none;text-align:center;padding:36px 20px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:14px">
        <div style="font-size:40px;margin-bottom:12px">🎉</div>
        <p style="font-family:'Space Grotesk',sans-serif;font-size:18px;font-weight:700;color:#15803D;margin-bottom:6px">Demande envoyée !</p>
        <p style="font-size:14px;color:#166534;line-height:1.6">Nous allons vous envoyer votre code d'affilié personnalisé sur WhatsApp très bientôt.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Add the form-submit and ref-propagation scripts**

At the end of the file, right before the closing `</body>` tag (after the existing carousel-arrow `<script>` block), add:

```html
<script>
// ── Formulaire affiliation (non-abonnés) — envoi WhatsApp ──
(function() {
  var form = document.getElementById('affiliation-form');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var nom = (form.querySelector('[name="nom"]') || {}).value || '';
    var whatsapp = (form.querySelector('[name="whatsapp"]') || {}).value || '';
    var msg = '🤝 Demande de code affilié MargoPro\n\n'
      + 'Nom : ' + nom + '\n'
      + 'WhatsApp : ' + whatsapp;
    form.style.display = 'none';
    document.getElementById('affiliation-thanks').style.display = 'block';
    setTimeout(function() {
      window.open('https://wa.me/15145522214?text=' + encodeURIComponent(msg), '_blank');
    }, 400);
  });
})();

// ── Propagation du code de parrainage (?ref=) sur les liens CTA MargoPro ──
(function() {
  var ref = new URLSearchParams(window.location.search).get('ref');
  if (!ref) return;
  document.querySelectorAll('a[href^="https://margopro.eidma.co"]').forEach(function(a) {
    var url = new URL(a.href);
    url.searchParams.set('ref', ref);
    a.href = url.toString();
  });
})();
</script>
```

- [ ] **Step 3: Manual verification**

Open `index.html` directly in a browser. Confirm: the "Affiliation" nav link scrolls to the new section; filling the WhatsApp form and submitting opens a `wa.me` link with the name and number prefilled. Then open the file with `?ref=TESTCODE` appended to the URL and confirm (via dev tools → inspect element) that every `Commencer` / `Commencer gratuitement` / `Découvrir MargoPro` link's `href` now includes `?ref=TESTCODE`.

- [ ] **Step 4: Commit (in the `eidma-landing` repo)**

```bash
cd "C:\Users\HP\OneDrive\Documents\SAAS\Ed-main\eidma-landing"
git add index.html
git commit -m "feat: section affiliation et propagation du code de parrainage"
```

---

## Post-implementation checklist

- [ ] Juanita has run `frontend/supabase-migration-2026-07-10c-parrainage.sql` in Supabase.
- [ ] End-to-end manual test: open `eidma.co/?ref=CODE` (a real code from an existing affiliate), click "Commencer gratuitement", sign up with a new email, confirm a row appears in `parrainages` with the right `affiliate_id`.
- [ ] End-to-end manual test: in Paramètres, generate a code, copy it, open the public tracking page with that code, confirm it loads (even with 0 filleuls).
