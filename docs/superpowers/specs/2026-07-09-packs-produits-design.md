# Packs de produits — Spec design
**Date :** 2026-07-09  
**Statut :** À implémenter  
**Accès :** Premium uniquement

---

## Problème à résoudre

Un commerçant a des produits qui ne se vendent plus (stock mort). Pour les liquider, il les associe à un best-seller : le best-seller garde son prix normal, mais le prix total du pack est légèrement inférieur à la somme des deux. Le client y voit une bonne affaire et achète. Le commerçant liquide son stock mort.

---

## Modèle de données

### Nouvelle table Dexie `packs` (version 5)

```typescript
interface Pack {
  id: string;
  nom: string;
  composants: Array<{ produitId: string; produitNom: string; quantite: number }>;
  prixVente: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}
```

Les prix d'achat des composants **ne sont pas stockés** dans le pack. Ils sont lus depuis les produits au moment de la vente — ainsi, si le prix d'achat d'un produit change plus tard, les futures ventes de pack restent cohérentes.

### Migration Dexie v5

```typescript
this.version(5).stores({
  produits: 'id, nom, quantite, updatedAt, deleted, archived',
  ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
  packs: 'id, nom, updatedAt, deleted',
  config: 'id',
});
```

### Table Supabase `packs`

```sql
CREATE TABLE packs (
  id text PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  nom text NOT NULL,
  composants jsonb NOT NULL DEFAULT '[]',
  prix_vente numeric NOT NULL,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL,
  deleted boolean NOT NULL DEFAULT false
);
```

La colonne `composants` est un tableau JSON : `[{ "produit_id": "...", "produit_nom": "...", "quantite": 2 }]`.

---

## Interface — Onglet Stock

### Sélecteur à 3 onglets

```
[ Mes produits ]  [ Packs ]  [ Stock mort ]
```

Le sélecteur `vueStock` passe de `'produits' | 'mort'` à `'produits' | 'packs' | 'mort'`.

### Vue Packs

- Liste des packs existants (cartes)
- Bouton "Créer un pack" en haut à droite (cadenas + modal upgrade si pas Premium)
- Si aucun pack : état vide encourageant à créer le premier

### Carte d'un pack (lecture)

```
[ icône boîte ]  Nom du pack
                 3 produits · Vendu à 1 400 FCFA
                 Bénéfice estimé : +400 FCFA          [ > ]
```

Taper la carte ouvre le bottom sheet d'édition.

### Formulaire de création / édition (bottom sheet)

Champs :
1. **Nom du pack** — texte libre (ex: "Pack Duo Propre")
2. **Produits du pack** — sélecteur multi-produits avec quantité par composant
   - Chaque composant affiché sous forme de ligne : nom + quantité + bouton retrait
   - Bouton "Ajouter un produit" ouvre un picker sur la liste des produits existants
3. **Prix de vente du pack** — nombre, en devise du commerce

Indicateur temps réel (sous le champ prix) :
```
Prix séparés : 1 700 FCFA  →  Tu proposes 1 400 FCFA  (−18%)
Bénéfice : +400 FCFA
```

Si le prix pack est supérieur ou égal à la somme des prix de vente séparés : avertissement orange "Le client ne voit pas de bonne affaire — baisse le prix du pack."

Bouton "Enregistrer" / "Supprimer le pack" (rouge, en bas).

---

## Interface — Onglet Ventes

### Nouvelle vente — toggle Produit / Pack

Au-dessus du formulaire de vente, deux onglets :
```
[ Produit ]  [ Pack ]
```

En mode Pack : liste déroulante des packs disponibles (nom + prix de vente affiché).

À la confirmation de la vente :
- Chaque composant du pack a son stock décrémenté (`quantite -= composant.quantite`)
- Une seule entrée est créée dans la table `ventes` :
  ```typescript
  {
    produitId:  pack.id,        // id du pack, pas d'un produit
    produitNom: pack.nom,
    quantite:   1,              // MVP : 1 pack par transaction (le commerçant retape pour en vendre plusieurs)
    prixVente:  pack.prixVente,
    prixAchat:  sumPrixAchat,   // somme calculée au moment de la vente
    total:      pack.prixVente,
    benefice:   pack.prixVente - sumPrixAchat,
    type:       'pack',         // nouveau champ optionnel sur Vente
  }
  ```

### Impact sur les autres vues

- **Historique ventes** : la vente pack apparaît comme une ligne normale (nom du pack, montant, bénéfice). Le badge `type: 'pack'` peut afficher une icône boîte en option.
- **Stats / Dashboard** : chiffre d'affaires et bénéfice incluent les ventes pack sans modification du code existant.
- **Carnet de crédit** : une vente pack peut être faite à crédit comme n'importe quelle vente.
- **Stock mort** : après vente d'un pack, les produits soldés sortent naturellement du stock mort si leur quantité tombe à 0.

---

## Synchronisation Supabase

`sync.ts` reçoit deux nouvelles paires de fonctions :

- `pushPacks(userId)` — lit les packs locaux modifiés depuis `lastSync`, les upserte dans Supabase.
- `pullPacks(userId, since)` — lit les packs Supabase plus récents que `lastSync`, les écrit en local.

Stratégie identique au reste de la sync : last-write-wins par `updatedAt`.

Le champ `composants` est sérialisé en JSON pour Supabase et désérialisé au pull.

---

## Gestion des cas limites

| Cas | Comportement |
|---|---|
| Un composant du pack est en rupture de stock au moment de la vente | Avertissement avant confirmation : "Savon : stock insuffisant (2 disponibles, 3 demandés)" |
| Un produit composant est supprimé après création du pack | Le pack est affiché avec "[Produit supprimé]" à la place du nom, et ne peut pas être vendu |
| Pack sans composants | Le formulaire bloque l'enregistrement : "Ajoute au moins un produit" |
| Prix pack = 0 | Autorisé (liquidation totale), pas d'avertissement |

---

## Ce qui ne change pas

- Les fiches produits individuelles (prix achat, prix vente, marge %) — inchangées
- La table `ventes` existante — un seul champ optionnel `type` ajouté
- La logique du calculateur de marge — non touchée
- Le plan gratuit — ne voit pas l'onglet Packs (modal upgrade à la place)
