# Fournisseurs — description de commande + suppression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à Juanita de décrire ce qu'elle commande (description + quantité, optionnelles), de supprimer une commande devenue inutile, et de garder l'historique compact en repliant les commandes déjà reçues.

**Architecture:** Extension additive de l'entité `Commande` existante (deux nouveaux champs optionnels, non indexés — aucune migration de schéma Dexie nécessaire) ; l'UI de `FournisseurFiche.tsx` gagne deux champs de formulaire, un affichage enrichi, un repli des commandes reçues (même pattern que les crédits soldés du Carnet), et une sélection unique + barre d'action pour la suppression (même pattern que les appareils connectés).

**Tech Stack:** Next.js 15 App Router, TypeScript, Dexie.js, Supabase

## Global Constraints

- Inline styles uniquement — suivre le pattern déjà en place dans `frontend/components/FournisseurFiche.tsx`
- `fontFamily: 'Manrope, sans-serif'`
- Couleurs via `useColors()`, sauf les rouges d'urgence déjà en dur ailleurs dans ce fichier (`#EF4444`)
- Boutons minimum 44px de hauteur
- `description` et `quantite` restent **optionnelles** — une commande sans ces champs doit rester valide, aucune migration de données existantes nécessaire
- `type="text" inputMode="decimal"` pour tout champ numérique, avec `onWheel={e => e.currentTarget.blur()}`
- Pas de commentaires de code sauf si le WHY est non-évident
- `cd frontend && npx tsc --noEmit` doit rendre 0 erreur après chaque tâche touchant le code
- `cd frontend && npm test` doit rester au vert

---

## Fichiers à créer ou modifier

| Action | Fichier | Rôle |
|---|---|---|
| Modifier | `frontend/backend/types.ts` | Ajoute `description?`/`quantite?` à `Commande` |
| Modifier | `frontend/lib/sync.ts` | Étend `CommandeRow` + mappers pour les deux nouveaux champs |
| Créer | `frontend/supabase-migration-2026-07-15-fournisseurs-description.sql` | Ajoute les 2 colonnes à `commandes` |
| Modifier | `frontend/components/FournisseurFiche.tsx` | Formulaire + affichage + repli + sélection/suppression |

---

## Task 1 : Backend + synchronisation cloud

**Files:**
- Modify: `frontend/backend/types.ts`
- Modify: `frontend/lib/sync.ts`
- Create: `frontend/supabase-migration-2026-07-15-fournisseurs-description.sql`

**Interfaces:**
- Produces: `Commande` (mis à jour) avec `description?: string` et `quantite?: number` — ces deux champs sont consommés par `FournisseurFiche.tsx` (Task 2)

- [ ] **Step 1 : Étendre `Commande` dans `frontend/backend/types.ts`**

Repérer l'interface `Commande` existante :

```typescript
export interface Commande {
  id: string;
  fournisseurId: string;
  dateCommande: number;
  delaiJours: number;
  montant: number;
  recue: boolean;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

Remplacer par :

```typescript
export interface Commande {
  id: string;
  fournisseurId: string;
  dateCommande: number;
  delaiJours: number;
  montant: number;
  recue: boolean;
  description?: string;
  quantite?: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

- [ ] **Step 2 : Étendre `CommandeRow` et les mappers dans `frontend/lib/sync.ts`**

Repérer le type `CommandeRow` :

```typescript
type CommandeRow = {
  id: string;
  user_id: string;
  fournisseur_id: string;
  date_commande: number;
  delai_jours: number;
  montant: number;
  recue: boolean;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};
```

Remplacer par :

```typescript
type CommandeRow = {
  id: string;
  user_id: string;
  fournisseur_id: string;
  date_commande: number;
  delai_jours: number;
  montant: number;
  recue: boolean;
  description: string | null;
  quantite: number | null;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};
```

Repérer `commandeToRow` :

```typescript
function commandeToRow(c: Commande, userId: string): CommandeRow {
  return {
    id: c.id,
    user_id: userId,
    fournisseur_id: c.fournisseurId,
    date_commande: c.dateCommande,
    delai_jours: c.delaiJours,
    montant: c.montant,
    recue: c.recue ?? false,
    created_at: c.createdAt ?? Date.now(),
    updated_at: c.updatedAt ?? Date.now(),
    deleted: c.deleted ?? false,
  };
}
```

Remplacer par :

```typescript
function commandeToRow(c: Commande, userId: string): CommandeRow {
  return {
    id: c.id,
    user_id: userId,
    fournisseur_id: c.fournisseurId,
    date_commande: c.dateCommande,
    delai_jours: c.delaiJours,
    montant: c.montant,
    recue: c.recue ?? false,
    description: c.description ?? null,
    quantite: c.quantite ?? null,
    created_at: c.createdAt ?? Date.now(),
    updated_at: c.updatedAt ?? Date.now(),
    deleted: c.deleted ?? false,
  };
}
```

Repérer `rowToCommande` :

```typescript
function rowToCommande(r: CommandeRow): Commande {
  return {
    id: r.id,
    fournisseurId: r.fournisseur_id,
    dateCommande: Number(r.date_commande),
    delaiJours: Number(r.delai_jours),
    montant: Number(r.montant),
    recue: r.recue ?? false,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}
```

Remplacer par :

```typescript
function rowToCommande(r: CommandeRow): Commande {
  return {
    id: r.id,
    fournisseurId: r.fournisseur_id,
    dateCommande: Number(r.date_commande),
    delaiJours: Number(r.delai_jours),
    montant: Number(r.montant),
    recue: r.recue ?? false,
    description: r.description ?? undefined,
    quantite: r.quantite ?? undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}
```

- [ ] **Step 3 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 4 : Créer la migration `frontend/supabase-migration-2026-07-15-fournisseurs-description.sql`**

```sql
-- =====================================================================
-- MargoPro — Migration 2026-07-15
-- Ajoute description + quantite aux commandes fournisseur
--
-- À exécuter dans Supabase : Dashboard → SQL Editor → New query → coller → Run
-- =====================================================================

alter table public.commandes
  add column if not exists description text,
  add column if not exists quantite numeric;
```

- [ ] **Step 5 : Vérifier les tests**

Run: `cd frontend && npm test`
Expected: tous les tests passent (les nouveaux champs sont optionnels, aucun test existant ne doit casser)

- [ ] **Step 6 : Commit**

```bash
git add frontend/backend/types.ts frontend/lib/sync.ts frontend/supabase-migration-2026-07-15-fournisseurs-description.sql
git commit -m "feat: description et quantite optionnelles sur les commandes fournisseur"
```

---

## Task 2 : Formulaire, affichage, repli, sélection et suppression

**Files:**
- Modify: `frontend/components/FournisseurFiche.tsx`

**Interfaces:**
- Consumes: `Commande.description`/`Commande.quantite` (Task 1) ; `supprimerCommande` de `useFournisseurs()` (déjà exposée par le hook depuis le chantier précédent, jamais branchée à une UI jusqu'ici)

- [ ] **Step 1 : Ajouter les nouveaux états**

Repérer ce bloc (juste après la déclaration de `commandes`) :

```typescript
  const [modeEdition, setModeEdition] = useState(false);
```

Repérer aussi, plus bas dans le même groupe de déclarations :

```typescript
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
```

Juste après cette ligne `const [confirmerSuppression, setConfirmerSuppression] = useState(false);`, ajouter :

```typescript
  const [description, setDescription] = useState('');
  const [quantite, setQuantite] = useState('');
  const [commandeSelectionneeId, setCommandeSelectionneeId] = useState<string | null>(null);
  const [confirmerSuppressionCommande, setConfirmerSuppressionCommande] = useState(false);
  const [voirRecues, setVoirRecues] = useState(false);
```

- [ ] **Step 2 : Ajouter `supprimerCommande` aux fonctions consommées du hook**

Repérer :

```typescript
  const {
    commandesDuFournisseur,
    ajouterCommande,
    marquerCommandeRecue,
    modifierFournisseur,
    supprimerFournisseur,
  } = useFournisseurs();
```

Remplacer par :

```typescript
  const {
    commandesDuFournisseur,
    ajouterCommande,
    marquerCommandeRecue,
    supprimerCommande,
    modifierFournisseur,
    supprimerFournisseur,
  } = useFournisseurs();
```

- [ ] **Step 3 : Mettre à jour `handleNouvelleCommande` et ajouter `handleSupprimerCommande`**

Repérer :

```typescript
  async function handleNouvelleCommande() {
    setErreurCommande('');
    const delai = Number(delaiJours);
    const mnt = Number(montant);
    if (delaiJours.trim() === '') { setErreurCommande('Délai de livraison invalide'); return; }
    if (delai < 0) { setErreurCommande('Le délai ne peut pas être négatif'); return; }
    if (!mnt || mnt <= 0) { setErreurCommande('Montant invalide'); return; }
    const err = await ajouterCommande({
      fournisseurId: fournisseur.id,
      dateCommande: Date.now(),
      delaiJours: delai,
      montant: mnt,
    });
    if (err) { setErreurCommande(err); return; }
    setDelaiJours(fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '');
    setMontant('');
    setShowCommandeForm(false);
  }
```

Remplacer par :

```typescript
  async function handleNouvelleCommande() {
    setErreurCommande('');
    const delai = Number(delaiJours);
    const mnt = Number(montant);
    if (delaiJours.trim() === '') { setErreurCommande('Délai de livraison invalide'); return; }
    if (delai < 0) { setErreurCommande('Le délai ne peut pas être négatif'); return; }
    if (!mnt || mnt <= 0) { setErreurCommande('Montant invalide'); return; }
    const err = await ajouterCommande({
      fournisseurId: fournisseur.id,
      dateCommande: Date.now(),
      delaiJours: delai,
      montant: mnt,
      description: description.trim() || undefined,
      quantite: Number(quantite) > 0 ? Number(quantite) : undefined,
    });
    if (err) { setErreurCommande(err); return; }
    setDelaiJours(fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '');
    setMontant('');
    setDescription('');
    setQuantite('');
    setShowCommandeForm(false);
  }

  async function handleSupprimerCommande() {
    if (!commandeSelectionneeId) return;
    await supprimerCommande(commandeSelectionneeId);
    setCommandeSelectionneeId(null);
    setConfirmerSuppressionCommande(false);
  }
```

- [ ] **Step 4 : Ajouter les champs Description et Quantité au formulaire "Nouvelle commande"**

Repérer, à l'intérieur du formulaire de commande :

```typescript
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Délai de livraison (jours)</label>
```

Juste avant ce bloc `<div style={{ marginBottom: 10 }}>` (qui contient le label "Délai de livraison"), insérer :

```typescript
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Description (optionnel)</label>
                  <input
                    type="text" onWheel={e => e.currentTarget.blur()}
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Ex : Babouches"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Quantité (optionnel)</label>
                  <input
                    type="text" inputMode="decimal" onWheel={e => e.currentTarget.blur()}
                    value={quantite} onChange={e => setQuantite(e.target.value)}
                    placeholder="Ex : 50"
                    style={inputStyle}
                  />
                </div>
```

(Le bloc "Délai de livraison" existant suit juste après, inchangé.)

- [ ] **Step 5 : Remplacer la section historique complète (affichage enrichi + repli des reçues + sélection/suppression)**

Repérer ce bloc complet, du commentaire "Historique des commandes" jusqu'à la fermeture du bouton "Supprimer ce fournisseur" (juste avant les deux `</>`  / `)}` finaux qui ferment le composant) :

```typescript
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Historique des commandes
            </div>
            {commandes.length === 0 ? (
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>Aucune commande pour l&apos;instant</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {commandes.map(c => {
                  const enRetard = estEnRetard(c);
                  return (
                    <div key={c.id} style={{
                      background: T.bgSubtle, borderRadius: 12, padding: '10px 14px',
                      border: enRetard ? '1.5px solid #EF4444' : `1px solid ${T.border}`,
                      opacity: c.recue ? 0.6 : 1,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: T.text, textDecoration: c.recue ? 'line-through' : 'none' }}>
                          {fmtF(c.montant)} {symbole}
                        </span>
                        {enRetard && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 En retard</span>}
                        {c.recue && <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>✓ Reçue</span>}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                        Commandée le {new Date(c.dateCommande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' · '}Prévue le {new Date(dateLivraisonPrevue(c)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </div>
                      {!c.recue && (
                        <button
                          onClick={() => marquerCommandeRecue(c.id)}
                          style={{ marginTop: 8, height: 32, padding: '0 12px', borderRadius: 8, background: T.greenBg, color: T.green, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                        >
                          Marquer reçue
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {confirmerSuppression ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmerSuppression(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => { supprimerFournisseur(fournisseur.id); onFermer(); }}
                  style={{ flex: 2, height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red }}
                >
                  Confirmer la suppression
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmerSuppression(true)}
                style={{ width: '100%', height: 44, borderRadius: 12, background: 'none', border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textMuted }}
              >
                Supprimer ce fournisseur
              </button>
            )}
```

Remplacer tout ce bloc par :

```typescript
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Historique des commandes
            </div>
            {commandes.length === 0 ? (
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>Aucune commande pour l&apos;instant</div>
            ) : (() => {
              const carteCommande = (c: typeof commandes[number]) => {
                const enRetard = estEnRetard(c);
                const selectionnee = commandeSelectionneeId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => { setCommandeSelectionneeId(id => id === c.id ? null : c.id); setConfirmerSuppressionCommande(false); }}
                    style={{
                      background: selectionnee ? T.accentLight : T.bgSubtle, borderRadius: 12, padding: '10px 14px',
                      border: selectionnee ? `1.5px solid ${T.accent}` : enRetard ? '1.5px solid #EF4444' : `1px solid ${T.border}`,
                      opacity: c.recue ? 0.6 : 1, cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, textDecoration: c.recue ? 'line-through' : 'none' }}>
                        {c.description ? `${c.description} · ` : ''}{c.quantite ? `${c.quantite} unités · ` : ''}{fmtF(c.montant)} {symbole}
                      </span>
                      {enRetard && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 En retard</span>}
                      {c.recue && <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>✓ Reçue</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                      Commandée le {new Date(c.dateCommande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' · '}Prévue le {new Date(dateLivraisonPrevue(c)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                    {!c.recue && (
                      <button
                        onClick={e => { e.stopPropagation(); marquerCommandeRecue(c.id); }}
                        style={{ marginTop: 8, height: 32, padding: '0 12px', borderRadius: 8, background: T.greenBg, color: T.green, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                      >
                        Marquer reçue
                      </button>
                    )}
                  </div>
                );
              };
              const enCours = commandes.filter(c => !c.recue);
              const recues = commandes.filter(c => c.recue);
              return (
                <>
                  {enCours.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: recues.length > 0 ? 8 : 16 }}>
                      {enCours.map(carteCommande)}
                    </div>
                  )}
                  {enCours.length === 0 && recues.length > 0 && (
                    <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '12px 0' }}>Aucune commande en cours</div>
                  )}
                  {recues.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <button
                        onClick={() => setVoirRecues(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.textMuted, padding: '4px 0', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}
                      >
                        {voirRecues ? 'Masquer' : `Voir les ${recues.length} commande${recues.length > 1 ? 's' : ''} reçue${recues.length > 1 ? 's' : ''}`}
                      </button>
                      {voirRecues && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {recues.map(carteCommande)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {commandeSelectionneeId && (
              confirmerSuppressionCommande ? (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <button
                    onClick={() => setConfirmerSuppressionCommande(false)}
                    style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSupprimerCommande}
                    style={{ flex: 2, height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red }}
                  >
                    Confirmer la suppression
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmerSuppressionCommande(true)}
                  style={{ width: '100%', height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 20 }}
                >
                  Supprimer cette commande
                </button>
              )
            )}

            {confirmerSuppression ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmerSuppression(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => { supprimerFournisseur(fournisseur.id); onFermer(); }}
                  style={{ flex: 2, height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red }}
                >
                  Confirmer la suppression
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmerSuppression(true)}
                style={{ width: '100%', height: 44, borderRadius: 12, background: 'none', border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textMuted }}
              >
                Supprimer ce fournisseur
              </button>
            )}
```

Notes pour éviter toute confusion pendant l'implémentation :
- Il y a maintenant **deux** blocs de confirmation de suppression distincts dans ce fichier : celui de la commande sélectionnée (nouveau, utilise `confirmerSuppressionCommande`) et celui du fournisseur (déjà existant, utilise `confirmerSuppression`, inchangé). Ne pas les fusionner ni renommer l'un en fonction de l'autre.
- Le bouton "Marquer reçue" est à l'intérieur de la carte cliquable (sélection) — le `e.stopPropagation()` sur son `onClick` est nécessaire pour qu'un tap dessus ne sélectionne pas aussi la commande par accident. Ne pas l'omettre.

- [ ] **Step 6 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 7 : Lancer le dev server et tester manuellement**

Run: `cd frontend && npm run dev`

1. Ouvrir Stock → Fournisseurs → ouvrir un fournisseur existant (ou en créer un)
2. "Nouvelle commande" → remplir Description ("Babouches"), Quantité (50), Délai (7), Montant (150000) → Confirmer → la commande apparaît dans l'historique avec "Babouches · 50 unités · 150 000 FCFA"
3. Créer une deuxième commande sans description ni quantité → elle s'affiche comme avant (juste le montant)
4. Taper sur une commande dans l'historique → elle se met en surbrillance, un bouton "Supprimer cette commande" apparaît en dessous ; retaper la même commande la désélectionne et fait disparaître le bouton
5. Sélectionner une commande → "Supprimer cette commande" → "Confirmer la suppression" → elle disparaît de l'historique
6. Marquer une commande comme reçue → elle passe dans la section repliée "Voir les X commandes reçues" (pas plus dans la liste principale) ; cliquer sur le lien la déplie
7. Vérifier que "Marquer reçue" fonctionne toujours normalement (ne sélectionne pas la carte par erreur)
8. Arrêter le serveur dev (Ctrl+C)

- [ ] **Step 8 : Commit**

```bash
git add frontend/components/FournisseurFiche.tsx
git commit -m "feat: description/quantite, repli des commandes recues, suppression de commande"
```

---

## Task 3 : Migration Supabase (étape manuelle, hors code)

**Files:** aucun.

- [ ] **Step 1 : Exécuter la migration**

Dashboard Supabase → SQL Editor → coller le contenu de `frontend/supabase-migration-2026-07-15-fournisseurs-description.sql` (créé à la Task 1) → Run.
