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
  }
}

export const db = new MargoDB();

export function genId(): string {
  return crypto.randomUUID();
}
