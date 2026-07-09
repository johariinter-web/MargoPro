import type { Vente, Periode, StatsPeriode } from './types';

function debutPeriode(periode: Periode): number {
  const now = new Date();
  switch (periode) {
    case 'jour': {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return d.getTime();
    }
    case 'semaine': {
      const day = now.getDay() || 7;
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
      return d.getTime();
    }
    case 'mois': {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return d.getTime();
    }
    case 'tout':
      return 0;
  }
}

export function filtrerParPeriode(ventes: Vente[], periode: Periode): Vente[] {
  if (periode === 'tout') return ventes;
  const debut = debutPeriode(periode);
  return ventes.filter((v) => v.date >= debut);
}

export function calculerStats(ventes: Vente[], periode: Periode): StatsPeriode {
  const filtered = filtrerParPeriode(ventes, periode);
  return {
    chiffreAffaires: filtered.reduce((sum, v) => sum + v.total, 0),
    benefice: filtered.reduce((sum, v) => sum + v.benefice, 0),
    nombreVentes: filtered.length,
    periode,
  };
}

export function topProduits(ventes: Vente[], n: number = 3): Array<{ nom: string; total: number; quantite: number }> {
  const map = new Map<string, { nom: string; total: number; quantite: number }>();
  for (const v of ventes) {
    const existing = map.get(v.produitId) ?? { nom: v.produitNom, total: 0, quantite: 0 };
    map.set(v.produitId, {
      nom: v.produitNom,
      total: existing.total + v.total,
      quantite: existing.quantite + v.quantite,
    });
  }
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

export function creerVente(
  produitId: string,
  produitNom: string,
  quantite: number,
  prixVente: number,
  prixAchat: number,
  credit?: { clientNom: string; clientTel?: string; montantRecu: number }
): Omit<Vente, 'id'> {
  const total = prixVente * quantite;
  const benefice = (prixVente - prixAchat) * quantite;
  const now = Date.now();
  return {
    produitId,
    produitNom,
    quantite,
    prixVente,
    prixAchat,
    total,
    benefice,
    date: now,
    updatedAt: now,
    ...(credit
      ? { modeReglement: 'credit', clientNom: credit.clientNom, clientTel: credit.clientTel, montantRecu: credit.montantRecu }
      : { modeReglement: 'comptant' }),
  };
}

export function resteADoit(vente: Vente): number {
  return Math.max(0, vente.total - (vente.montantRecu ?? 0));
}

export function urgenceCredit(vente: Vente): 'normal' | 'moyen' | 'urgent' {
  const jours = Math.floor((Date.now() - vente.date) / (1000 * 60 * 60 * 24));
  if (jours >= 15) return 'urgent';
  if (jours >= 7) return 'moyen';
  return 'normal';
}

export function creditsEnCours(ventes: Vente[]): Vente[] {
  return ventes.filter(v => v.modeReglement === 'credit' && resteADoit(v) > 0);
}

export function totalCredit(ventes: Vente[]): number {
  return creditsEnCours(ventes).reduce((sum, v) => sum + resteADoit(v), 0);
}

export function creditsSoldes(ventes: Vente[]): Vente[] {
  return ventes.filter(v => v.modeReglement === 'credit' && resteADoit(v) === 0);
}
