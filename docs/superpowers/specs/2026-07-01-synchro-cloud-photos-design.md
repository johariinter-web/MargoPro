# Synchronisation cloud des photos de produits — Design

**Date :** 2026-07-01
**Statut :** Validé (comportement, architecture, flux). À transformer en plan d'implémentation.
**Contexte mémoire :** `photos-local-only-decision`, `pricing-free-premium-tiers`, `next-session-agenda`.

## Objectif

Permettre aux photos de produits d'être synchronisées entre appareils (téléphone, ordinateur, gérant) via le cloud. Aujourd'hui les photos sont **locales uniquement** (stockées en base64 dans Dexie/IndexedDB, exclues de la synchro).

**Fonctionnalité Premium** à terme. **Pendant la bêta : active pour tout le monde** (décision 2026-07-01), avec une barrière Premium facile à activer plus tard.

## Décisions clés

- **Approche retenue : Supabase Storage** (Option A). Les images vivent dans un bucket ; seul un petit chemin (`photo_path`) circule dans la synchro. Rejeté : base64 dans la ligne produit (rechargé en boucle par le pull `select('*')` toutes les 60 s → trop gourmand en données).
- **Coût maîtrisé :** une image n'est téléchargée **qu'une seule fois par version** par appareil, puis gardée en cache local. Tant qu'elle ne change pas, elle ne repart jamais sur le réseau.
- **Le gratuit ne change pas :** photos locales, pas de synchro (voir barrière Premium ci-dessous).

## Comportement attendu (utilisateur)

1. Ajout/modification d'une photo → upload automatique en arrière-plan (via la synchro existante).
2. Les autres appareils téléchargent la photo **une seule fois**, puis la conservent.
3. Fonctionne hors-ligne : l'upload se fait dès le retour du réseau (déclencheurs de sync existants).
4. Suppression d'un produit → sa photo est retirée du cloud (pas de déchets).
5. Rien ne change à l'affichage : l'UI lit toujours `produit.photo` (base64 local). Photos visibles hors-ligne.
6. Migration douce : les photos déjà locales chez les testeurs montent au cloud au premier passage.

## Architecture

### 1. Bucket Supabase Storage — `product-photos` (privé)

- Convention de chemin : `{user_id}/{produit_id}/{version}.jpg`, où `version = Date.now()` au moment de l'upload.
- La **version dans le nom de fichier** sert de cache-busting : une photo remplacée a un nouveau chemin → les autres appareils savent qu'il faut re-télécharger.
- **Bucket privé** : accès via le SDK authentifié (`storage.from('product-photos').download(path)` → Blob → base64). Pas d'URL signée à gérer/expirer.
- **Politiques RLS Storage** : un utilisateur ne peut lire/écrire/supprimer que dans son propre dossier (`{user_id}/…`). Le premier segment du chemin doit égaler `auth.uid()`.

### 2. Base de données — colonne `photo_path` sur `produits`

- `photo_path text` nullable. Contient uniquement le chemin dans le bucket (léger). `NULL` = pas de photo.
- Ajoutée aux mappers de `sync.ts` (`ProduitRow`, `produitToRow`, `rowToProduit`).

### 3. Local (Dexie) — champ de suivi `photoPath`

- `Produit.photo` (existant) : base64, pour l'affichage et le hors-ligne. Inchangé.
- `Produit.photoPath` (nouveau, type TS uniquement — pas d'index Dexie, donc pas de migration de schéma) : le chemin cloud que cet appareil a déjà synchronisé/mis en cache. Permet de savoir :
  - si la photo locale n'est **pas encore montée** (`photo` présent mais `photoPath` absent/périmé) ;
  - si le cloud a une **version plus récente** (`remote.photo_path !== local.photoPath`).
- Quand l'utilisateur change/retire une photo dans l'UI (stock), on met `photoPath = undefined` (marque « à re-uploader »).

## Flux de synchronisation (greffé sur `fullSync` existant)

### Push (⬆️)
Pour chaque produit local dont la photo est nouvelle/modifiée (`photo` présent ET (`photoPath` absent OU ne correspond pas)) :
1. Upload de l'image dans `{uid}/{pid}/{Date.now()}.jpg`.
2. Écrire `photo_path` dans la ligne produit (via l'upsert existant).
3. Mettre à jour `photoPath` local = nouveau chemin.
4. Supprimer l'ancien fichier du bucket si remplacement.

Si le produit local n'a plus de photo (`photo` vide) mais avait un `photoPath` → mettre `photo_path = NULL` côté cloud et supprimer le fichier.

### Pull (⬇️)
Pour chaque produit reçu :
- `remote.photo_path` différent du `photoPath` local → `download` du fichier → base64 → écrire dans `produit.photo` + `photoPath = remote.photo_path`.
- `remote.photo_path` NULL mais photo locale existante → retirer la photo locale.
- Identique → ne rien faire (zéro donnée).

## Gestion des erreurs & cas limites

- **Hors-ligne / échec d'upload ou download :** on n'écrit pas `photoPath` (ou `photo_path`) ; la prochaine synchro réessaiera. La synchro ne doit pas planter si une seule photo échoue (try/catch par photo, on continue).
- **Suppression produit :** au push d'un produit `deleted = true` ayant un `photo_path`, supprimer aussi le fichier du bucket (nettoyage).
- **Conflit de version :** dernière modification gagne (comme le reste) via `updatedAt` ; le `photo_path` suit la ligne gagnante.
- **Migration des photos existantes :** au premier push, les produits avec `photo` mais sans `photoPath` sont uploadés → apparaissent sur les autres appareils.
- **Rétrogradation Premium→Gratuit (plus tard) :** on arrête d'uploader/downloader ; les photos déjà en local restent. (Pas de suppression cloud automatique — à décider lors du chantier paiement.)
- **Limites Supabase :** gratuit ≈ 1 Go stockage (~20 000+ photos à 30–50 Ko). Passage au plan Pro financé par les abonnés Premium le moment venu.

## Barrière Premium (couture unique)

- Une seule fonction `peutSyncerPhotos(config)` (ou constante) décide si la synchro photos est active.
- **Pendant la bêta : retourne `true` pour tout le monde.**
- Plus tard : retournera `true` seulement si le compte est Premium (basé sur `config.dateAbonnement` / futur statut d'abonnement).
- Le code de sync photos est enveloppé par ce seul point → activation/désactivation triviale, sans toucher au reste.

## Ce qui NE change pas

- L'UI (stock, catalogue, ventes) lit toujours `produit.photo`. Aucun changement d'affichage.
- Le recadrage carré 400×400 à l'import (`fichierVersPhoto`) reste tel quel.
- La synchro produits/ventes/config existante n'est pas modifiée dans sa logique ; on ajoute seulement le volet photos.

## Tests

- **Logique pure testable :** un helper `cheminPhoto(userId, produitId, version)` et la comparaison de versions → tests unitaires simples.
- **Manuel multi-appareils :** ajouter une photo sur téléphone → vérifier l'apparition sur ordinateur ; remplacer une photo → vérifier la mise à jour ; supprimer un produit → vérifier la disparition du fichier ; couper le réseau → vérifier l'upload différé.
- **Vérifier la sécurité RLS :** un utilisateur ne peut pas accéder au dossier d'un autre.

## Étapes de mise en place (setup, une fois)

1. Créer le bucket privé `product-photos` (dashboard Supabase ou SQL).
2. Ajouter les politiques RLS Storage (accès limité au dossier `{user_id}`).
3. Migration SQL : `alter table produits add column if not exists photo_path text;`
4. Ajouter `photoPath?: string` au type `Produit` (`frontend/backend/types.ts`).
5. Implémenter le volet photos dans `sync.ts` + un module dédié (ex. `lib/photoSync.ts`) pour garder `sync.ts` lisible.
6. Marquer `photoPath = undefined` à l'édition de photo (stock page).
7. Barrière `peutSyncerPhotos` (true en bêta).

## Hors périmètre (plus tard)

- Le paiement / déblocage Premium réel (Mobile Money / Wave) et l'application de la barrière.
- Option « télécharger les photos seulement en Wi-Fi » (si un besoin apparaît).
- Compression/miniatures multiples côté serveur (inutile : déjà 400×400 léger).
