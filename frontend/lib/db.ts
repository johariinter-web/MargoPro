'use client';

import Dexie, { type EntityTable } from 'dexie';
import type { Produit, Vente, Config } from '@backend/types';

class MargoDB extends Dexie {
  produits!: EntityTable<Produit, 'id'>;
  ventes!: EntityTable<Vente, 'id'>;
  config!: EntityTable<Config, 'id'>;

  constructor() {
    super('MargoPro');
    this.version(1).stores({
      produits: 'id, nom, quantite, updatedAt',
      ventes: 'id, produitId, date',
      config: 'id',
    });
    // v2 — synchronisation cloud : soft-delete + updatedAt sur les ventes.
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
  }
}

export const db = new MargoDB();

export function genId(): string {
  return crypto.randomUUID();
}
