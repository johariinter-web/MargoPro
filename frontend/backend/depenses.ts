import type { Depense } from './types';

export function validerDepense(data: Partial<Depense>): string | null {
  if (!data.nom || data.nom.trim() === '') return 'Le nom est obligatoire';
  if (data.montant === undefined || data.montant <= 0) return 'Le montant doit être supérieur à 0';
  if (data.date === undefined) return 'La date est obligatoire';
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

export function depensesDuMois(depenses: Depense[], now: number = Date.now()): Depense[] {
  const debut = debutMois(now);
  const finExclusive = debutMoisSuivant(now);
  return depenses.filter((d) => d.date >= debut && d.date < finExclusive);
}

export function totalDepenses(depenses: Depense[]): number {
  return depenses.reduce((sum, d) => sum + d.montant, 0);
}

export function joursRestantsDansLeMois(now: number = Date.now()): number {
  const d = new Date(now);
  const dernierJour = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(1, dernierJour - d.getDate());
}

export function margePlancher(chargesDuMois: number, caDuMois: number): number | null {
  if (caDuMois <= 0 || chargesDuMois <= 0) return null;
  return Math.round((chargesDuMois / caDuMois) * 1000) / 10;
}

export function coefficientDepuisPlancher(plancherPct: number): number {
  if (plancherPct >= 100) return 1000;
  return Math.round((plancherPct / (100 - plancherPct)) * 1000) / 10;
}

export interface ObjectifRentabilite {
  beneficeRestant: number;
  seuilAtteint: boolean;
  ventesParJour: number | null;
}

export function objectifVenteParJour(
  chargesDuMois: number,
  beneficeDuMois: number,
  nombreVentesDuMois: number,
  now: number = Date.now()
): ObjectifRentabilite {
  const beneficeRestant = Math.max(0, chargesDuMois - beneficeDuMois);
  if (beneficeRestant === 0) {
    return { beneficeRestant: 0, seuilAtteint: true, ventesParJour: null };
  }
  if (nombreVentesDuMois === 0) {
    return { beneficeRestant, seuilAtteint: false, ventesParJour: null };
  }
  const beneficeMoyenParVente = beneficeDuMois / nombreVentesDuMois;
  if (beneficeMoyenParVente <= 0) {
    return { beneficeRestant, seuilAtteint: false, ventesParJour: null };
  }
  const ventesRestantes = beneficeRestant / beneficeMoyenParVente;
  const jours = joursRestantsDansLeMois(now);
  return { beneficeRestant, seuilAtteint: false, ventesParJour: Math.ceil(ventesRestantes / jours) };
}
