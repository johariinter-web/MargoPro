# Clients fidèles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un commerçant de voir, pour chaque client (comptant ou crédit confondus), combien de fois il a acheté et combien il a dépensé au total, pour repérer ses clients fidèles.

**Architecture:** Le nom du client (déjà collecté aujourd'hui uniquement pour les ventes à crédit) devient possible sur **toute** vente, via un lien "+ Ajouter un client" optionnel et discret pour ne pas ralentir une vente comptant rapide. Une fonction pure regroupe ensuite l'historique complet des ventes par client (téléphone si connu, sinon nom normalisé) et calcule le nombre d'achats et le total dépensé. Un nouvel onglet "Clients" sur la page Ventes affiche cette liste, triée du plus dépensier au moins dépensier. Aucune nouvelle table Supabase : `clientNom`/`clientTel`/`modeReglement` existent déjà sur `ventes` et sont déjà synchronisés (migration du 2026-07-09).

**Tech Stack:** Next.js App Router, TypeScript, Dexie/IndexedDB, Vitest.

**Spec:** Pas de spec séparée — projet classé "bounded" en brainstorming (réutilise entièrement les patterns déjà en place : champ client optionnel du formulaire de vente à crédit, onglet Facture déjà ajouté à la page Ventes, gating Premium via `AccesPremiumRequis`).

## Global Constraints

- Réservé aux comptes Premium (`accesFonctionnalitesPremium`), même pattern que Carnet/Fournisseurs/Packs.
- Le champ client sur une vente comptant est optionnel et **caché par défaut** derrière un lien "+ Ajouter un client" — ne jamais l'afficher par défaut sur le formulaire de vente comptant (décision explicite de Juanita pour ne pas ralentir une vente rapide).
- Aucun "code client" séparé — le nom (et le téléphone quand il est présent) suffit à identifier un client.
- Pas de nouvelle colonne/migration Supabase : réutiliser `clientNom`, `clientTel`, `modeReglement` déjà présents sur `Vente` et déjà synchronisés.
- Regroupement des clients : par téléphone quand il est connu (identifiant plus fiable), sinon par nom normalisé (`trim().toLowerCase()`) pour absorber les variations de casse/espaces.

---

### Task 1: Logique pure — suivi des clients fidèles

**Files:**
- Modify: `frontend/backend/ventes.ts` (fonction `creerVente`, actuellement lignes 55-80)
- Modify: `frontend/backend/packs.ts` (fonction `creerVentePack`, actuellement lignes 28-50)
- Create: `frontend/backend/clients.ts`
- Test: `frontend/backend/__tests__/clients.test.ts`
- Test: `frontend/backend/__tests__/ventes.test.ts` (n'existe pas encore, à créer)

**Interfaces:**
- Consumes : `Vente` de `frontend/backend/types.ts` (déjà : `clientNom?: string`, `clientTel?: string`, `total: number`, `date: number`, `deleted?: boolean`)
- Produces : `ClientFidele` (`nom: string`, `tel?: string`, `nombreAchats: number`, `totalDepense: number`, `dernierAchat: number`) et `clientsFideles(ventes: Vente[]): ClientFidele[]`, consommés par Task 3. `creerVente`/`creerVentePack` gagnent un 7ᵉ (resp. 4ᵉ) paramètre optionnel `client?: { nom: string; tel?: string }`, consommé par Task 2.

- [ ] **Step 1: Écrire le test de `clientsFideles` (échoue d'abord)**

Créer `frontend/backend/__tests__/clients.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { clientsFideles } from '../clients';
import type { Vente } from '../types';

function venteTest(overrides: Partial<Vente>): Vente {
  return {
    id: 'v' + Math.random(),
    produitId: 'p1',
    produitNom: 'Savon',
    quantite: 1,
    prixVente: 1000,
    prixAchat: 500,
    total: 1000,
    benefice: 500,
    date: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('clientsFideles', () => {
  it('regroupe deux ventes du même client (même nom exact)', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', total: 1000, date: 1000 }),
      venteTest({ clientNom: 'Amira', total: 2000, date: 2000 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].nombreAchats).toBe(2);
    expect(resultat[0].totalDepense).toBe(3000);
  });

  it('regroupe par téléphone même si la casse du nom diffère', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: '90000000', total: 1000 }),
      venteTest({ clientNom: 'amira', clientTel: '90000000', total: 500 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].totalDepense).toBe(1500);
  });

  it('regroupe par nom normalisé (espaces/casse) quand il n\'y a pas de téléphone', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', total: 1000 }),
      venteTest({ clientNom: '  amira  ', total: 500 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].nombreAchats).toBe(2);
  });

  it('ignore les ventes sans nom de client', () => {
    const ventes = [venteTest({ clientNom: undefined })];
    expect(clientsFideles(ventes)).toHaveLength(0);
  });

  it('ignore les ventes supprimées', () => {
    const ventes = [venteTest({ clientNom: 'Amira', deleted: true })];
    expect(clientsFideles(ventes)).toHaveLength(0);
  });

  it('garde le téléphone dès qu\'une des ventes le fournit', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: undefined }),
      venteTest({ clientNom: 'Amira', clientTel: '90000000' }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat[0].tel).toBe('90000000');
  });

  it('garde la date la plus récente comme dernier achat', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', date: 2000 }),
      venteTest({ clientNom: 'Amira', date: 5000 }),
      venteTest({ clientNom: 'Amira', date: 1000 }),
    ];
    expect(clientsFideles(ventes)[0].dernierAchat).toBe(5000);
  });

  it('trie du plus dépensier au moins dépensier', () => {
    const ventes = [
      venteTest({ clientNom: 'Petit', total: 500 }),
      venteTest({ clientNom: 'Gros', total: 5000 }),
      venteTest({ clientNom: 'Moyen', total: 2000 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat.map(c => c.nom)).toEqual(['Gros', 'Moyen', 'Petit']);
  });

  it('retourne un tableau vide pour aucune vente', () => {
    expect(clientsFideles([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier l'échec**

Run: `cd frontend && npm run test -- clients`
Expected: FAIL — `Cannot find module '../clients'`

- [ ] **Step 3: Créer `frontend/backend/clients.ts`**

```typescript
import type { Vente } from './types';

export interface ClientFidele {
  nom: string;
  tel?: string;
  nombreAchats: number;
  totalDepense: number;
  dernierAchat: number;
}

/** Regroupe les ventes par client (téléphone si connu, sinon nom normalisé)
 *  pour repérer les clients fidèles. Ignore les ventes supprimées et celles
 *  sans nom de client. Trié du plus dépensier au moins dépensier. */
export function clientsFideles(ventes: Vente[]): ClientFidele[] {
  const parCle = new Map<string, ClientFidele>();

  for (const v of ventes) {
    if (v.deleted || !v.clientNom?.trim()) continue;
    const nom = v.clientNom.trim();
    const tel = v.clientTel?.trim() || undefined;
    const cle = tel || nom.toLowerCase();

    const existant = parCle.get(cle);
    if (existant) {
      existant.nombreAchats += 1;
      existant.totalDepense += v.total;
      existant.dernierAchat = Math.max(existant.dernierAchat, v.date);
      if (!existant.tel && tel) existant.tel = tel;
    } else {
      parCle.set(cle, { nom, tel, nombreAchats: 1, totalDepense: v.total, dernierAchat: v.date });
    }
  }

  return Array.from(parCle.values()).sort((a, b) => b.totalDepense - a.totalDepense);
}
```

- [ ] **Step 4: Lancer les tests, vérifier le succès**

Run: `cd frontend && npm run test -- clients`
Expected: PASS (9 tests)

- [ ] **Step 5: Écrire le test de `creerVente` avec un client sans crédit (échoue d'abord)**

Créer `frontend/backend/__tests__/ventes.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { creerVente } from '../ventes';

describe('creerVente', () => {
  it('reste en comptant sans client quand rien n\'est fourni (comportement existant)', () => {
    const vente = creerVente('p1', 'Savon', 2, 1000, 500);
    expect(vente.modeReglement).toBe('comptant');
    expect(vente.clientNom).toBeUndefined();
  });

  it('reste un crédit quand credit est fourni, même si client est aussi fourni', () => {
    const vente = creerVente('p1', 'Savon', 1, 1000, 500,
      { clientNom: 'Amira', montantRecu: 0 },
      { nom: 'Ignoré', tel: 'Ignoré' }
    );
    expect(vente.modeReglement).toBe('credit');
    expect(vente.clientNom).toBe('Amira');
  });

  it('enregistre un client sur une vente comptant quand client est fourni sans credit', () => {
    const vente = creerVente('p1', 'Savon', 1, 1000, 500, undefined, { nom: 'Amira', tel: '90000000' });
    expect(vente.modeReglement).toBe('comptant');
    expect(vente.clientNom).toBe('Amira');
    expect(vente.clientTel).toBe('90000000');
  });

  it('accepte un client sans téléphone', () => {
    const vente = creerVente('p1', 'Savon', 1, 1000, 500, undefined, { nom: 'Amira' });
    expect(vente.clientNom).toBe('Amira');
    expect(vente.clientTel).toBeUndefined();
  });
});
```

- [ ] **Step 6: Lancer les tests, vérifier l'échec**

Run: `cd frontend && npm run test -- ventes.test`
Expected: FAIL — le test "enregistre un client sur une vente comptant" échoue (`clientNom` undefined), `creerVente` n'accepte pas encore de 7ᵉ paramètre.

- [ ] **Step 7: Modifier `creerVente` dans `frontend/backend/ventes.ts`**

Remplacer la fonction actuelle (lignes 55-80) par :

```typescript
export function creerVente(
  produitId: string,
  produitNom: string,
  quantite: number,
  prixVente: number,
  prixAchat: number,
  credit?: { clientNom: string; clientTel?: string; montantRecu: number },
  client?: { nom: string; tel?: string }
): Omit<Vente, 'id'> {
  const total = prixVente * quantite;
  const benefice = (prixVente - prixAchat) * quantite;
  const now = Date.now();
  return {
    produitId,
    produitNom,
    quantite,
    prixVente,
    prixAchat,
    total,
    benefice,
    date: now,
    updatedAt: now,
    ...(credit
      ? { modeReglement: 'credit', clientNom: credit.clientNom, clientTel: credit.clientTel, montantRecu: credit.montantRecu }
      : client
      ? { modeReglement: 'comptant', clientNom: client.nom, clientTel: client.tel }
      : { modeReglement: 'comptant' }),
  };
}
```

(Le reste du fichier — `resteADoit`, `urgenceCredit`, `creditsEnCours`, etc. — ne change pas.)

- [ ] **Step 8: Lancer les tests, vérifier le succès**

Run: `cd frontend && npm run test -- ventes.test`
Expected: PASS (4 tests)

- [ ] **Step 9: Modifier `creerVentePack` dans `frontend/backend/packs.ts`**

Remplacer la fonction actuelle (lignes 28-50) par :

```typescript
export function creerVentePack(
  pack: Pack,
  produitsMap: Map<string, Produit>,
  credit?: { clientNom: string; clientTel?: string; montantRecu: number },
  client?: { nom: string; tel?: string }
): Omit<Vente, 'id'> {
  const sumPrixAchat = prixAchatPack(pack, produitsMap);
  const now = Date.now();
  return {
    produitId: pack.id,
    produitNom: pack.nom,
    quantite: 1,
    prixVente: pack.prixVente,
    prixAchat: sumPrixAchat,
    total: pack.prixVente,
    benefice: pack.prixVente - sumPrixAchat,
    date: now,
    updatedAt: now,
    type: 'pack',
    ...(credit
      ? { modeReglement: 'credit', clientNom: credit.clientNom, clientTel: credit.clientTel, montantRecu: credit.montantRecu }
      : client
      ? { modeReglement: 'comptant', clientNom: client.nom, clientTel: client.tel }
      : { modeReglement: 'comptant' }),
  };
}
```

- [ ] **Step 10: Build complet pour vérifier qu'aucun appel existant ne casse**

Run: `cd frontend && npm run build`
Expected: succès (les appels existants à `creerVente`/`creerVentePack` sans 7ᵉ/4ᵉ argument restent valides, paramètre optionnel).

- [ ] **Step 11: Commit**

```bash
git add frontend/backend/clients.ts frontend/backend/ventes.ts frontend/backend/packs.ts frontend/backend/__tests__/clients.test.ts frontend/backend/__tests__/ventes.test.ts
git commit -m "feat: logique de regroupement des clients fideles + client optionnel sur vente comptant"
```

---

### Task 2: Formulaire de vente — client optionnel sur une vente comptant

**Files:**
- Modify: `frontend/lib/hooks/useVentes.ts`
- Modify: `frontend/app/ventes/page.tsx`

**Interfaces:**
- Consumes : `creerVente`/`creerVentePack` avec leur nouveau paramètre `client?: { nom: string; tel?: string }` (Task 1).
- Produces : `enregistrerVente(..., credit?, client?)` et `enregistrerVentePack(pack, credit?, client?)` retournés par `useVentes()`, avec le même type `client?: { nom: string; tel?: string }` — consommés directement dans ce même task par `ventes/page.tsx`.

- [ ] **Step 1: Étendre `enregistrerVente` dans `frontend/lib/hooks/useVentes.ts`**

Remplacer (lignes 24-35) :

```typescript
  async function enregistrerVente(
    produitId: string,
    produitNom: string,
    quantite: number,
    prixVente: number,
    prixAchat: number,
    credit?: { clientNom: string; clientTel?: string; montantRecu: number }
  ) {
    const vente = creerVente(produitId, produitNom, quantite, prixVente, prixAchat, credit);
    await db.ventes.add({ ...vente, id: genId(), deleted: false });
    requestSync();
  }
```

par :

```typescript
  async function enregistrerVente(
    produitId: string,
    produitNom: string,
    quantite: number,
    prixVente: number,
    prixAchat: number,
    credit?: { clientNom: string; clientTel?: string; montantRecu: number },
    client?: { nom: string; tel?: string }
  ) {
    const vente = creerVente(produitId, produitNom, quantite, prixVente, prixAchat, credit, client);
    await db.ventes.add({ ...vente, id: genId(), deleted: false });
    requestSync();
  }
```

- [ ] **Step 2: Étendre `enregistrerVentePack` dans le même fichier**

Remplacer la signature (lignes 124-127) :

```typescript
  async function enregistrerVentePack(
    pack: Pack,
    credit?: { clientNom: string; clientTel?: string; montantRecu: number }
  ): Promise<string | null> {
```

par :

```typescript
  async function enregistrerVentePack(
    pack: Pack,
    credit?: { clientNom: string; clientTel?: string; montantRecu: number },
    client?: { nom: string; tel?: string }
  ): Promise<string | null> {
```

Et remplacer l'appel (ligne 142) :

```typescript
    const vente = creerVentePack(pack, produitsMap, credit);
```

par :

```typescript
    const vente = creerVentePack(pack, produitsMap, credit, client);
```

- [ ] **Step 3: Renommer l'état client dans `frontend/app/ventes/page.tsx` et ajouter le toggle**

Dans `frontend/app/ventes/page.tsx`, renommer `clientNomCredit` → `clientNom` et `clientTelCredit` → `clientTel` (ce ne sont plus des champs réservés au crédit). Ça touche exactement ces 5 endroits :

**a) Déclaration d'état (lignes 57-58)** — remplacer :

```typescript
  const [clientNomCredit, setClientNomCredit] = useState('');
  const [clientTelCredit, setClientTelCredit] = useState('');
```

par :

```typescript
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [showClientOptionnel, setShowClientOptionnel] = useState(false);
```

**b) Réinitialisation dans le chemin pack de `handleVente` (lignes 143-146)** — remplacer :

```typescript
      setIsCredit(false);
      setClientNomCredit('');
      setClientTelCredit('');
      setAcompteCredit('0');
```

par :

```typescript
      setIsCredit(false);
      setClientNom('');
      setClientTel('');
      setShowClientOptionnel(false);
      setAcompteCredit('0');
```

**c) Réinitialisation dans le chemin produit de `handleVente` (lignes 170-173)** — remplacer :

```typescript
    setIsCredit(false);
    setClientNomCredit('');
    setClientTelCredit('');
    setAcompteCredit('0');
```

par :

```typescript
    setIsCredit(false);
    setClientNom('');
    setClientTel('');
    setShowClientOptionnel(false);
    setAcompteCredit('0');
```

**d) Toggle crédit (ligne 667)** — remplacer :

```typescript
    onClick={() => { if (!accesFonctionnalitesPremium) return; setIsCredit(v => !v); setClientNomCredit(''); setClientTelCredit(''); setAcompteCredit('0'); }}
```

par :

```typescript
    onClick={() => { if (!accesFonctionnalitesPremium) return; setIsCredit(v => !v); setClientNom(''); setClientTel(''); setAcompteCredit('0'); setShowClientOptionnel(false); }}
```

**e) Le bouton Annuler (ligne 718)** — remplacer :

```typescript
              onClick={() => { setShowForm(false); setErreur(''); setPrixGros(''); setIsCredit(false); setClientNomCredit(''); setClientTelCredit(''); setAcompteCredit('0'); setModeProduit('produit'); setPackSelectionne(''); }}
```

par :

```typescript
              onClick={() => { setShowForm(false); setErreur(''); setPrixGros(''); setIsCredit(false); setClientNom(''); setClientTel(''); setAcompteCredit('0'); setShowClientOptionnel(false); setModeProduit('produit'); setPackSelectionne(''); }}
```

**f) Les 2 inputs du formulaire crédit (lignes 682-698, à l'intérieur du bloc `{isCredit && (...)}`)** : remplacer `value={clientNomCredit}`/`onChange={e => setClientNomCredit(e.target.value)}` par `value={clientNom}`/`onChange={e => setClientNom(e.target.value)}`, et pareil pour `clientTelCredit` → `clientTel`.

- [ ] **Step 4: Ajouter le lien "+ Ajouter un client" pour une vente comptant**

Juste après le bloc `{isCredit && ( ... )}` (qui se termine juste avant la ligne `<div style={{ display: 'flex', gap: 10 }}>` des boutons Annuler/Confirmer, ligne ~716), ajouter :

```typescript
          {!isCredit && (
            <div style={{ marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setShowClientOptionnel(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.accent, padding: '4px 0' }}
              >
                {showClientOptionnel ? 'Masquer' : '+ Ajouter un client'}
              </button>
              {showClientOptionnel && (
                <>
                  <div style={{ marginBottom: 12, marginTop: 6 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du client</label>
                    <input
                      type="text"
                      value={clientNom}
                      onChange={e => setClientNom(e.target.value)}
                      placeholder="Ex : Aminata Koné"
                      style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Téléphone (optionnel)</label>
                    <input
                      type="tel"
                      value={clientTel}
                      onChange={e => setClientTel(e.target.value)}
                      placeholder="Ex : 77 123 45 67"
                      style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
```

- [ ] **Step 5: Passer le client à `enregistrerVente` (chemin produit)**

Dans `handleVente`, remplacer (lignes ~159-164) :

```typescript
    if (isCredit && !clientNomCredit.trim()) { setErreur('Nom du client requis pour un crédit'); return; }
    const prixFinal = Number(prixGros) > 0 ? Number(prixGros) : produit.prixVente;
    const creditParams = isCredit
      ? { clientNom: clientNomCredit.trim(), clientTel: clientTelCredit.trim() || undefined, montantRecu: Math.max(0, Number(acompteCredit) || 0) }
      : undefined;
    await enregistrerVente(produit.id, produit.nom, qte, prixFinal, produit.prixAchat, creditParams);
```

par :

```typescript
    if (isCredit && !clientNom.trim()) { setErreur('Nom du client requis pour un crédit'); return; }
    const prixFinal = Number(prixGros) > 0 ? Number(prixGros) : produit.prixVente;
    const creditParams = isCredit
      ? { clientNom: clientNom.trim(), clientTel: clientTel.trim() || undefined, montantRecu: Math.max(0, Number(acompteCredit) || 0) }
      : undefined;
    const clientParams = !isCredit && clientNom.trim() !== ''
      ? { nom: clientNom.trim(), tel: clientTel.trim() || undefined }
      : undefined;
    await enregistrerVente(produit.id, produit.nom, qte, prixFinal, produit.prixAchat, creditParams, clientParams);
```

- [ ] **Step 6: Passer le client à `enregistrerVentePack` (chemin pack)**

Dans `handleVente`, remplacer (lignes ~133-137) :

```typescript
      if (isCredit && !clientNomCredit.trim()) { setErreur('Nom du client requis pour un crédit'); return; }
      const creditParams = isCredit
        ? { clientNom: clientNomCredit.trim(), clientTel: clientTelCredit.trim() || undefined, montantRecu: Math.max(0, Number(acompteCredit) || 0) }
        : undefined;
      const erreurPack = await enregistrerVentePack(pack, creditParams);
```

par :

```typescript
      if (isCredit && !clientNom.trim()) { setErreur('Nom du client requis pour un crédit'); return; }
      const creditParams = isCredit
        ? { clientNom: clientNom.trim(), clientTel: clientTel.trim() || undefined, montantRecu: Math.max(0, Number(acompteCredit) || 0) }
        : undefined;
      const clientParams = !isCredit && clientNom.trim() !== ''
        ? { nom: clientNom.trim(), tel: clientTel.trim() || undefined }
        : undefined;
      const erreurPack = await enregistrerVentePack(pack, creditParams, clientParams);
```

- [ ] **Step 7: Build et vérification manuelle**

Run: `cd frontend && npm run build`
Expected: succès.

Vérifier manuellement (`npm run dev`) : faire une vente comptant sans toucher au lien "+ Ajouter un client" → doit fonctionner exactement comme avant (aucun champ visible, aucun ralentissement). Puis faire une vente comptant en cliquant "+ Ajouter un client" et en remplissant un nom → la vente doit s'enregistrer avec ce nom.

- [ ] **Step 8: Commit**

```bash
git add frontend/lib/hooks/useVentes.ts frontend/app/ventes/page.tsx
git commit -m "feat: champ client optionnel sur une vente comptant (pas seulement a credit)"
```

---

### Task 3: Nouvel onglet "Clients"

**Files:**
- Modify: `frontend/app/ventes/page.tsx`

**Interfaces:**
- Consumes : `clientsFideles(ventes: Vente[]): ClientFidele[]` de `frontend/backend/clients.ts` (Task 1), et `ventes` déjà disponible dans le composant (retourné par `useVentes(periode)`, contient l'historique complet non filtré par période — voir `frontend/lib/hooks/useVentes.ts` ligne 12-14).

- [ ] **Step 1: Importer `clientsFideles`**

En haut de `frontend/app/ventes/page.tsx`, ajouter à côté des imports `@backend/*` existants (ligne 15) :

```typescript
import { clientsFideles } from '@backend/clients';
```

- [ ] **Step 2: Étendre le type de l'onglet**

Remplacer (ligne 48) :

```typescript
  const [onglet, setOnglet] = useState<'ventes' | 'carnet' | 'facture'>('ventes');
```

par :

```typescript
  const [onglet, setOnglet] = useState<'ventes' | 'carnet' | 'facture' | 'clients'>('ventes');
```

- [ ] **Step 3: Ajouter le bouton d'onglet**

Juste après le bouton Facture (lignes 490-495) :

```typescript
        <button
          onClick={() => setOnglet('facture')}
          style={{ flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: onglet === 'facture' ? T.accent : T.bgSubtle, color: onglet === 'facture' ? 'white' : T.textSub, position: 'relative' }}
        >
          Facture{facture.lignes.length > 0 ? ` (${facture.lignes.length})` : ''}
        </button>
      </div>
```

ajouter un 4ᵉ bouton avant la fermeture du `</div>` :

```typescript
        <button
          onClick={() => setOnglet('facture')}
          style={{ flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: onglet === 'facture' ? T.accent : T.bgSubtle, color: onglet === 'facture' ? 'white' : T.textSub, position: 'relative' }}
        >
          Facture{facture.lignes.length > 0 ? ` (${facture.lignes.length})` : ''}
        </button>
        <button
          onClick={() => setOnglet('clients')}
          style={{ flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: onglet === 'clients' ? T.accent : T.bgSubtle, color: onglet === 'clients' ? 'white' : T.textSub }}
        >
          Clients
        </button>
      </div>
```

- [ ] **Step 4: Ajouter le contenu de l'onglet**

Trouver la fin du bloc `{onglet === 'facture' && ( ... )}` (cherche la fermeture correspondante après le bloc facture, avant le prochain élément du composant) et ajouter juste après :

```typescript
      {onglet === 'clients' && (
        <div style={{ padding: '0 16px' }}>
          {!accesFonctionnalitesPremium ? (
            <AccesPremiumRequis titre="Clients fidèles" description="Vois qui achète le plus souvent chez toi, pour les récompenser." />
          ) : (() => {
            const liste = clientsFideles(ventes);
            if (liste.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🧑‍🤝‍🧑</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun client enregistré</div>
                  <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Ajoute un nom de client lors d&apos;une vente pour le voir ici.</div>
                </div>
              );
            }
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {liste.map(c => (
                  <div key={c.tel || c.nom} style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', border: `1px solid ${T.border}`, boxShadow: T.shadow, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 3 }}>{c.nom}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>
                        {c.nombreAchats} achat{c.nombreAchats > 1 ? 's' : ''} · dernier le {new Date(c.dernierAchat).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </div>
                      {c.tel && (
                        <a href={`tel:${c.tel}`} style={{ fontSize: 12, color: T.accent, fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 3 }}>
                          📞 {c.tel}
                        </a>
                      )}
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                      {fmtF(c.totalDepense)} {symbole}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
```

- [ ] **Step 5: Build et vérification manuelle**

Run: `cd frontend && npm run build`
Expected: succès.

Vérifier manuellement (`npm run dev`, compte Premium) : faire 2 ventes avec le même nom de client (une comptant via "+ Ajouter un client", une à crédit) → l'onglet Clients doit afficher 1 seule entrée avec 2 achats et le total des deux ventes additionné.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/ventes/page.tsx
git commit -m "feat: nouvel onglet Clients (nombre d'achats + total depense par client)"
```

---

### Task 4: Revue finale de branche complète

Utiliser `superpowers:requesting-code-review` (ou le sous-processus déjà prévu par `subagent-driven-development`) sur l'ensemble des commits de ce plan. Points d'attention particuliers pour le reviewer :

- Le renommage `clientNomCredit`/`clientTelCredit` → `clientNom`/`clientTel` dans `ventes/page.tsx` ne doit rien casser dans le formulaire crédit existant (toujours obligatoire, toujours affiché quand `isCredit` est vrai).
- Une vente comptant sans avoir touché "+ Ajouter un client" doit produire exactement le même résultat qu'avant ce plan (`clientNom`/`clientTel` absents).
- `clientsFideles` doit bien lire `ventes` (non filtré par période) et non une variable filtrée par la période sélectionnée dans l'onglet Ventes.
