import type { Pack, Vente, Produit } from './types';

export function validerPack(data: {
  nom?: string;
  composants?: Pack['composants'];
  prixVente?: number;
}): string | null {
  if (!data.nom || data.nom.trim() === '') return 'Le nom est obligatoire';
  if (!data.composants || data.composants.length === 0) return 'Ajoute au moins un produit';
  if (data.prixVente === undefined || data.prixVente < 0) return 'Le prix de vente ne peut pas être négatif';
  return null;
}

export function prixAchatPack(pack: Pack, produitsMap: Map<string, Produit>): number {
  return pack.composants.reduce((sum, c) => {
    const p = produitsMap.get(c.produitId);
    return sum + (p ? p.prixAchat * c.quantite : 0);
  }, 0);
}

export function prixVenteSepares(pack: Pack, produitsMap: Map<string, Produit>): number {
  return pack.composants.reduce((sum, c) => {
    const p = produitsMap.get(c.produitId);
    return sum + (p ? p.prixVente * c.quantite : 0);
  }, 0);
}

export function creerVentePack(
  pack: Pack,
  produitsMap: Map<string, Produit>,
  credit?: { clientNom: string; clientTel?: string; montantRecu: number }
): Omit<Vente, 'id'> {
  const sumPrixAchat = prixAchatPack(pack, produitsMap);
  const now = Date.now();
  return {
    produitId: pack.id,
    produitNom: pack.nom,
    quantite: 1,
    prixVente: pack.prixVente,
    prixAchat: sumPrixAchat,
    total: pack.prixVente,
    benefice: pack.prixVente - sumPrixAchat,
    date: now,
    updatedAt: now,
    type: 'pack',
    ...(credit
      ? { modeReglement: 'credit', clientNom: credit.clientNom, clientTel: credit.clientTel, montantRecu: credit.montantRecu }
      : { modeReglement: 'comptant' }),
  };
}
