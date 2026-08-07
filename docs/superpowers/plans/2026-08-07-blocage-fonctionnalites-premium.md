# Blocage des fonctionnalités Premium (Chantier A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réserver réellement au Premium (débloqué pendant l'essai gratuit) : Stock mort, Fournisseurs, Carnet + vente à crédit, Packs, Historique des ventes semaine/mois + suppressions, Alertes de stock bas. Marges (%Marge) reste gratuit pour tous.

**Architecture:** Un champ dérivé `accesFonctionnalitesPremium` ajouté à `usePlan()` (vrai pendant l'essai ET pour le Premium payant, faux seulement si l'essai est expiré). Un composant réutilisable `<AccesPremiumRequis>` affiche une carte "Passer au Premium" à la place du contenu bloqué. Chaque écran/action est adapté individuellement : blocage simple (pas de données à conserver), blocage conditionnel (liste consultable si des données existent déjà, bouton d'ajout désactivé), ou simple désactivation d'un bouton avec message.

**Tech Stack:** Next.js App Router, TypeScript, React, Vitest.

## Global Constraints

- `accesFonctionnalitesPremium = status !== 'expired'` — vrai pendant `'trial'`/`'warning'`/`'premium'`, faux seulement pour `'expired'`.
- Le composant `<AccesPremiumRequis>` est le seul mécanisme de blocage visuel — pas de nouvelle modale, pas de nouvel écran plein (celui-ci reste dédié à la limite de 5 produits).
- `frontend/app/marges/page.tsx` ne doit subir AUCUNE modification dans ce chantier — Marges reste gratuit pour tous.
- Aucune migration Supabase, aucune nouvelle variable d'environnement.
- Quand une liste (Packs, Fournisseurs, Carnet) contient déjà des données alors que le compte n'a plus accès, la liste reste consultable — seul le bouton d'ajout est désactivé.

---

### Task 1 : Champ `accesFonctionnalitesPremium` dans `usePlan`

**Files:**
- Modify: `frontend/lib/hooks/usePlan.ts`
- Test: `frontend/lib/__tests__/usePlan.test.ts`

**Interfaces:**
- Produces : `PlanInfo.accesFonctionnalitesPremium: boolean` — consommé par toutes les tâches suivantes.

- [ ] **Step 1 : Écrire les tests qui échouent**

Ajouter dans `frontend/lib/__tests__/usePlan.test.ts`, à la fin du bloc `describe('computePlanStatus', ...)` (avant la dernière accolade fermante, après le test `'reste premium si premiumExpiresAt est absent...'`) :

```ts
  it('accesFonctionnalitesPremium = true pendant le premium actif', () => {
    const r = computePlanStatus(undefined, true, 2, Date.now());
    expect(r.accesFonctionnalitesPremium).toBe(true);
  });

  it('accesFonctionnalitesPremium = true pendant l\'essai (trialStart non defini)', () => {
    const r = computePlanStatus(undefined, false, 0, Date.now());
    expect(r.accesFonctionnalitesPremium).toBe(true);
  });

  it('accesFonctionnalitesPremium = true en warning (essai bientot termine)', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 23 * DAY, false, 2, now);
    expect(r.status).toBe('warning');
    expect(r.accesFonctionnalitesPremium).toBe(true);
  });

  it('accesFonctionnalitesPremium = false une fois l\'essai expire', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 2, now);
    expect(r.status).toBe('expired');
    expect(r.accesFonctionnalitesPremium).toBe(false);
  });
```

- [ ] **Step 2 : Lancer les tests et vérifier qu'ils échouent**

Run: `cd frontend && npx vitest run lib/__tests__/usePlan.test.ts`
Expected: FAIL sur les 4 nouveaux tests (`accesFonctionnalitesPremium` est `undefined`, pas `true`/`false`) — les 12 tests existants continuent de passer.

- [ ] **Step 3 : Ajouter le champ à `PlanInfo` et le calculer**

Dans `frontend/lib/hooks/usePlan.ts`, remplacer l'interface (lignes 10-17) :

```ts
export interface PlanInfo {
  status: PlanStatus;
  daysRemaining: number;   // 0 si expiré ou premium
  isPremium: boolean;
  activeProductCount: number;
  canAddProduct: boolean;
  accesFonctionnalitesPremium: boolean;  // faux uniquement si l'essai est expire et pas Premium
  isLoading?: boolean;     // true pendant que Dexie charge (< 100ms)
}
```

Remplacer `computePlanStatus` (lignes 22-50) :

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
    return { status: 'premium', daysRemaining: 0, isPremium: true, activeProductCount, canAddProduct: true, accesFonctionnalitesPremium: true };
  }

  if (trialStart === undefined) {
    return { status: 'trial', daysRemaining: TRIAL_DAYS, isPremium: false, activeProductCount, canAddProduct: true, accesFonctionnalitesPremium: true };
  }

  const elapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - elapsed);

  let status: PlanStatus;
  if (remaining === 0) status = 'expired';
  else if (remaining <= WARNING_DAYS) status = 'warning';
  else status = 'trial';

  const canAddProduct = status !== 'expired' || activeProductCount < 5;
  const accesFonctionnalitesPremium = status !== 'expired';

  return { status, daysRemaining: remaining, isPremium: false, activeProductCount, canAddProduct, accesFonctionnalitesPremium };
}
```

- [ ] **Step 4 : Mettre à jour la valeur de repli dans `usePlan()`**

Dans `frontend/lib/hooks/usePlan.ts`, remplacer le retour de repli (lignes 77-84) :

```ts
  return result ?? {
    status: 'trial',
    daysRemaining: TRIAL_DAYS,
    isPremium: false,
    activeProductCount: 0,
    canAddProduct: true,
    accesFonctionnalitesPremium: true,
    isLoading: true,
  };
```

- [ ] **Step 5 : Lancer les tests et vérifier qu'ils passent**

Run: `cd frontend && npx vitest run lib/__tests__/usePlan.test.ts`
Expected: PASS — 16/16 tests.

- [ ] **Step 6 : Lancer la suite complète et vérifier les types**

Run: `cd frontend && npx vitest run && npx tsc --noEmit`
Expected: tous les fichiers passent, aucune erreur de type (en particulier, `frontend/app/stock/page.tsx` utilise déjà `usePlan()` — vérifier qu'ajouter un champ à l'interface ne casse rien là-bas).

- [ ] **Step 7 : Commit**

```bash
git add frontend/lib/hooks/usePlan.ts frontend/lib/__tests__/usePlan.test.ts
git commit -m "feat: champ accesFonctionnalitesPremium dans usePlan"
```

---

### Task 2 : Composant réutilisable `AccesPremiumRequis`

**Files:**
- Create: `frontend/components/AccesPremiumRequis.tsx`

**Interfaces:**
- Consumes : `ModalUpgrade` de `frontend/components/ModalUpgrade.tsx` (déjà existant, props `{ onClose: () => void }`).
- Produces : `<AccesPremiumRequis titre={string} description={string} />` — consommé par les tâches 3, 4, 5, 6.

- [ ] **Step 1 : Créer le composant**

Créer `frontend/components/AccesPremiumRequis.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { ModalUpgrade } from './ModalUpgrade';

interface Props {
  titre: string;
  description: string;
}

export function AccesPremiumRequis({ titre, description }: Props) {
  const T = useColors();
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{
      background: T.surface, borderRadius: 16, padding: '28px 20px',
      textAlign: 'center', boxShadow: T.shadow, fontFamily: 'Manrope, sans-serif',
    }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>
        {titre} — fonctionnalité Premium
      </div>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        {description}
      </div>
      <button
        onClick={() => setShowModal(true)}
        style={{
          height: 48, borderRadius: 14, padding: '0 24px',
          background: T.accent, color: 'white', border: 'none',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        Passer au Premium
      </button>
      {showModal && <ModalUpgrade onClose={() => setShowModal(false)} />}
    </div>
  );
}
```

- [ ] **Step 2 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/AccesPremiumRequis.tsx
git commit -m "feat: composant reutilisable AccesPremiumRequis"
```

---

### Task 3 : Blocage Stock mort + Packs dans `stock/page.tsx`

**Files:**
- Modify: `frontend/app/stock/page.tsx`

**Interfaces:**
- Consumes : `AccesPremiumRequis` (Task 2), `plan.accesFonctionnalitesPremium` — `plan` existe déjà dans ce fichier (ligne 139, `const plan = usePlan();`), pas de nouvel import de `usePlan` nécessaire.

- [ ] **Step 1 : Importer le composant**

Dans `frontend/app/stock/page.tsx`, ajouter avec les autres imports de composants (après la ligne 16, `import { Fournisseurs } from '@/components/Fournisseurs';`) :

```ts
import { AccesPremiumRequis } from '@/components/AccesPremiumRequis';
```

- [ ] **Step 2 : Bloquer Stock mort**

Remplacer la ligne d'ouverture de la vue Stock mort (ligne 1304 actuelle) :

```tsx
      {vueStock === 'mort' && (() => {
```

Par :

```tsx
      {vueStock === 'mort' && !plan.accesFonctionnalitesPremium && (
        <div style={{ padding: '0 16px' }}>
          <AccesPremiumRequis titre="Stock mort" description="Repère les produits qui dorment et l'argent immobilisé dans ton stock." />
        </div>
      )}

      {vueStock === 'mort' && plan.accesFonctionnalitesPremium && (() => {
```

Le reste du bloc (calcul `morts`, affichage de la liste, jusqu'à `})()}` à la ligne 1393 actuelle) reste **entièrement inchangé** — seule la ligne d'ouverture change, rien à l'intérieur du bloc ne bouge.

- [ ] **Step 3 : Bloquer Packs (avec consultation possible si des packs existent déjà)**

Remplacer la ligne d'ouverture de la vue Packs (ligne 1172 actuelle) :

```tsx
      {vueStock === 'packs' && (
```

Par deux blocs :

```tsx
      {vueStock === 'packs' && !plan.accesFonctionnalitesPremium && packs.length === 0 && (
        <div style={{ padding: '0 16px' }}>
          <AccesPremiumRequis titre="Packs" description="Regroupe plusieurs produits en une seule offre à vendre ensemble." />
        </div>
      )}

      {vueStock === 'packs' && !(!plan.accesFonctionnalitesPremium && packs.length === 0) && (
```

Puis, dans ce même bloc (qui continue jusqu'à la ligne `)}` originale à la ligne 1301 — cette fermeture ne change pas), remplacer uniquement le bouton "Créer un pack" (lignes 1177-1182 actuelles) :

```tsx
            <button
              onClick={ouvrirCreerPack}
              style={{ width: '100%', height: 48, borderRadius: 14, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              + Créer un pack
            </button>
```

Par :

```tsx
            <button
              onClick={plan.accesFonctionnalitesPremium ? ouvrirCreerPack : undefined}
              disabled={!plan.accesFonctionnalitesPremium}
              style={{ width: '100%', height: 48, borderRadius: 14, background: T.accent, border: 'none', cursor: plan.accesFonctionnalitesPremium ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: plan.accesFonctionnalitesPremium ? 1 : 0.5 }}
            >
              + Créer un pack
            </button>
```

Tout le reste du bloc Packs (formulaire de création, liste des packs) reste **entièrement inchangé**.

- [ ] **Step 4 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 5 : Vérification manuelle**

Run: `cd frontend && npm run dev`. Avec un compte de test dont l'essai est expiré et qui n'est pas Premium (ou en modifiant temporairement `computePlanStatus` en local pour tester — ne pas commit ce changement de test) : vérifier que l'onglet Stock mort affiche la carte "Passer au Premium", et que l'onglet Packs affiche la même carte si aucun pack n'existe, ou la liste avec le bouton "Créer un pack" grisé si des packs existent déjà. Avec un compte en essai ou Premium : tout fonctionne normalement, sans changement visible.

- [ ] **Step 6 : Commit**

```bash
git add frontend/app/stock/page.tsx
git commit -m "feat: bloquer Stock mort et Packs pour les comptes sans acces Premium"
```

---

### Task 4 : Blocage Fournisseurs

**Files:**
- Modify: `frontend/components/Fournisseurs.tsx`

**Interfaces:**
- Consumes : `AccesPremiumRequis` (Task 2), `usePlan()` (Task 1).

- [ ] **Step 1 : Remplacer le fichier**

Remplacer le contenu complet de `frontend/components/Fournisseurs.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useFournisseurs } from '@/lib/hooks/useFournisseurs';
import { usePlan } from '@/lib/hooks/usePlan';
import { FournisseurFiche } from './FournisseurFiche';
import { AccesPremiumRequis } from './AccesPremiumRequis';

const CHAMPS_VIDES = { nom: '', contact: '', delaiHabituel: '', montantMinimum: '', modePaiement: '' };

export function Fournisseurs() {
  const T = useColors();
  const { fournisseurs, ajouterFournisseur, fournisseurEnRetard } = useFournisseurs();
  const { accesFonctionnalitesPremium } = usePlan();
  const [showForm, setShowForm] = useState(false);
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const [erreur, setErreur] = useState('');
  const [fournisseurOuvertId, setFournisseurOuvertId] = useState<string | null>(null);
  const fournisseurOuvert = fournisseurs.find(f => f.id === fournisseurOuvertId) ?? null;

  async function handleAjouter() {
    setErreur('');
    const err = await ajouterFournisseur({
      nom: champs.nom.trim(),
      contact: champs.contact.trim() || undefined,
      delaiHabituel: Number(champs.delaiHabituel) > 0 ? Number(champs.delaiHabituel) : undefined,
      montantMinimum: Number(champs.montantMinimum) > 0 ? Number(champs.montantMinimum) : undefined,
      modePaiement: champs.modePaiement.trim() || undefined,
    });
    if (err) { setErreur(err); return; }
    setChamps(CHAMPS_VIDES);
    setShowForm(false);
  }

  const champsFormulaire: Array<{ key: keyof typeof CHAMPS_VIDES; label: string; placeholder: string; numerique?: boolean }> = [
    { key: 'nom', label: 'Nom', placeholder: 'Ex : Grossiste Koné' },
    { key: 'contact', label: 'Contact (optionnel)', placeholder: 'Ex : 77 123 45 67' },
    { key: 'delaiHabituel', label: 'Délai de livraison habituel, en jours (optionnel)', placeholder: 'Ex : 7', numerique: true },
    { key: 'montantMinimum', label: 'Montant minimum de commande (optionnel)', placeholder: '0', numerique: true },
    { key: 'modePaiement', label: 'Mode de paiement (optionnel)', placeholder: 'Ex : Mobile Money' },
  ];

  if (!accesFonctionnalitesPremium && fournisseurs.length === 0) {
    return (
      <div style={{ padding: '0 16px' }}>
        <AccesPremiumRequis titre="Fournisseurs" description="Suis tes commandes et sois averti des livraisons en retard." />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => accesFonctionnalitesPremium && setShowForm(true)}
        disabled={!accesFonctionnalitesPremium}
        style={{
          width: '100%', height: 48, borderRadius: 12, background: T.accent, color: 'white',
          fontSize: 14, fontWeight: 700, border: 'none', cursor: accesFonctionnalitesPremium ? 'pointer' : 'not-allowed', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          opacity: accesFonctionnalitesPremium ? 1 : 0.5,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        Ajouter un fournisseur
      </button>

      {showForm && (
        <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Nouveau fournisseur</div>
          {erreur && (
            <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
              {erreur}
            </div>
          )}
          {champsFormulaire.map(({ key, label, placeholder, numerique }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
              <input
                type={numerique ? 'text' : key === 'contact' ? 'tel' : 'text'}
                inputMode={numerique ? 'decimal' : undefined}
                onWheel={e => e.currentTarget.blur()}
                value={champs[key]}
                onChange={e => setChamps(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={() => { setShowForm(false); setErreur(''); setChamps(CHAMPS_VIDES); }}
              style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
            >
              Annuler
            </button>
            <button
              onClick={handleAjouter}
              style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {fournisseurs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun fournisseur</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Ajoute ton premier fournisseur pour suivre tes commandes.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {fournisseurs.map(f => (
            <div
              key={f.id}
              onClick={() => setFournisseurOuvertId(f.id)}
              style={{
                background: T.surface, borderRadius: 14, padding: '14px 16px', boxShadow: T.shadow,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{f.nom}</span>
              {fournisseurEnRetard(f.id) && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 Livraison en retard</span>
              )}
            </div>
          ))}
        </div>
      )}

      {fournisseurOuvert && (
        <FournisseurFiche fournisseur={fournisseurOuvert} onFermer={() => setFournisseurOuvertId(null)} />
      )}
    </div>
  );
}
```

Ce fichier est identique à l'original, à l'exception de : l'import de `usePlan`/`AccesPremiumRequis`, la ligne `const { accesFonctionnalitesPremium } = usePlan();`, le bloc `if (!accesFonctionnalitesPremium && fournisseurs.length === 0) { return (...) }` ajouté juste avant le `return` principal, et le bouton "Ajouter un fournisseur" qui gagne `disabled`/`opacity`/`cursor` conditionnels.

- [ ] **Step 2 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/components/Fournisseurs.tsx
git commit -m "feat: bloquer Fournisseurs pour les comptes sans acces Premium"
```

---

### Task 5 : Blocage de la page Alertes

**Files:**
- Modify: `frontend/app/alertes/page.tsx`

**Interfaces:**
- Consumes : `AccesPremiumRequis` (Task 2), `usePlan()` (Task 1).

- [ ] **Step 1 : Remplacer le fichier**

Remplacer le contenu complet de `frontend/app/alertes/page.tsx` :

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';
import { usePlan } from '@/lib/hooks/usePlan';
import { AccesPremiumRequis } from '@/components/AccesPremiumRequis';

function formatMontant(n: number, symbole: string) {
  return `${n.toLocaleString('fr-FR')} ${symbole}`;
}

export default function AlertesPage() {
  const router = useRouter();
  const T = useColors();
  const { config } = useConfig();
  const { alertes, produits } = useStock();
  const { accesFonctionnalitesPremium } = usePlan();
  const symbole = config?.symboleDevise ?? 'FCFA';

  return (
    <div className="pb-24 px-4 pt-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-stone-500 dark:text-stone-400 text-2xl leading-none"
          aria-label="Retour"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-50">Alertes stock</h1>
      </div>

      {!accesFonctionnalitesPremium ? (
        <AccesPremiumRequis titre="Alertes de stock bas" description="Sois averti automatiquement quand un produit descend sous son seuil." />
      ) : alertes.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div style={{ width: 72, height: 72, borderRadius: 20, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-xl font-semibold text-stone-700 dark:text-stone-300">Aucune alerte</p>
          <p className="text-stone-500 dark:text-stone-400">Tous vos stocks sont suffisants.</p>
          <button
            onClick={() => router.push('/stock')}
            style={{ background: T.accent, color: 'white', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', minHeight: 48 }}
          >
            Voir le stock
          </button>
        </div>
      ) : (
        <>
          <div className="bg-orange-alert/10 border border-orange-alert/30 rounded-2xl p-4">
            <p className="text-orange-alert font-bold text-lg flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {alertes.length} produit{alertes.length > 1 ? 's' : ''} en stock bas
            </p>
            <p className="text-stone-600 dark:text-stone-400 text-sm mt-1">
              Réapprovisionnez ces produits pour éviter les ruptures.
            </p>
          </div>

          <div className="space-y-3">
            {alertes.map((produit) => {
              const manquant = produit.seuilAlerte - produit.quantite;
              return (
                <div
                  key={produit.id}
                  className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border-2 border-orange-alert"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-stone-800 dark:text-stone-50">{produit.nom}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-bold text-orange-alert">
                          {produit.quantite} unités
                        </span>
                        <span className="text-orange-alert text-sm font-bold inline-flex items-center gap-1">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
                            <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Stock bas
                        </span>
                      </div>
                      <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
                        Seuil d&apos;alerte : {produit.seuilAlerte} unités
                        {manquant > 0 && ` · Manquant : ${manquant} unités`}
                      </p>
                      <p className="text-stone-500 dark:text-stone-400 text-sm">
                        Prix achat : {formatMontant(produit.prixAchat, symbole)}
                      </p>
                    </div>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="ml-3 shrink-0 text-orange-alert">
                      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => router.push('/stock')}
            style={{ width: '100%', background: T.accent, color: 'white', borderRadius: 12, padding: '16px', fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer', minHeight: 56 }}
          >
            Gérer le stock →
          </button>
        </>
      )}
    </div>
  );
}
```

Identique à l'original, à l'exception de : l'import de `usePlan`/`AccesPremiumRequis`, la ligne `const { accesFonctionnalitesPremium } = usePlan();`, et le `{alertes.length === 0 ? (...) : (...)}` transformé en `{!accesFonctionnalitesPremium ? (...) : alertes.length === 0 ? (...) : (...)}`.

- [ ] **Step 2 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 3 : Commit**

```bash
git add frontend/app/alertes/page.tsx
git commit -m "feat: bloquer la page Alertes pour les comptes sans acces Premium"
```

---

### Task 6 : Blocage Carnet + désactivation de la vente à crédit

**Files:**
- Modify: `frontend/app/ventes/page.tsx`

**Interfaces:**
- Consumes : `AccesPremiumRequis` (Task 2), `usePlan()` (Task 1).
- Produces : `plan.accesFonctionnalitesPremium` disponible dans ce fichier — consommé aussi par la Task 7 (même fichier, fait après celle-ci).

- [ ] **Step 1 : Importer et appeler `usePlan`**

Dans `frontend/app/ventes/page.tsx`, ajouter l'import (après la ligne 9, `import { useColors } from '@/lib/hooks/useColors';`) :

```ts
import { usePlan } from '@/lib/hooks/usePlan';
import { AccesPremiumRequis } from '@/components/AccesPremiumRequis';
```

Ajouter l'appel du hook juste après la ligne `const { config } = useConfig();` (ligne 31 actuelle) :

```ts
  const { accesFonctionnalitesPremium } = usePlan();
```

- [ ] **Step 2 : Bloquer l'onglet Carnet si vide et sans accès**

Remplacer la condition d'affichage de l'état vide (ligne 778 actuelle) :

```tsx
          {credits.length === 0 && soldes.length === 0 ? (
```

Par :

```tsx
          {!accesFonctionnalitesPremium && credits.length === 0 && soldes.length === 0 ? (
            <AccesPremiumRequis titre="Carnet" description="Suis qui te doit de l'argent, sans rien oublier." />
          ) : credits.length === 0 && soldes.length === 0 ? (
```

Le reste (l'état vide normal, puis le `) : ( <> ... </> )` avec la vraie liste) reste **entièrement inchangé** — si des crédits ou soldes existent déjà, ils restent consultables même sans accès Premium (décision volontaire : on ne bloque pas la consultation ni l'enregistrement d'un paiement sur une dette déjà existante, seulement la création de nouvelles ventes à crédit — voir Step 3).

- [ ] **Step 3 : Désactiver le bouton "Vente à crédit" dans le formulaire**

Remplacer le toggle crédit (lignes 600-609 actuelles) :

```tsx
          {/* TOGGLE CRÉDIT */}
          <div
            onClick={() => { setIsCredit(v => !v); setClientNomCredit(''); setClientTelCredit(''); setAcompteCredit('0'); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, cursor: 'pointer', padding: '10px 12px', background: isCredit ? '#FFF7ED' : T.bgSubtle, borderRadius: 10, border: isCredit ? '1.5px solid #F97316' : `1.5px solid ${T.border}` }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: isCredit ? '#C2410C' : T.textSub }}>Vente à crédit</span>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: isCredit ? '#F97316' : T.border, position: 'relative', transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 2, left: isCredit ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
            </div>
          </div>
```

Par :

```tsx
          {/* TOGGLE CRÉDIT */}
          <div
            onClick={() => { if (!accesFonctionnalitesPremium) return; setIsCredit(v => !v); setClientNomCredit(''); setClientTelCredit(''); setAcompteCredit('0'); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, cursor: accesFonctionnalitesPremium ? 'pointer' : 'not-allowed', padding: '10px 12px', background: isCredit ? '#FFF7ED' : T.bgSubtle, borderRadius: 10, border: isCredit ? '1.5px solid #F97316' : `1.5px solid ${T.border}`, opacity: accesFonctionnalitesPremium ? 1 : 0.5 }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: isCredit ? '#C2410C' : T.textSub }}>Vente à crédit</span>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: isCredit ? '#F97316' : T.border, position: 'relative', transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 2, left: isCredit ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
            </div>
          </div>
          {!accesFonctionnalitesPremium && (
            <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Passe au Premium pour vendre à crédit.</div>
          )}
```

Comme `isCredit` ne peut plus jamais devenir `true` quand `!accesFonctionnalitesPremium` (le clic est ignoré), le bloc `{isCredit && (...)}` juste après (ligne 610 actuelle, formulaire nom client/téléphone/acompte) ne s'affiche jamais dans ce cas — aucune autre modification nécessaire à cet endroit.

- [ ] **Step 4 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 5 : Commit**

```bash
git add frontend/app/ventes/page.tsx
git commit -m "feat: bloquer le Carnet et desactiver la vente a credit pour le gratuit"
```

---

### Task 7 : Historique semaine/mois + suppressions de ventes désactivés

**Files:**
- Modify: `frontend/app/ventes/page.tsx`

**Interfaces:**
- Consumes : `accesFonctionnalitesPremium` (variable locale déjà ajoutée à la Task 6, dans le même fichier — ne pas la redéclarer).

- [ ] **Step 1 : Désactiver Semaine/Mois/Tout dans le sélecteur de période**

Remplacer le sélecteur de période (lignes 439-454 actuelles) :

```tsx
      {/* FILTER PILLS - visible uniquement sur l'onglet Ventes */}
      {onglet === 'ventes' && <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {PERIODES.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriode(p.value)}
            style={{
              height: 30, borderRadius: 20, padding: '0 12px', fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', flexShrink: 0,
              background: periode === p.value ? T.accent : T.bgSubtle,
              color: periode === p.value ? 'white' : T.textSub,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>}
```

Par :

```tsx
      {/* FILTER PILLS - visible uniquement sur l'onglet Ventes */}
      {onglet === 'ventes' && <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {PERIODES.map(p => {
          const bloque = p.value !== 'jour' && !accesFonctionnalitesPremium;
          return (
            <button
              key={p.value}
              onClick={() => { if (bloque) return; setPeriode(p.value); }}
              disabled={bloque}
              style={{
                height: 30, borderRadius: 20, padding: '0 12px', fontSize: 12, fontWeight: 600,
                border: 'none', cursor: bloque ? 'not-allowed' : 'pointer', flexShrink: 0,
                background: periode === p.value ? T.accent : T.bgSubtle,
                color: periode === p.value ? 'white' : T.textSub,
                opacity: bloque ? 0.45 : 1,
              }}
            >
              {p.label}
            </button>
          );
        })}
      </div>}
```

- [ ] **Step 2 : Désactiver "Supprimer cette vente" (bottom sheet)**

Remplacer le bouton (lignes 223-232 actuelles) :

```tsx
            <button
              onClick={confirmerSuppressionVente}
              style={{ width: '100%', height: 48, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 11v6M14 11v6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              Supprimer cette vente
            </button>
```

Par :

```tsx
            <button
              onClick={accesFonctionnalitesPremium ? confirmerSuppressionVente : undefined}
              disabled={!accesFonctionnalitesPremium}
              style={{ width: '100%', height: 48, borderRadius: 12, background: T.redBg, border: 'none', cursor: accesFonctionnalitesPremium ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: accesFonctionnalitesPremium ? 1 : 0.5 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 11v6M14 11v6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              Supprimer cette vente
            </button>
            {!accesFonctionnalitesPremium && (
              <div style={{ fontSize: 11, color: T.textMuted, textAlign: 'center', marginTop: 8 }}>Passe au Premium pour supprimer une vente.</div>
            )}
```

- [ ] **Step 3 : Désactiver la suppression définitive (historique des suppressions)**

Remplacer le bouton déclencheur (lignes 314-319 actuelles) :

```tsx
                <button
                  onClick={() => setConfirmerSuppressionDefinitive(true)}
                  style={{ width: '100%', height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: T.red }}
                >
                  Supprimer définitivement
                </button>
```

Par :

```tsx
                <button
                  onClick={accesFonctionnalitesPremium ? () => setConfirmerSuppressionDefinitive(true) : undefined}
                  disabled={!accesFonctionnalitesPremium}
                  style={{ width: '100%', height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: accesFonctionnalitesPremium ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, color: T.red, opacity: accesFonctionnalitesPremium ? 1 : 0.5 }}
                >
                  Supprimer définitivement
                </button>
```

(Le bouton "Confirmer la suppression" qui suit, lignes 306-311, n'a pas besoin d'être modifié séparément : comme le déclencheur ci-dessus est désormais désactivé, `confirmerSuppressionDefinitive` ne peut jamais devenir `true` sans accès, donc ce bouton n'est jamais atteignable dans ce cas.)

- [ ] **Step 4 : Désactiver le bouton "Supprimer" dans la liste des soldés (onglet Carnet)**

Chercher dans `frontend/app/ventes/page.tsx` (autour de la ligne 885 actuelle, à l'intérieur de la vue Carnet, section soldés) :

```tsx
                            onClick={() => supprimerVente(v.id)}
                            style={{ height: 36, padding: '0 12px', borderRadius: 10, background: T.redBg, color: T.red, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                          >
                            Supprimer
```

Remplacer par :

```tsx
                            onClick={accesFonctionnalitesPremium ? () => supprimerVente(v.id) : undefined}
                            disabled={!accesFonctionnalitesPremium}
                            style={{ height: 36, padding: '0 12px', borderRadius: 10, background: T.redBg, color: T.red, border: 'none', cursor: accesFonctionnalitesPremium ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700, opacity: accesFonctionnalitesPremium ? 1 : 0.5 }}
                          >
                            Supprimer
```

Si le texte exact autour de cette ligne a légèrement changé depuis l'écriture de ce plan (numéros de ligne approximatifs), rechercher le bouton "Supprimer" avec `onClick={() => supprimerVente(v.id)}` dans ce fichier — il ne doit y en avoir qu'un seul à cet endroit (dans la liste des ventes soldées du Carnet, distinct du bouton de la Step 2 qui est dans une bottom sheet séparée).

- [ ] **Step 5 : Vérifier les types et le build**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: aucune erreur.

- [ ] **Step 6 : Vérification manuelle**

Run: `cd frontend && npm run dev`. Avec un compte sans accès (essai expiré, pas Premium) : vérifier que dans Ventes, seul "Aujourd'hui" est cliquable (Semaine/Mois/Tout grisés), que le bouton "Supprimer cette vente" et "Supprimer définitivement" sont grisés, et que le bouton crédit est grisé avec le message d'incitation. Avec un compte en essai ou Premium : tout fonctionne normalement.

- [ ] **Step 7 : Commit**

```bash
git add frontend/app/ventes/page.tsx
git commit -m "feat: desactiver historique semaine/mois et suppression de ventes pour le gratuit"
```

---

## Étapes manuelles restantes (hors code, après ce plan)

Aucune — pas de migration, pas de configuration externe. Une fois fusionné, le comportement est immédiat pour tous les comptes dont l'essai est déjà expiré.
