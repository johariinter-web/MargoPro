'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { calculerStats, topProduits, creerVente, creditsEnCours, creditsSoldes, totalCredit, resteADoit } from '@backend/ventes';
import { creerVentePack } from '@backend/packs';
import { requestSync } from '../syncController';
import { purgerVente } from '../sync';
import type { Periode, Pack } from '@backend/types';

export function useVentes(periode: Periode = 'jour') {
  const ventes = useLiveQuery(
    () => db.ventes.orderBy('date').reverse().filter((v) => !v.deleted).toArray()
  ) ?? [];

  // Ventes supprimées, du plus récent au plus ancien - pour l'historique des suppressions.
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

    if (vente.type === 'pack') {
      // Restaurer le stock de chaque composant du pack
      const pack = await db.packs.get(vente.produitId);
      if (pack) {
        for (const c of pack.composants) {
          const produit = await db.produits.get(c.produitId);
          if (produit) {
            await db.produits.update(c.produitId, {
              quantite: produit.quantite + c.quantite,
              updatedAt: Date.now(),
            });
          }
        }
      }
    } else {
      const produit = await db.produits.get(vente.produitId);
      if (produit) {
        await db.produits.update(vente.produitId, {
          quantite: produit.quantite + vente.quantite,
          updatedAt: Date.now(),
        });
      }
    }
    requestSync();
  }

  async function restaurerVente(id: string) {
    const vente = await db.ventes.get(id);
    if (!vente) return;
    // Annule la suppression : on remet la vente et on redéduit le stock rendu.
    await db.ventes.update(id, { deleted: false, updatedAt: Date.now() });

    if (vente.type === 'pack') {
      // Re-déduire le stock de chaque composant
      const pack = await db.packs.get(vente.produitId);
      if (pack) {
        for (const c of pack.composants) {
          const produit = await db.produits.get(c.produitId);
          if (produit) {
            await db.produits.update(c.produitId, {
              quantite: Math.max(0, produit.quantite - c.quantite),
              updatedAt: Date.now(),
            });
          }
        }
      }
    } else {
      const produit = await db.produits.get(vente.produitId);
      if (produit) {
        await db.produits.update(vente.produitId, {
          quantite: Math.max(0, produit.quantite - vente.quantite),
          updatedAt: Date.now(),
        });
      }
    }
    requestSync();
  }

  async function supprimerVenteDefinitivement(id: string): Promise<string | null> {
    try {
      await purgerVente(id);
    } catch {
      return 'Suppression impossible. Vérifiez votre connexion internet et réessayez.';
    }
    await db.ventes.delete(id);
    return null;
  }

  async function enregistrerVentePack(
    pack: Pack,
    credit?: { clientNom: string; clientTel?: string; montantRecu: number }
  ): Promise<string | null> {
    // Lire les produits actuels pour calculer le prixAchat
    const produitsArray = await db.produits.toArray();
    const produitsMap = new Map(produitsArray.map(p => [p.id, p]));

    // Vérifier le stock de chaque composant
    for (const c of pack.composants) {
      const p = produitsMap.get(c.produitId);
      if (!p || p.quantite < c.quantite) {
        return `Stock insuffisant pour "${c.produitNom}" (${p?.quantite ?? 0} disponible${(p?.quantite ?? 0) > 1 ? 's' : ''}, ${c.quantite} demandé${c.quantite > 1 ? 's' : ''})`;
      }
    }

    // Calculer la vente avant la transaction (lecture seule, hors transaction)
    const now = Date.now();
    const vente = creerVentePack(pack, produitsMap, credit);

    // Décrémenter le stock + enregistrer la vente dans une transaction atomique
    await db.transaction('rw', db.produits, db.ventes, async () => {
      for (const c of pack.composants) {
        const produit = produitsMap.get(c.produitId)!;
        await db.produits.update(c.produitId, {
          quantite: produit.quantite - c.quantite,
          updatedAt: now,
        });
      }
      await db.ventes.add({ ...vente, id: genId(), deleted: false });
    });
    requestSync();
    return null;
  }

  const credits = creditsEnCours(ventes);
  const soldes = creditsSoldes(ventes);
  const totalDu = totalCredit(ventes);

  return { ventes, ventesSupprimees, stats, top3, credits, soldes, totalDu, enregistrerVente, enregistrerVentePack, enregistrerPaiementCredit, supprimerVente, restaurerVente, supprimerVenteDefinitivement };
}
