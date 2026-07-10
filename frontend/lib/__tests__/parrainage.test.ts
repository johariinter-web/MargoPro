import { describe, it, expect } from 'vitest';
import { generateAffiliateCode } from '../parrainage';

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
