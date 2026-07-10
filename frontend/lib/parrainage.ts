'use client';

const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function suffixeAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return Array.from(octets, o => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
}

export function generateAffiliateCode(nom: string): string {
  const lettres = nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const prefixe = (lettres.slice(0, 3) || 'MGP').padEnd(3, 'X');
  return `${prefixe}-${suffixeAleatoire(4)}`;
}

export interface ParrainagePaiement {
  parrainage_id: string;
  mois: string; // format 'YYYY-MM'
  montant_paye: number;
  commission_versee: boolean;
}

const TAUX_COMMISSION = 0.15;
const PLAFOND_MOIS_COMMISSION = 12;

export function computeCommissionSolde(paiements: ParrainagePaiement[]): number {
  const parFilleul = new Map<string, ParrainagePaiement[]>();
  for (const p of paiements) {
    const liste = parFilleul.get(p.parrainage_id) ?? [];
    liste.push(p);
    parFilleul.set(p.parrainage_id, liste);
  }

  let solde = 0;
  for (const liste of parFilleul.values()) {
    const douzeMoisTries = [...liste]
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .slice(0, PLAFOND_MOIS_COMMISSION);
    for (const p of douzeMoisTries) {
      if (!p.commission_versee) solde += p.montant_paye * TAUX_COMMISSION;
    }
  }
  return Math.round(solde);
}
