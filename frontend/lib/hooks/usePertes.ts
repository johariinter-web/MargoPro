'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerPerte } from '@backend/pertes';
import { appliquerVente } from '@backend/stock';
import { requestSync } from '../syncController';

export function usePertes() {
  const pertes = useLiveQuery(
    () => db.pertes.orderBy('date').reverse().filter((p) => !p.deleted).toArray()
  ) ?? [];

  async function declarerPerte(
    produitId: string,
    produitNom: string,
    quantite: number,
    prixAchat: number
  ): Promise<string | null> {
    const produit = await db.produits.get(produitId);
    if (!produit) return 'Produit introuvable';

    const erreur = validerPerte(quantite, produit.quantite);
    if (erreur) return erreur;

    const now = Date.now();
    await db.transaction('rw', db.produits, db.pertes, async () => {
      const updated = appliquerVente(produit, quantite);
      await db.produits.put(updated);
      await db.pertes.add({
        id: genId(),
        produitId,
        produitNom,
        quantite,
        prixAchat,
        date: now,
        createdAt: now,
        updatedAt: now,
        deleted: false,
      });
    });
    requestSync();
    return null;
  }

  return { pertes, declarerPerte };
}
