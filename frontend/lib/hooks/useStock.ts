'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerProduit, alertesStockBas, appliquerVente, stockTotal } from '@backend/stock';
import { requestSync } from '../syncController';
import type { Produit } from '@backend/types';

export function useStock() {
  const produits = useLiveQuery(
    () => db.produits.orderBy('nom').filter((p) => !p.deleted).toArray()
  ) ?? [];

  async function ajouterProduit(data: Omit<Produit, 'id' | 'createdAt' | 'updatedAt'>): Promise<string | null> {
    const erreur = validerProduit(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.produits.add({ ...data, id: genId(), createdAt: now, updatedAt: now, deleted: false });
    requestSync();
    return null;
  }

  async function modifierProduit(id: string, data: Partial<Omit<Produit, 'id' | 'createdAt'>>): Promise<string | null> {
    const erreur = validerProduit(data);
    if (erreur) return erreur;
    await db.produits.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerProduit(id: string) {
    // Soft delete : la suppression se propage entre appareils via la sync.
    await db.produits.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  async function deduireStock(produitId: string, quantite: number) {
    const produit = await db.produits.get(produitId);
    if (!produit) return;
    const updated = appliquerVente(produit, quantite);
    await db.produits.put(updated);
    requestSync();
  }

  return {
    produits,
    alertes: alertesStockBas(produits),
    total: stockTotal(produits),
    ajouterProduit,
    modifierProduit,
    supprimerProduit,
    deduireStock,
  };
}
