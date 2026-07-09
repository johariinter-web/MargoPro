'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { calculerStats, topProduits, creerVente, creditsEnCours, creditsSoldes, totalCredit, resteADoit } from '@backend/ventes';
import { requestSync } from '../syncController';
import type { Periode } from '@backend/types';

export function useVentes(periode: Periode = 'jour') {
  const ventes = useLiveQuery(
    () => db.ventes.orderBy('date').reverse().filter((v) => !v.deleted).toArray()
  ) ?? [];

  // Ventes supprimées, du plus récent au plus ancien — pour l'historique des suppressions.
  const ventesSupprimees = useLiveQuery(
    () => db.ventes.orderBy('updatedAt').reverse().filter((v) => !!v.deleted).toArray()
  ) ?? [];

  const stats = calculerStats(ventes, periode);
  const top3 = topProduits(ventes, 3);

  async function enregistrerVente(
    produitId: string,
    produitNom: string,
    quantite: number,
    prixVente: number,
    prixAchat: number,
    credit?: { clientNom: string; clientTel?: string; montantRecu: number }
  ) {
    const vente = creerVente(produitId, produitNom, quantite, prixVente, prixAchat, credit);
    await db.ventes.add({ ...vente, id: genId(), deleted: false });
    requestSync();
  }

  async function enregistrerPaiementCredit(venteId: string, montant: number): Promise<string | null> {
    const vente = await db.ventes.get(venteId);
    if (!vente) return 'Vente introuvable';
    const reste = resteADoit(vente);
    if (montant <= 0 || montant > reste) return 'Montant invalide';
    await db.ventes.update(venteId, {
      montantRecu: (vente.montantRecu ?? 0) + montant,
      updatedAt: Date.now(),
    });
    requestSync();
    return null;
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

  async function restaurerVente(id: string) {
    const vente = await db.ventes.get(id);
    if (!vente) return;
    // Annule la suppression : on remet la vente et on redéduit le stock rendu.
    await db.ventes.update(id, { deleted: false, updatedAt: Date.now() });
    const produit = await db.produits.get(vente.produitId);
    if (produit) {
      await db.produits.update(vente.produitId, {
        quantite: Math.max(0, produit.quantite - vente.quantite),
        updatedAt: Date.now(),
      });
    }
    requestSync();
  }

  const credits = creditsEnCours(ventes);
  const soldes = creditsSoldes(ventes);
  const totalDu = totalCredit(ventes);

  return { ventes, ventesSupprimees, stats, top3, credits, soldes, totalDu, enregistrerVente, enregistrerPaiementCredit, supprimerVente, restaurerVente };
}
