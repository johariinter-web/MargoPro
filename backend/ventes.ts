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
  prixAchat: number
): Omit<Vente, 'id'> {
  const total = prixVente * quantite;
  const benefice = (prixVente - prixAchat) * quantite;
  return {
    produitId,
    produitNom,
    quantite,
    prixVente,
    prixAchat,
    total,
    benefice,
    date: Date.now(),
  };
}
