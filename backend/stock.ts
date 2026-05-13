import type { Produit } from './types';

export function estStockBas(produit: Produit): boolean {
  return produit.quantite <= produit.seuilAlerte;
}

export function alertesStockBas(produits: Produit[]): Produit[] {
  return produits.filter(estStockBas);
}

export function validerProduit(data: Partial<Produit>): string | null {
  if (!data.nom || data.nom.trim() === '') return 'Le nom est obligatoire';
  if (data.quantite === undefined || data.quantite < 0) return 'La quantité ne peut pas être négative';
  if (data.prixAchat === undefined || data.prixAchat < 0) return "Le prix d'achat ne peut pas être négatif";
  if (data.prixVente === undefined || data.prixVente < 0) return 'Le prix de vente ne peut pas être négatif';
  return null;
}

export function appliquerVente(produit: Produit, quantiteVendue: number): Produit {
  return {
    ...produit,
    quantite: Math.max(0, produit.quantite - quantiteVendue),
    updatedAt: Date.now(),
  };
}

export function stockTotal(produits: Produit[]): number {
  return produits.reduce((sum, p) => sum + p.quantite, 0);
}
