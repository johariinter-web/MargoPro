'use client';

import { db } from './db';
import { createClient } from './supabase/client';
import type { Produit, Vente, Config, Pack } from '@backend/types';
import { uploadPhoto, supprimerPhoto, downloadPhoto, peutSyncerPhotos } from './photoSync';

// =====================================================================
// MargoPro — Engine de synchronisation cloud (local-first)
//
// Stratégie : sync bidirectionnelle complète.
//   pull  : récupère toutes les lignes cloud de l'utilisateur -> fusion LWW dans Dexie
//   push  : envoie toutes les lignes locales (y compris soft-deleted) vers Supabase
//   fullSync : pull puis push (convergence en une passe)
//
// Conflits : last-write-wins par updatedAt (timestamp généré côté appareil).
// Suppressions : soft delete (deleted = true) -> se propage entre appareils.
// =====================================================================

// ---------------------------------------------------------------------
// Mappers : camelCase (local) <-> snake_case (Supabase)
// ---------------------------------------------------------------------

type ProduitRow = {
  id: string;
  user_id: string;
  nom: string;
  quantite: number;
  prix_achat: number;
  prix_vente: number;
  seuil_alerte: number;
  code_barres: string | null;
  categorie: string | null;
  taille_conditionnement: number | null;
  photo_path: string | null;   // ← nouveau
  created_at: number;
  updated_at: number;
  deleted: boolean;
  archived: boolean;
};

type VenteRow = {
  id: string;
  user_id: string;
  produit_id: string;
  produit_nom: string;
  quantite: number;
  prix_vente: number;
  prix_achat: number;
  total: number;
  benefice: number;
  date: number;
  updated_at: number;
  deleted: boolean;
  mode_reglement: string | null;
  client_nom: string | null;
  client_tel: string | null;
  montant_recu: number | null;
  type: string | null;
};

type ConfigRow = {
  user_id: string;
  nom_commerce: string | null;
  devise: string | null;
  symbole_devise: string | null;
  onboarding_complete: boolean;
  date_abonnement: number | null;
  trial_start: number | null;
  is_premium: boolean;
  updated_at: number;
};

type PackRow = {
  id: string;
  user_id: string;
  nom: string;
  composants: Array<{ produit_id: string; produit_nom: string; quantite: number }>;
  prix_vente: number;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

function produitToRow(p: Produit, userId: string): ProduitRow {
  return {
    id: p.id,
    user_id: userId,
    nom: p.nom,
    quantite: p.quantite,
    prix_achat: p.prixAchat,
    prix_vente: p.prixVente,
    seuil_alerte: p.seuilAlerte,
    code_barres: p.codeBarres ?? null,
    categorie: p.categorie ?? null,
    taille_conditionnement: p.tailleConditionnement ?? null,
    photo_path: p.photoPath ?? null,   // ← nouveau
    created_at: p.createdAt ?? Date.now(),
    updated_at: p.updatedAt ?? Date.now(),
    deleted: p.deleted ?? false,
    archived: p.archived ?? false,
  };
}

function rowToProduit(r: ProduitRow): Produit {
  return {
    id: r.id,
    nom: r.nom,
    quantite: Number(r.quantite),
    prixAchat: Number(r.prix_achat),
    prixVente: Number(r.prix_vente),
    seuilAlerte: Number(r.seuil_alerte),
    codeBarres: r.code_barres ?? undefined,
    categorie: r.categorie ?? undefined,
    tailleConditionnement: r.taille_conditionnement ?? undefined,
    photoPath: r.photo_path ?? undefined,   // ← nouveau
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
    archived: r.archived ?? false,
  };
}

function venteToRow(v: Vente, userId: string): VenteRow {
  return {
    id: v.id,
    user_id: userId,
    produit_id: v.produitId,
    produit_nom: v.produitNom,
    quantite: v.quantite,
    prix_vente: v.prixVente,
    prix_achat: v.prixAchat,
    total: v.total,
    benefice: v.benefice,
    date: v.date ?? Date.now(),
    updated_at: v.updatedAt ?? v.date ?? Date.now(),
    deleted: v.deleted ?? false,
    mode_reglement: v.modeReglement ?? null,
    client_nom: v.clientNom ?? null,
    client_tel: v.clientTel ?? null,
    montant_recu: v.montantRecu ?? null,
    type: v.type ?? null,
  };
}

function rowToVente(r: VenteRow): Vente {
  return {
    id: r.id,
    produitId: r.produit_id,
    produitNom: r.produit_nom,
    quantite: Number(r.quantite),
    prixVente: Number(r.prix_vente),
    prixAchat: Number(r.prix_achat),
    total: Number(r.total),
    benefice: Number(r.benefice),
    date: Number(r.date),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
    modeReglement: (r.mode_reglement as 'comptant' | 'credit') ?? undefined,
    clientNom: r.client_nom ?? undefined,
    clientTel: r.client_tel ?? undefined,
    montantRecu: r.montant_recu ?? undefined,
    type: (r.type as 'produit' | 'pack') ?? undefined,
  };
}

function configToRow(c: Config, userId: string): ConfigRow {
  return {
    user_id: userId,
    nom_commerce: c.nomCommerce ?? null,
    devise: c.devise ?? null,
    symbole_devise: c.symboleDevise ?? null,
    onboarding_complete: c.onboardingComplete ?? false,
    date_abonnement: c.dateAbonnement ?? null,
    trial_start: c.trialStart ?? null,
    is_premium: c.isPremium ?? false,
    updated_at: c.updatedAt ?? Date.now(),
  };
}

function rowToConfig(r: ConfigRow): Config {
  return {
    id: 'singleton',
    nomCommerce: r.nom_commerce ?? '',
    devise: r.devise ?? '',
    symboleDevise: r.symbole_devise ?? '',
    onboardingComplete: r.onboarding_complete ?? false,
    dateAbonnement: r.date_abonnement ?? undefined,
    trialStart: r.trial_start ?? undefined,
    isPremium: r.is_premium ?? false,
    updatedAt: Number(r.updated_at),
  };
}

function packToRow(p: Pack, userId: string): PackRow {
  return {
    id: p.id,
    user_id: userId,
    nom: p.nom,
    composants: p.composants.map((c) => ({
      produit_id: c.produitId,
      produit_nom: c.produitNom,
      quantite: c.quantite,
    })),
    prix_vente: p.prixVente,
    created_at: p.createdAt ?? Date.now(),
    updated_at: p.updatedAt ?? Date.now(),
    deleted: p.deleted ?? false,
  };
}

function rowToPack(r: PackRow): Pack {
  const composants = Array.isArray(r.composants) ? r.composants : [];
  return {
    id: r.id,
    nom: r.nom,
    composants: composants.map((c) => ({
      produitId: c.produit_id,
      produitNom: c.produit_nom,
      quantite: Number(c.quantite),
    })),
    prixVente: Number(r.prix_vente),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    deleted: r.deleted ?? false,
  };
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

// Connexion Supabase partagée : une seule instance pour toute la sync.
// Crucial — créer une instance fraîche juste avant un upsert enverrait la
// requête avant que le jeton d'auth soit chargé en mémoire (-> rejet RLS).
let _client: ReturnType<typeof createClient> | null = null;
function getClient() {
  if (!_client) _client = createClient();
  return _client;
}

export async function getUserId(): Promise<string | null> {
  const supabase = getClient();
  // getSession lit le cache localStorage sans appel réseau — plus robuste sur mobile.
  // Le token est validé lors de la connexion et auto-rafraîchi par Supabase.
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

// ---------------------------------------------------------------------
// PULL : cloud -> local (fusion last-write-wins)
// ---------------------------------------------------------------------

async function pull(userId: string): Promise<void> {
  const supabase = getClient();

  // --- produits ---
  const { data: produitsRows, error: pErr } = await supabase
    .from('produits')
    .select('*')
    .eq('user_id', userId);
  if (pErr) throw pErr;

  for (const row of (produitsRows ?? []) as ProduitRow[]) {
    const remote = rowToProduit(row);
    const local = await db.produits.get(remote.id);
    if (!local || remote.updatedAt > local.updatedAt) {
      let mergedPhoto: string | undefined = local?.photo;
      let mergedPhotoPath: string | null | undefined = remote.photoPath;

      if (peutSyncerPhotos()) {
        if (remote.photoPath && remote.photoPath !== local?.photoPath) {
          // Nouveau chemin cloud → télécharger la photo
          try {
            mergedPhoto = await downloadPhoto(supabase, remote.photoPath);
          } catch (err) {
            if (process.env.NODE_ENV !== 'production') console.warn('[photoSync] download échoué pour', remote.id, err);
            // Téléchargement échoué : on garde le cache local ; la prochaine sync réessaiera.
            mergedPhoto = local?.photo;
            mergedPhotoPath = local?.photoPath;
          }
        } else if (!remote.photoPath) {
          // Le cloud indique qu'il n'y a plus de photo
          mergedPhoto = undefined;
          mergedPhotoPath = null;
        }
        // Si même chemin → cache local valide, rien à faire (mergedPhoto = local?.photo déjà)
      } else {
        // Synchro photos désactivée : conserver le cache local tel quel
        mergedPhoto = local?.photo;
        mergedPhotoPath = local?.photoPath;
      }

      await db.produits.put({ ...remote, photo: mergedPhoto, photoPath: mergedPhotoPath });
    }
  }

  // --- ventes ---
  const { data: ventesRows, error: vErr } = await supabase
    .from('ventes')
    .select('*')
    .eq('user_id', userId);
  if (vErr) throw vErr;

  for (const row of (ventesRows ?? []) as VenteRow[]) {
    const remote = rowToVente(row);
    const local = await db.ventes.get(remote.id);
    if (!local || remote.updatedAt > (local.updatedAt ?? local.date)) {
      await db.ventes.put(remote);
    }
  }

  // --- config (une ligne par user) ---
  const { data: configRows, error: cErr } = await supabase
    .from('config')
    .select('*')
    .eq('user_id', userId)
    .limit(1);
  if (cErr) throw cErr;

  const configRow = (configRows ?? [])[0] as ConfigRow | undefined;
  if (configRow) {
    const remote = rowToConfig(configRow);
    const local = await db.config.get('singleton');
    if (!local || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0)) {
      await db.config.put(remote);
    }
  }

  // --- packs (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const { data: packsRows, error: pkErr } = await supabase
      .from('packs')
      .select('*')
      .eq('user_id', userId);
    if (pkErr) throw pkErr;

    for (const row of (packsRows ?? []) as PackRow[]) {
      const remote = rowToPack(row);
      const local = await db.packs.get(remote.id);
      if (!local || remote.updatedAt > (local.updatedAt ?? 0)) {
        await db.packs.put(remote);
      }
    }
  } catch (err) {
    console.warn('[sync] pull packs ignoré :', err);
  }
}

// ---------------------------------------------------------------------
// PUSH : local -> cloud (upsert de toutes les lignes, y compris soft-deleted)
// ---------------------------------------------------------------------

// Push des photos vers Supabase Storage (greffé sur push()).
// Chaque photo est traitée individuellement ; une erreur n'arrête pas les autres.
async function pushPhotos(userId: string, produits: Produit[]): Promise<void> {
  if (!peutSyncerPhotos()) return;
  const supabase = getClient();

  for (const p of produits) {
    try {
      if (p.photo && p.photoPath == null) {
        // Photo nouvelle ou modifiée → upload (les anciennes versions sont nettoyées dans uploadPhoto)
        const newPath = await uploadPhoto(supabase, userId, p);
        // Bumper updatedAt pour que les autres appareils détectent le nouveau photo_path via LWW.
        const now = Date.now();
        await db.produits.update(p.id, { photoPath: newPath, updatedAt: now });
        p.photoPath = newPath;
        p.updatedAt = now;
      } else if (p.photoPath && (!p.photo || p.deleted)) {
        // Photo retirée ou produit supprimé → supprimer le fichier bucket
        await supprimerPhoto(supabase, p.photoPath);
        await db.produits.update(p.id, { photoPath: null });
        p.photoPath = null;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn('[photoSync] push échoué pour', p.id, err);
      // Réseau instable ou quota dépassé : on continue, la prochaine sync réessaiera.
    }
  }
}

async function push(userId: string): Promise<void> {
  const supabase = getClient();

  // --- photos (avant l'upsert pour que photo_path soit à jour dans les lignes) ---
  const produits = await db.produits.toArray();
  await pushPhotos(userId, produits);

  // --- produits ---
  if (produits.length > 0) {
    const rows = produits.map((p) => produitToRow(p, userId));
    const { error } = await supabase.from('produits').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // --- ventes ---
  const ventes = await db.ventes.toArray();
  if (ventes.length > 0) {
    const rows = ventes.map((v) => venteToRow(v, userId));
    const { error } = await supabase.from('ventes').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  // --- config ---
  const config = await db.config.get('singleton');
  if (config) {
    const { error } = await supabase
      .from('config')
      .upsert(configToRow(config, userId), { onConflict: 'user_id' });
    if (error) throw error;
  }

  // --- packs (non-fatal : si la table n'existe pas encore, on continue) ---
  try {
    const packs = await db.packs.toArray();
    if (packs.length > 0) {
      const rows = packs.map((p) => packToRow(p, userId));
      const { error } = await supabase.from('packs').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
  } catch (err) {
    console.warn('[sync] push packs ignoré :', err);
  }
}

// ---------------------------------------------------------------------
// FULL SYNC : pull puis push (convergence)
// ---------------------------------------------------------------------

export async function fullSync(userId: string): Promise<void> {
  await pull(userId);
  await push(userId);
}
