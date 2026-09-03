'use client';

import Dexie, { type EntityTable } from 'dexie';
import type { Produit, Vente, Config, Pack, Fournisseur, Commande, Depense, Perte } from '@backend/types';

class MargoDB extends Dexie {
  produits!: EntityTable<Produit, 'id'>;
  ventes!: EntityTable<Vente, 'id'>;
  config!: EntityTable<Config, 'id'>;
  packs!: EntityTable<Pack, 'id'>;
  fournisseurs!: EntityTable<Fournisseur, 'id'>;
  commandes!: EntityTable<Commande, 'id'>;
  depenses!: EntityTable<Depense, 'id'>;
  pertes!: EntityTable<Perte, 'id'>;

  constructor() {
    super('MargoPro');
    this.version(1).stores({
      produits: 'id, nom, quantite, updatedAt',
      ventes: 'id, produitId, date',
      config: 'id',
    });
    // v2 - synchronisation cloud : soft-delete + updatedAt sur les ventes.
    this.version(2)
      .stores({
        produits: 'id, nom, quantite, updatedAt, deleted',
        ventes: 'id, produitId, date, updatedAt, deleted',
        config: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('produits').toCollection().modify((p) => {
          if (p.deleted === undefined) p.deleted = false;
        });
        await tx.table('ventes').toCollection().modify((v) => {
          if (v.deleted === undefined) v.deleted = false;
          if (v.updatedAt === undefined) v.updatedAt = v.date ?? Date.now();
        });
        await tx.table('config').toCollection().modify((c) => {
          if (c.updatedAt === undefined) c.updatedAt = Date.now();
        });
      });
    // v3 - plan gratuit : champ archived sur les produits
    this.version(3)
      .stores({
        produits: 'id, nom, quantite, updatedAt, deleted, archived',
        ventes: 'id, produitId, date, updatedAt, deleted',
        config: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('produits').toCollection().modify((p) => {
          if (p.archived === undefined) p.archived = false;
        });
      });
    // v4 - ventes à crédit : index modeReglement
    this.version(4)
      .stores({
        produits: 'id, nom, quantite, updatedAt, deleted, archived',
        ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
        config: 'id',
      })
      .upgrade(async (tx) => {
        await tx.table('ventes').toCollection().modify((v) => {
          if (v.modeReglement === undefined) v.modeReglement = 'comptant';
        });
      });
    // v5 - packs de produits pour liquider le stock mort
    this.version(5).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      config: 'id',
    });
    // v6 - fournisseurs et commandes fournisseur
    this.version(6).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      fournisseurs: 'id, nom, updatedAt, deleted',
      commandes: 'id, fournisseurId, dateCommande, updatedAt, deleted',
      config: 'id',
    });
    // v7 - journal de depenses (charges de la boutique) pour le seuil de rentabilite
    this.version(7).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      fournisseurs: 'id, nom, updatedAt, deleted',
      commandes: 'id, fournisseurId, dateCommande, updatedAt, deleted',
      depenses: 'id, date, updatedAt, deleted',
      config: 'id',
    });
    // v8 - pertes de stock (produits abimes ou casses) pour le seuil de rentabilite
    this.version(8).stores({
      produits: 'id, nom, quantite, updatedAt, deleted, archived',
      ventes: 'id, produitId, date, updatedAt, deleted, modeReglement',
      packs: 'id, nom, updatedAt, deleted',
      fournisseurs: 'id, nom, updatedAt, deleted',
      commandes: 'id, fournisseurId, dateCommande, updatedAt, deleted',
      depenses: 'id, date, updatedAt, deleted',
      pertes: 'id, produitId, date, updatedAt, deleted',
      config: 'id',
    });
  }
}

export const db = new MargoDB();

export function genId(): string {
  return crypto.randomUUID();
}

// À appeler à chaque déconnexion : sans ça, les données du compte précédent
// restent dans IndexedDB et se retrouvent copiées vers le compte suivant qui
// se connecte sur le même appareil (le push envoie tout ce qui est en local,
// peu importe quel compte l'a créé).
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', [db.produits, db.ventes, db.packs, db.fournisseurs, db.commandes, db.depenses, db.pertes, db.config], async () => {
    await db.produits.clear();
    await db.ventes.clear();
    await db.packs.clear();
    await db.fournisseurs.clear();
    await db.commandes.clear();
    await db.depenses.clear();
    await db.pertes.clear();
    await db.config.clear();
  });
}

const PROPRIETAIRE_DONNEES_KEY = 'margopro_local_data_owner';

// Permet de ne vider les données locales à la connexion que quand le compte
// qui se connecte diffère de celui déjà en cache (voir auth/page.tsx) --
// sinon une simple expiration de session forcerait un rechargement complet
// depuis le cloud à chaque reconnexion, même pour retrouver son propre compte.
export function estProprietaireDonneesLocales(userId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PROPRIETAIRE_DONNEES_KEY) === userId;
  } catch {
    return false;
  }
}

export function marquerProprietaireDonneesLocales(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROPRIETAIRE_DONNEES_KEY, userId);
  } catch {
    /* stockage indisponible : impossible de retenir le proprietaire, on effacera par prudence a la prochaine connexion */
  }
}
