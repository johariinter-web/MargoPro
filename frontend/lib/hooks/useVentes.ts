'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { calculerStats, topProduits, creerVente } from '@backend/ventes';
import { requestSync } from '../syncController';
import type { Periode } from '@backend/types';

export function useVentes(periode: Periode = 'jour') {
  const ventes = useLiveQuery(
    () => db.ventes.orderBy('date').reverse().filter((v) => !v.deleted).toArray()
  ) ?? [];

  const stats = calculerStats(ventes, periode);
  const top3 = topProduits(ventes, 3);

  async function enregistrerVente(
    produitId: string,
    produitNom: string,
    quantite: number,
    prixVente: number,
    prixAchat: number
  ) {
    const vente = creerVente(produitId, produitNom, quantite, prixVente, prixAchat);
    await db.ventes.add({ ...vente, id: genId(), deleted: false });
    requestSync();
  }

  async function supprimerVente(id: string) {
    const vente = await db.ventes.get(id);
    if (!vente) return;
    // Soft delete : la suppression se propage entre appareils via la sync.
    await db.ventes.update(id, { deleted: true, updatedAt: Date.now() });
    const produit = await db.produits.get(vente.produitId);
    if (produit) {
      await db.produits.update(vente.produitId, {
        quantite: produit.quantite + vente.quantite,
        updatedAt: Date.now(),
      });
    }
    requestSync();
  }

  return { ventes, stats, top3, enregistrerVente, supprimerVente };
}
