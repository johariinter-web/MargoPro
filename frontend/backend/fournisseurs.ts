import type { Fournisseur, Commande } from './types';

const JOUR_MS = 24 * 60 * 60 * 1000;

export function validerFournisseur(data: Partial<Fournisseur>): string | null {
  if (!data.nom || data.nom.trim() === '') return 'Le nom est obligatoire';
  return null;
}

export function validerCommande(data: Partial<Commande>): string | null {
  if (!data.fournisseurId) return 'Fournisseur introuvable';
  if (data.dateCommande === undefined) return 'La date de commande est obligatoire';
  if (data.delaiJours === undefined || data.delaiJours < 0) return 'Le délai de livraison ne peut pas être négatif';
  if (data.montant === undefined || data.montant < 0) return 'Le montant ne peut pas être négatif';
  return null;
}

export function dateLivraisonPrevue(commande: Commande): number {
  return commande.dateCommande + commande.delaiJours * JOUR_MS;
}

export function estEnRetard(commande: Commande, now: number = Date.now()): boolean {
  return !commande.recue && now > dateLivraisonPrevue(commande);
}

export function commandesEnRetard(commandes: Commande[], now: number = Date.now()): Commande[] {
  return commandes.filter((c) => estEnRetard(c, now));
}

export function fournisseurAUneCommandeEnRetard(
  commandes: Commande[],
  fournisseurId: string,
  now: number = Date.now()
): boolean {
  return commandes.some((c) => c.fournisseurId === fournisseurId && estEnRetard(c, now));
}
