'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { calculerStats, topProduits, creerVente } from '@backend/ventes';
import type { Periode } from '@backend/types';

export function useVentes(periode: Periode = 'jour') {
  const ventes = useLiveQuery(() => db.ventes.orderBy('date').reverse().toArray()) ?? [];

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
    await db.ventes.add({ ...vente, id: genId() });
  }

  return { ventes, stats, top3, enregistrerVente };
}
