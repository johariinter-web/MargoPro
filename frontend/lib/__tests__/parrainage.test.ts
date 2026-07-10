import { describe, it, expect } from 'vitest';
import { generateAffiliateCode, computeCommissionSolde, type ParrainagePaiement } from '../parrainage';

describe('generateAffiliateCode', () => {
  it('utilise les 3 premières lettres du nom en préfixe', () => {
    const code = generateAffiliateCode('Boutique Aminata');
    expect(code.startsWith('BOU-')).toBe(true);
  });

  it('ignore les accents', () => {
    const code = generateAffiliateCode('Épicerie');
    expect(code.startsWith('EPI-')).toBe(true);
  });

  it('retombe sur MGP si le nom ne contient aucune lettre', () => {
    const code = generateAffiliateCode('123');
    expect(code.startsWith('MGP-')).toBe(true);
  });

  it('complète avec X si le nom fait moins de 3 lettres', () => {
    const code = generateAffiliateCode('Ay');
    expect(code.startsWith('AYX-')).toBe(true);
  });

  it('respecte le format PREFIXE-SUFFIXE', () => {
    const code = generateAffiliateCode('Boutique Aminata');
    expect(code).toMatch(/^[A-Z]{3}-[A-Z2-9]{4}$/);
  });

  it('génère des codes différents à chaque appel', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateAffiliateCode('Test')));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('computeCommissionSolde', () => {
  it('calcule 15% du montant payé', () => {
    const solde = computeCommissionSolde([
      { parrainage_id: 'f1', mois: '2026-01', montant_paye: 3500, commission_versee: false },
    ]);
    expect(solde).toBe(525);
  });

  it('additionne plusieurs filleuls', () => {
    const solde = computeCommissionSolde([
      { parrainage_id: 'f1', mois: '2026-01', montant_paye: 3500, commission_versee: false },
      { parrainage_id: 'f2', mois: '2026-01', montant_paye: 3500, commission_versee: false },
    ]);
    expect(solde).toBe(1050);
  });

  it('ignore les commissions déjà versées', () => {
    const solde = computeCommissionSolde([
      { parrainage_id: 'f1', mois: '2026-01', montant_paye: 3500, commission_versee: true },
      { parrainage_id: 'f1', mois: '2026-02', montant_paye: 3500, commission_versee: false },
    ]);
    expect(solde).toBe(525);
  });

  it('plafonne à 12 mois par filleul', () => {
    const paiements: ParrainagePaiement[] = Array.from({ length: 13 }, (_, i) => ({
      parrainage_id: 'f1',
      mois: `2026-${String(i + 1).padStart(2, '0')}`,
      montant_paye: 1000,
      commission_versee: false,
    }));
    const solde = computeCommissionSolde(paiements);
    expect(solde).toBe(12 * 1000 * 0.15);
  });
});
