# Suppression définitive dans l'historique des ventes supprimées Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à Juanita de purger définitivement une vente de l'historique des suppressions (Ventes), pour que cette liste ne grossisse pas indéfiniment.

**Architecture:** Une nouvelle fonction dans `lib/sync.ts` supprime directement la ligne côté Supabase (RLS déjà en place, aucune migration nécessaire) ; le hook `useVentes` l'utilise pour supprimer d'abord dans le cloud puis, seulement en cas de succès, fait un vrai `db.ventes.delete(id)` local (pas un soft-delete, sinon la ligne réapparaîtrait dans l'historique). L'UI reprend le pattern déjà établi deux fois cette session (appareils connectés, commandes fournisseur) : sélection unique par tap + une barre d'action avec confirmation.

**Tech Stack:** Next.js 15 App Router, TypeScript, Dexie.js, Supabase

## Global Constraints

- Inline styles uniquement, `fontFamily: 'Manrope, sans-serif'`
- Couleurs via `useColors()`
- Boutons minimum 44px de hauteur
- La suppression définitive doit échouer proprement (message d'erreur, rien de supprimé) si hors ligne — jamais de suppression locale sans confirmation que la suppression cloud a réussi
- Ne touche pas au bandeau "Annuler" existant (suppression normale / soft-delete), ni au reste de la page Ventes
- Pas de commentaires de code sauf si le WHY est non-évident
- `cd frontend && npx tsc --noEmit` doit rendre 0 erreur après chaque tâche touchant le code
- `cd frontend && npm test` doit rester au vert

---

## Fichiers à créer ou modifier

| Action | Fichier | Rôle |
|---|---|---|
| Modifier | `frontend/lib/sync.ts` | Ajoute `purgerVente(id)` — suppression directe côté Supabase |
| Modifier | `frontend/lib/hooks/useVentes.ts` | Ajoute `supprimerVenteDefinitivement(id)` — orchestre cloud puis local |
| Modifier | `frontend/app/ventes/page.tsx` | Sélection unique + barre d'action dans le modal "Historique des suppressions" |

---

## Task 1 : Fonction de suppression cloud + orchestration dans le hook

**Files:**
- Modify: `frontend/lib/sync.ts`
- Modify: `frontend/lib/hooks/useVentes.ts`

**Interfaces:**
- Produces:
  - `purgerVente(id: string): Promise<void>` (exportée de `lib/sync.ts`) — jette une erreur si la suppression Supabase échoue
  - `supprimerVenteDefinitivement(id: string): Promise<string | null>` (exposée par `useVentes()`) — retourne un message d'erreur si ça échoue, `null` si ça réussit ; consommée par `frontend/app/ventes/page.tsx` (Task 2)

- [ ] **Step 1 : Ajouter `purgerVente` dans `frontend/lib/sync.ts`**

Repérer ce bloc :

```typescript
export async function getUserId(): Promise<string | null> {
  const supabase = getClient();
  // getSession lit le cache localStorage sans appel réseau - plus robuste sur mobile.
  // Le token est validé lors de la connexion et auto-rafraîchi par Supabase.
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
```

Juste après (avant le commentaire `// PULL : cloud -> local` qui suit), ajouter :

```typescript

// Suppression definitive (hors du cycle pull/push normal) : utilisee pour
// purger une vente deja soft-deleted de l'historique des suppressions.
export async function purgerVente(id: string): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase.from('ventes').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 2 : Ajouter `supprimerVenteDefinitivement` dans `frontend/lib/hooks/useVentes.ts`**

Repérer la ligne d'import :

```typescript
import { requestSync } from '../syncController';
```

Remplacer par :

```typescript
import { requestSync } from '../syncController';
import { purgerVente } from '../sync';
```

Repérer la fonction `restaurerVente` complète :

```typescript
  async function restaurerVente(id: string) {
    const vente = await db.ventes.get(id);
    if (!vente) return;
    // Annule la suppression : on remet la vente et on redéduit le stock rendu.
    await db.ventes.update(id, { deleted: false, updatedAt: Date.now() });

    if (vente.type === 'pack') {
      // Re-déduire le stock de chaque composant
      const pack = await db.packs.get(vente.produitId);
      if (pack) {
        for (const c of pack.composants) {
          const produit = await db.produits.get(c.produitId);
          if (produit) {
            await db.produits.update(c.produitId, {
              quantite: Math.max(0, produit.quantite - c.quantite),
              updatedAt: Date.now(),
            });
          }
        }
      }
    } else {
      const produit = await db.produits.get(vente.produitId);
      if (produit) {
        await db.produits.update(vente.produitId, {
          quantite: Math.max(0, produit.quantite - vente.quantite),
          updatedAt: Date.now(),
        });
      }
    }
    requestSync();
  }
```

Juste après sa fermeture (avant `async function enregistrerVentePack(`), ajouter :

```typescript

  async function supprimerVenteDefinitivement(id: string): Promise<string | null> {
    try {
      await purgerVente(id);
    } catch {
      return 'Suppression impossible. Vérifiez votre connexion internet et réessayez.';
    }
    await db.ventes.delete(id);
    return null;
  }
```

Repérer la ligne de retour du hook :

```typescript
  return { ventes, ventesSupprimees, stats, top3, credits, soldes, totalDu, enregistrerVente, enregistrerVentePack, enregistrerPaiementCredit, supprimerVente, restaurerVente };
```

Remplacer par :

```typescript
  return { ventes, ventesSupprimees, stats, top3, credits, soldes, totalDu, enregistrerVente, enregistrerVentePack, enregistrerPaiementCredit, supprimerVente, restaurerVente, supprimerVenteDefinitivement };
```

- [ ] **Step 3 : Vérifier les types et les tests**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

Run: `cd frontend && npm test`
Expected: tous les tests passent

- [ ] **Step 4 : Commit**

```bash
git add frontend/lib/sync.ts frontend/lib/hooks/useVentes.ts
git commit -m "feat: suppression definitive d'une vente (cloud + local)"
```

---

## Task 2 : Sélection et barre d'action dans "Historique des suppressions"

**Files:**
- Modify: `frontend/app/ventes/page.tsx`

**Interfaces:**
- Consumes: `supprimerVenteDefinitivement` de `useVentes()` (Task 1)

- [ ] **Step 1 : Récupérer `supprimerVenteDefinitivement` du hook**

Repérer, en haut du composant :

```typescript
  const { ventes, ventesSupprimees, stats, credits, soldes, totalDu, enregistrerVente, enregistrerVentePack, enregistrerPaiementCredit, supprimerVente, restaurerVente } = useVentes(periode);
```

Remplacer par :

```typescript
  const { ventes, ventesSupprimees, stats, credits, soldes, totalDu, enregistrerVente, enregistrerVentePack, enregistrerPaiementCredit, supprimerVente, restaurerVente, supprimerVenteDefinitivement } = useVentes(periode);
```

- [ ] **Step 2 : Ajouter les états de sélection**

Repérer, dans le groupe de déclarations `useState` du composant :

```typescript
  const [showHistorique, setShowHistorique] = useState(false);
```

Juste après, ajouter :

```typescript
  const [venteHistoriqueSelectionneeId, setVenteHistoriqueSelectionneeId] = useState<string | null>(null);
  const [confirmerSuppressionDefinitive, setConfirmerSuppressionDefinitive] = useState(false);
  const [erreurSuppressionDefinitive, setErreurSuppressionDefinitive] = useState('');
```

- [ ] **Step 3 : Ajouter le handler**

Choisir un emplacement logique parmi les autres fonctions `handle*`/`confirmer*` du composant (par exemple juste après `annulerSuppressionVente`), et ajouter :

```typescript
  async function handleSuppressionDefinitive() {
    if (!venteHistoriqueSelectionneeId) return;
    setErreurSuppressionDefinitive('');
    const err = await supprimerVenteDefinitivement(venteHistoriqueSelectionneeId);
    if (err) { setErreurSuppressionDefinitive(err); return; }
    setVenteHistoriqueSelectionneeId(null);
    setConfirmerSuppressionDefinitive(false);
  }
```

- [ ] **Step 4 : Remplacer le contenu du modal "Historique des suppressions"**

Repérer ce bloc complet :

```typescript
      {/* HISTORIQUE DES SUPPRESSIONS */}
      {showHistorique && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowHistorique(false)}
        >
          <div
            style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 36px', maxHeight: '80dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>Historique des suppressions</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Toutes les ventes supprimées restent visibles ici, avec leur date.
            </div>
            {ventesSupprimees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: T.textMuted, fontSize: 14 }}>
                Aucune vente supprimée
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ventesSupprimees.map(v => (
                  <div key={v.id} style={{ background: T.bgSubtle, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.produitNom}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                        Vendue le {new Date(v.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {v.updatedAt ? ` · supprimée le ${new Date(v.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textSub, fontFamily: '"Space Grotesk", sans-serif', flexShrink: 0 }}>
                      {fmtF(v.total)} {symbole}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
```

Remplacer par :

```typescript
      {/* HISTORIQUE DES SUPPRESSIONS */}
      {showHistorique && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => { setShowHistorique(false); setVenteHistoriqueSelectionneeId(null); setConfirmerSuppressionDefinitive(false); setErreurSuppressionDefinitive(''); }}
        >
          <div
            style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 36px', maxHeight: '80dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>Historique des suppressions</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Toutes les ventes supprimées restent visibles ici, avec leur date. Tape une vente pour la supprimer définitivement.
            </div>
            {erreurSuppressionDefinitive && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 12, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreurSuppressionDefinitive}
              </div>
            )}
            {ventesSupprimees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: T.textMuted, fontSize: 14 }}>
                Aucune vente supprimée
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: venteHistoriqueSelectionneeId ? 12 : 0 }}>
                {ventesSupprimees.map(v => {
                  const selectionnee = venteHistoriqueSelectionneeId === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => { setVenteHistoriqueSelectionneeId(id => id === v.id ? null : v.id); setConfirmerSuppressionDefinitive(false); setErreurSuppressionDefinitive(''); }}
                      style={{
                        background: selectionnee ? T.accentLight : T.bgSubtle, borderRadius: 12, padding: '10px 12px',
                        display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                        border: selectionnee ? `1.5px solid ${T.accent}` : '1.5px solid transparent',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.produitNom}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                          Vendue le {new Date(v.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                          {v.updatedAt ? ` · supprimée le ${new Date(v.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: T.textSub, fontFamily: '"Space Grotesk", sans-serif', flexShrink: 0 }}>
                        {fmtF(v.total)} {symbole}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {venteHistoriqueSelectionneeId && (
              confirmerSuppressionDefinitive ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setConfirmerSuppressionDefinitive(false)}
                    style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSuppressionDefinitive}
                    style={{ flex: 2, height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red }}
                  >
                    Confirmer la suppression
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmerSuppressionDefinitive(true)}
                  style={{ width: '100%', height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: T.red }}
                >
                  Supprimer définitivement
                </button>
              )
            )}
          </div>
        </div>
      )}
```

- [ ] **Step 5 : Vérifier les types**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 erreur

- [ ] **Step 6 : Lancer le dev server et tester manuellement**

Run: `cd frontend && npm run dev`

1. Enregistrer une vente, la supprimer (bouton normal), attendre que le bandeau "Annuler" disparaisse
2. Ouvrir Ventes → icône historique → "Historique des suppressions" → la vente apparaît
3. Taper dessus → elle se met en surbrillance, "Supprimer définitivement" apparaît ; retaper la désélectionne
4. Sélectionner → "Supprimer définitivement" → "Confirmer la suppression" → la vente disparaît de la liste
5. Fermer et rouvrir le modal → la vente ne revient pas (vérifie que ce n'est pas juste un état local qui se réinitialiserait)
6. Arrêter le serveur dev (Ctrl+C)

- [ ] **Step 7 : Commit**

```bash
git add frontend/app/ventes/page.tsx
git commit -m "feat: bouton suppression definitive dans l'historique des ventes"
```
