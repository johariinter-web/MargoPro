import { describe, it, expect } from 'vitest';
import { validerPerte, pertesDuMois, valeurPerte, totalPertes } from '../pertes';
import type { Perte } from '../types';

function creerPerte(overrides: Partial<Perte> = {}): Perte {
  const now = Date.now();
  return {
    id: 'p1',
    produitId: 'prod1',
    produitNom: 'Savon',
    quantite: 2,
    prixAchat: 500,
    date: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('validerPerte', () => {
  it('refuse une quantité à 0', () => {
    expect(validerPerte(0, 10)).toBe('La quantité doit être supérieure à 0');
  });

  it('refuse une quantité négative', () => {
    expect(validerPerte(-1, 10)).toBe('La quantité doit être supérieure à 0');
  });

  it('refuse une quantité supérieure au stock disponible', () => {
    expect(validerPerte(11, 10)).toBe('Quantité perdue supérieure au stock disponible');
  });

  it('accepte une quantité égale au stock disponible', () => {
    expect(validerPerte(10, 10)).toBeNull();
  });

  it('accepte une quantité valide inférieure au stock', () => {
    expect(validerPerte(3, 10)).toBeNull();
  });
});

describe('pertesDuMois', () => {
  it('ne garde que les pertes du mois calendaire en cours', () => {
    const now = new Date(2026, 8, 15).getTime(); // 15 septembre 2026
    const cetteMois = creerPerte({ id: 'p1', date: new Date(2026, 8, 1).getTime() });
    const cetteMoisAussi = creerPerte({ id: 'p2', date: now });
    const moisDernier = creerPerte({ id: 'p3', date: new Date(2026, 7, 31).getTime() });
    const moisProchain = creerPerte({ id: 'p4', date: new Date(2026, 9, 1).getTime() });
    expect(pertesDuMois([cetteMois, cetteMoisAussi, moisDernier, moisProchain], now)).toEqual([cetteMois, cetteMoisAussi]);
  });
});

describe('valeurPerte', () => {
  it('multiplie le prix d\'achat par la quantité', () => {
    expect(valeurPerte(creerPerte({ prixAchat: 500, quantite: 3 }))).toBe(1500);
  });
});

describe('totalPertes', () => {
  it('additionne la valeur de chaque perte', () => {
    const pertes = [
      creerPerte({ prixAchat: 500, quantite: 2 }),  // 1000
      creerPerte({ prixAchat: 1000, quantite: 1 }), // 1000
    ];
    expect(totalPertes(pertes)).toBe(2000);
  });

  it('retourne 0 pour une liste vide', () => {
    expect(totalPertes([])).toBe(0);
  });
});
