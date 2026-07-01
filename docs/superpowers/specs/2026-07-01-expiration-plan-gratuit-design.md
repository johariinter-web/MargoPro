# Expiration du plan gratuit — Design Spec

**Date :** 2026-07-01
**Statut :** Approuvé

## Contexte

MargoPro offre 30 jours d'essai gratuit avec toutes les fonctionnalités. Après expiration, le plan gratuit est limité à 5 produits actifs. Le plan Premium (illimité) sera payant via FedaPay — non encore implémenté. Ce document couvre uniquement la logique d'expiration et l'enforcement de la limite.

## Ce qu'on ne construit pas

- Intégration FedaPay (session séparée)
- Notifications push à l'expiration
- Gestion multi-utilisateurs du plan
- Rétrogradation automatique (l'admin active/désactive `is_premium` manuellement)

---

## Données

### Nouveaux champs sur `Config`

```typescript
// backend/types.ts
export interface Config {
  // ... champs existants ...
  trialStart?: number;   // timestamp ms — date du premier produit ajouté, jamais modifié ensuite
  isPremium?: boolean;   // false par défaut, activé manuellement depuis Supabase
}
```

### Nouveau champ sur `Produit`

```typescript
export interface Produit {
  // ... champs existants ...
  archived?: boolean;    // false par défaut — produit masqué mais non supprimé
}
```

### Supabase — table `config`

Deux nouvelles colonnes :
```sql
ALTER TABLE config ADD COLUMN IF NOT EXISTS trial_start BIGINT;
ALTER TABLE config ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
```

Sync bidirectionnel via `sync.ts` existant (mapping snake_case ↔ camelCase).

### Dexie — table `config`

Pas de changement de schéma (Dexie stocke les objets Config entiers, les nouveaux champs sont inclus automatiquement).

### Dexie — table `produits`

Ajout d'un index sur `archived` pour filtrer efficacement :
```
produits: 'id, nom, quantite, updatedAt, deleted, archived'
```
Migration Dexie version 3 : initialiser `archived = false` sur tous les produits existants.

---

## Logique — hook `usePlan()`

Fichier : `frontend/lib/hooks/usePlan.ts`

```typescript
export type PlanStatus = 'premium' | 'trial' | 'warning' | 'expired';

export interface PlanInfo {
  status: PlanStatus;
  daysRemaining: number;   // 0 si expiré ou premium
  isPremium: boolean;
  activeProductCount: number;
  canAddProduct: boolean;  // false si expiré et >= 5 produits actifs
}
```

**Calcul du statut :**

| Condition | Statut |
|---|---|
| `isPremium = true` | `'premium'` |
| `trialStart` non défini | `'trial'` (essai en cours, pas encore commencé à compter) |
| jours restants > 7 | `'trial'` |
| jours restants entre 1 et 7 | `'warning'` |
| jours restants ≤ 0 | `'expired'` |

**Règle `canAddProduct` :**
- `premium` → toujours `true`
- `trial` ou `warning` → toujours `true`
- `expired` → `true` seulement si `activeProductCount < 5`

**Déclenchement de `trialStart` :**
Au moment où l'utilisateur ajoute son **premier produit**, si `config.trialStart` est `undefined`, on écrit `trialStart = Date.now()` dans la config (Dexie + Supabase via sync).

---

## Composants

### `BanniereEssai`

Fichier : `frontend/components/BanniereEssai.tsx`

- S'affiche uniquement si `status === 'warning'`
- Fond orange (`#F97316`), texte blanc
- Message : "Votre essai gratuit expire dans **N jour(s)**"
- Bouton "Passer au Premium" → ouvre `ModalUpgrade`
- Fermable par session (état local, revient à la prochaine ouverture)
- Intégrée dans le layout principal sous le header, au-dessus du contenu

### `ModalUpgrade`

Fichier : `frontend/components/ModalUpgrade.tsx`

Utilisé depuis `BanniereEssai` et `EcranExpiration`.

Contenu :
> "Le paiement en ligne arrive bientôt ! Pour passer au Premium maintenant, contactez-nous sur WhatsApp."

Bouton vert "Contacter sur WhatsApp" → ouvre `https://wa.me/[NUMERO]?text=Bonjour%2C+je+veux+passer+au+Premium+MargoPro.`

Le numéro WhatsApp est une constante dans le fichier : `+[PAYS][NUMERO]` — à renseigner avant déploiement. À remplacer par FedaPay plus tard.

### `EcranExpiration`

Fichier : `frontend/components/EcranExpiration.tsx`

- S'affiche uniquement si `status === 'expired'` ET `activeProductCount > 5`
- Position `fixed`, `inset: 0`, `zIndex: 999` — bloque toute navigation
- Non fermable

**Structure :**

1. **En-tête** : titre "Essai terminé", explication :
   > "Votre essai de 30 jours est terminé. Choisissez 5 produits à garder actifs. Les autres seront archivés — pas supprimés. Ils reviennent si vous passez au Premium."

2. **Liste de sélection** : tous les produits actifs avec case à cocher. Maximum 5 sélectionnables. Le compteur "X/5 sélectionnés" est affiché en temps réel.

3. **Bouton "Confirmer"** : actif seulement quand exactement 5 produits sont cochés. Au clic, archive tous les produits non cochés (`archived = true`) puis ferme l'écran.

4. **Bouton "Passer au Premium"** : ouvre `ModalUpgrade`.

### Intégration dans le layout

Fichier : `frontend/app/layout.tsx`

```tsx
<BanniereEssai />
<EcranExpiration />
{children}
```

Les deux composants lisent `usePlan()` et se rendent conditionnellement selon le statut.

---

## Enforcement dans la page Stock

Dans `frontend/app/stock/page.tsx`, le bouton "Ajouter un produit" :
- Si `canAddProduct = false` → le bouton est désactivé visuellement + message au clic : "Limite de 5 produits atteinte. Passez au Premium pour en ajouter plus." → ouvre `ModalUpgrade`.

---

## Activation Premium manuelle (en attendant FedaPay)

Depuis le dashboard Supabase :
```sql
UPDATE config SET is_premium = true WHERE user_id = '[UUID]';
```

Au prochain sync de l'app (démarrage ou reconnexion), `isPremium` passe à `true` et toutes les restrictions disparaissent. Les produits archivés redeviennent visibles automatiquement.

---

## Produits archivés

**Définition "actif"** : un produit est actif si `archived = false` ET `deleted = false`.

- `archived = true` : le produit est masqué de la liste stock, de la recherche barcode, et de la sélection de produits dans les ventes. L'historique des ventes passées reste intact (le nom est stocké dans chaque vente).
- Les produits archivés ne comptent PAS dans `activeProductCount`
- Si `isPremium` devient `true`, tous les produits avec `archived = true` sont automatiquement désarchivés (`archived = false`) au démarrage

---

## Gestion hors ligne

- `trialStart` et `isPremium` sont lus depuis le cache Dexie local — l'app fonctionne hors ligne
- Si `isPremium` a été activé sur Supabase pendant que l'app était hors ligne, la levée des restrictions se fait au prochain sync (à la reconnexion)
- Le chrono continue de décompter hors ligne (basé sur `Date.now()` vs `trialStart` en cache)

---

## SQL à exécuter dans Supabase

```sql
ALTER TABLE config ADD COLUMN IF NOT EXISTS trial_start BIGINT;
ALTER TABLE config ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
```

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `backend/types.ts` | Ajouter `trialStart?`, `isPremium?` à `Config` ; `archived?` à `Produit` |
| `frontend/lib/db.ts` | Migration Dexie v3 : index `archived` sur produits |
| `frontend/lib/sync.ts` | Mapper `trial_start` ↔ `trialStart`, `is_premium` ↔ `isPremium` |
| `frontend/lib/hooks/usePlan.ts` | Nouveau hook (créer) |
| `frontend/components/BanniereEssai.tsx` | Nouveau composant (créer) |
| `frontend/components/ModalUpgrade.tsx` | Nouveau composant (créer) |
| `frontend/components/EcranExpiration.tsx` | Nouveau composant (créer) |
| `frontend/app/layout.tsx` | Ajouter `<BanniereEssai />` et `<EcranExpiration />` |
| `frontend/app/stock/page.tsx` | Désactiver "Ajouter" si `canAddProduct = false` |
| `frontend/lib/hooks/useStock.ts` | Filtrer les produits archivés dans la liste active (impact aussi sur la sélection ventes) |
