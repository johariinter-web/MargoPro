import type { Perte } from './types';

export function validerPerte(quantite: number, stockDisponible: number): string | null {
  if (!quantite || quantite <= 0) return 'La quantité doit être supérieure à 0';
  if (quantite > stockDisponible) return 'Quantité perdue supérieure au stock disponible';
  return null;
}

function debutMois(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function debutMoisSuivant(now: number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
}

export function pertesDuMois(pertes: Perte[], now: number = Date.now()): Perte[] {
  const debut = debutMois(now);
  const finExclusive = debutMoisSuivant(now);
  return pertes.filter((p) => p.date >= debut && p.date < finExclusive);
}

export function valeurPerte(perte: Perte): number {
  return perte.prixAchat * perte.quantite;
}

export function totalPertes(pertes: Perte[]): number {
  return pertes.reduce((sum, p) => sum + valeurPerte(p), 0);
}
