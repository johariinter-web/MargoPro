# Vraie marge et seuil de rentabilité

**Date :** 2026-09-02
**Statut :** Approuvé
**Contexte :** L'onglet Marges calcule aujourd'hui le bénéfice par produit (prix vente − prix achat) mais jamais la vraie marge du commerçant, qui doit aussi couvrir ses charges de boutique (loyer, transport, électricité...). Juanita veut que l'appli lui dise quelle marge appliquer sur un produit pour être vraiment rentable, et combien elle doit vendre par jour/mois pour couvrir ses charges.

## Problème

Le calculateur de `frontend/app/marges/page.tsx` (onglet `%Marge`) ne connaît que le prix d'achat du produit. Il ne sait rien des charges de la boutique (loyer, transport, etc.), donc le "bénéfice" qu'il affiche peut être positif sur le papier tout en laissant le commerçant perdant une fois les charges réelles payées. Il n'existe non plus aucun moyen de savoir combien vendre pour couvrir ces charges.

## Design

### Modèle de données : journal de dépenses

Nouvelle entité **Dépense**, même style que `Produit`/`Vente` (id, updatedAt, deleted, sync Supabase avec RLS par `user_id`) :
- `nom` (obligatoire — ex. "Loyer", "Transport")
- `montant` (obligatoire)
- `date` (aujourd'hui par défaut, modifiable)

3 champs, ajout au fil de l'eau (pas de récurrence automatique : loyer, transport et achats varient trop d'un mois à l'autre pour Juanita, donc pas de logique "mensuel qui se répète tout seul" — elle ajoute chaque dépense quand elle survient, comme elle enregistre une vente).

**Explicitement exclu :** l'achat de marchandise à revendre. C'est déjà compté via le `prixAchat` de chaque produit dans le calcul du bénéfice par vente (`Vente.benefice`) — l'inclure dans les dépenses compterait le même coût deux fois.

### Emplacement

Le sélecteur d'onglets de `frontend/app/marges/page.tsx` gagne un nouvel onglet **"Seuil de rentabilité"**, à côté de `%Marge` / `Pluriels` / `Catalogue`. Le journal de dépenses se gère depuis cet onglet (liste + formulaire d'ajout/édition/suppression, 3 champs).

Accès réservé Premium (`accesFonctionnalitesPremium` de `usePlan()`), cohérent avec Fournisseurs / Stock mort / Carnet / Packs / historique / Alertes.

### Période de référence

Mois calendaire en cours (1er du mois à aujourd'hui), cohérent avec le "jour/semaine/mois" déjà utilisé ailleurs dans l'app (tableau de bord, ventes).

### Onglet "%Marge" — ajouts

Le calculateur existant (prix d'achat → prix de vente conseillé + bénéfice par unité) ne change pas dans son fonctionnement. Deux ajouts au-dessus :

**Marge plancher.** Calculée à partir des vraies données du mois en cours :
```
marge plancher (%) = (charges du mois / CA du mois) × 100
```
Affichée en rouge/orange, avec un message explicite : *"En dessous de X%, tu ne gagnes rien une fois tes charges payées."* Ce n'est pas un objectif, c'est un seuil de survie — le message doit le dire clairement pour ne pas laisser croire que l'atteindre suffit.

Si le produit/la marge saisie dans le calculateur est en dessous du plancher, le résultat (bloc "Prix de vente conseillé / Bénéfice par unité") affiche l'alerte. Dans la liste des produits groupée par catégorie, les produits dont le `pct` est sous le plancher sont mis en évidence avec le même code couleur rouge déjà utilisé (actuellement basé sur un seuil fixe de 25% — à remplacer par le plancher calculé).

**Repère de marché (secondaire, informatif).** Un petit texte fixe, sans calcul, pour aider à juger sans imposer un chiffre : *"💡 Repère : produits courants x1,3 à x2 le prix d'achat, produits à forte valeur (cosmétique, habillement...) x3 à x5."* Affiché en dessous du plancher, plus discret — le plancher (propre aux vraies charges de la boutique) reste l'info principale.

**Pas assez de données.** Si le CA du mois en cours est à 0 (aucune vente ce mois), le plancher ne peut pas être calculé : afficher *"Pas encore assez de ventes ce mois pour calculer ta marge plancher."* à la place, calculateur et repère de marché restent utilisables normalement.

### Onglet "Seuil de rentabilité" — contenu

- **Charges du mois** : total des dépenses du mois en cours, avec accès au journal (liste + ajout/édition/suppression)
- **Bénéfice généré ce mois** : somme de `Vente.benefice` pour les ventes du mois en cours (déjà calculé et stocké par vente, donc pas de nouveau calcul de fond)
- **Barre de progression** : bénéfice généré vs charges du mois, en %
- **Objectif de vente**, calculé ainsi :
  ```
  bénéfice restant   = max(0, charges du mois − bénéfice généré ce mois)
  bénéfice moyen/vente = bénéfice généré ce mois / nombre de ventes ce mois
  ventes restantes   = bénéfice restant / bénéfice moyen par vente
  jours restants      = dernier jour du mois − aujourd'hui (minimum 1)
  objectif/jour        = arrondi supérieur(ventes restantes / jours restants)
  ```
  Affiché comme "≈ N ventes/jour jusqu'à la fin du mois". Si `bénéfice restant` est déjà à 0 (seuil atteint), message positif à la place de l'objectif : *"Tu as couvert tes charges ce mois, tout bénéfice supplémentaire est net pour toi."*
- **Pas assez de données** : si aucune vente ce mois, ne pas diviser par zéro — afficher un message d'attente au lieu de l'objectif chiffré.

### Technique

- Nouvelle table Dexie `depenses` (nouvelle version de schéma dans `frontend/lib/db.ts`, pattern identique à `fournisseurs`/`packs`)
- Nouvelle table Supabase `depenses` avec RLS `user_id = auth.uid()`, migration SQL à exécuter par Juanita
- Extension de `lib/sync.ts` (mappers + push/pull, non-fatal try/catch) pour cette table, suivant exactement le pattern de `packs`/`fournisseurs`
- `clearLocalData()` (`frontend/lib/db.ts`) doit aussi vider `depenses`
- Le seuil "produit en dessous du plancher" dans la liste `%Marge` remplace le seuil fixe actuel de 25% (`catOk`/`isGood` dans `marges/page.tsx`) par le plancher calculé — pas de nouveau composant, juste la valeur de comparaison qui change

## Hors scope (pour l'instant)

- Dépenses récurrentes automatiques (loyer qui se recopie seul chaque mois) — décidé explicitement pendant le brainstorm, les charges de Juanita varient trop pour que ça ait du sens
- Allocation du plancher par produit individuel (ex. plancher différent pour un produit à faible rotation) — le plancher reste un seul chiffre global pour toute la boutique
- Chiffre de "marge conseillée" calculé automatiquement au-dessus du plancher — remplacé par le repère de marché fixe (x1,3–x2 / x3–x5), qui ne dépend pas des charges de Juanita et ne doit pas être présenté comme personnalisé
- Historique/graphique de l'évolution du seuil de rentabilité mois par mois
