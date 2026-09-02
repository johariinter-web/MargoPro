import { describe, it, expect } from 'vitest';
import {
  validerDepense,
  depensesDuMois,
  totalDepenses,
  joursRestantsDansLeMois,
  margePlancher,
  coefficientDepuisPlancher,
  objectifVenteParJour,
} from '../depenses';
import type { Depense } from '../types';

function creerDepense(overrides: Partial<Depense> = {}): Depense {
  const now = Date.now();
  return {
    id: 'd1',
    nom: 'Loyer',
    montant: 50000,
    date: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('validerDepense', () => {
  it('refuse un nom vide', () => {
    expect(validerDepense({ nom: '', montant: 100, date: Date.now() })).toBe('Le nom est obligatoire');
  });

  it('refuse un nom absent', () => {
    expect(validerDepense({ montant: 100, date: Date.now() })).toBe('Le nom est obligatoire');
  });

  it('refuse un montant absent', () => {
    expect(validerDepense({ nom: 'Loyer', date: Date.now() })).toBe('Le montant doit être supérieur à 0');
  });

  it('refuse un montant à 0 ou négatif', () => {
    expect(validerDepense({ nom: 'Loyer', montant: 0, date: Date.now() })).toBe('Le montant doit être supérieur à 0');
    expect(validerDepense({ nom: 'Loyer', montant: -10, date: Date.now() })).toBe('Le montant doit être supérieur à 0');
  });

  it('refuse une date absente', () => {
    expect(validerDepense({ nom: 'Loyer', montant: 100 })).toBe('La date est obligatoire');
  });

  it('accepte une dépense valide', () => {
    expect(validerDepense({ nom: 'Loyer', montant: 50000, date: Date.now() })).toBeNull();
  });
});

describe('depensesDuMois', () => {
  it('ne garde que les dépenses du mois calendaire en cours', () => {
    const now = new Date(2026, 8, 15).getTime(); // 15 septembre 2026
    const cetteMois = creerDepense({ id: 'd1', date: new Date(2026, 8, 1).getTime() });
    const cetteMoisAussi = creerDepense({ id: 'd2', date: now });
    const moisDernier = creerDepense({ id: 'd3', date: new Date(2026, 7, 31).getTime() });
    expect(depensesDuMois([cetteMois, cetteMoisAussi, moisDernier], now)).toEqual([cetteMois, cetteMoisAussi]);
  });
});

describe('totalDepenses', () => {
  it('additionne les montants', () => {
    const depenses = [creerDepense({ montant: 50000 }), creerDepense({ montant: 20000 })];
    expect(totalDepenses(depenses)).toBe(70000);
  });

  it('retourne 0 pour une liste vide', () => {
    expect(totalDepenses([])).toBe(0);
  });
});

describe('joursRestantsDansLeMois', () => {
  it('calcule les jours restants jusqu\'à la fin du mois', () => {
    const now = new Date(2026, 8, 2).getTime(); // 2 septembre 2026 (septembre = 30 jours)
    expect(joursRestantsDansLeMois(now)).toBe(28);
  });

  it('retourne au minimum 1, même le dernier jour du mois', () => {
    const now = new Date(2026, 8, 30).getTime(); // 30 septembre 2026
    expect(joursRestantsDansLeMois(now)).toBe(1);
  });
});

describe('margePlancher', () => {
  it('calcule le pourcentage de charges sur le CA', () => {
    expect(margePlancher(70000, 500000)).toBe(14);
  });

  it('retourne null si le CA du mois est à 0', () => {
    expect(margePlancher(70000, 0)).toBeNull();
  });
});

describe('coefficientDepuisPlancher', () => {
  it('convertit un plancher basé sur le prix de vente en marge basée sur le prix d\'achat', () => {
    expect(coefficientDepuisPlancher(14)).toBe(16.3);
  });

  it('plafonne à 1000 si le plancher atteint ou dépasse 100%', () => {
    expect(coefficientDepuisPlancher(100)).toBe(1000);
  });
});

describe('objectifVenteParJour', () => {
  const now = new Date(2026, 8, 2).getTime(); // 2 septembre 2026, 28 jours restants

  it('signale le seuil atteint si le bénéfice du mois couvre déjà les charges', () => {
    expect(objectifVenteParJour(50000, 60000, 40, now)).toEqual({
      beneficeRestant: 0,
      seuilAtteint: true,
      ventesParJour: null,
    });
  });

  it('retourne ventesParJour à null si aucune vente ce mois', () => {
    expect(objectifVenteParJour(50000, 0, 0, now)).toEqual({
      beneficeRestant: 50000,
      seuilAtteint: false,
      ventesParJour: null,
    });
  });

  it('retourne ventesParJour à null si le bénéfice moyen par vente est nul ou négatif', () => {
    expect(objectifVenteParJour(50000, -1000, 5, now)).toEqual({
      beneficeRestant: 51000,
      seuilAtteint: false,
      ventesParJour: null,
    });
  });

  it('calcule un objectif de ventes par jour dans le cas normal', () => {
    // charges 70000, bénéfice déjà généré 20000 (40 ventes -> 500/vente en moyenne)
    // reste à générer 50000 -> 100 ventes -> 100/28 jours -> arrondi au-dessus = 4
    expect(objectifVenteParJour(70000, 20000, 40, now)).toEqual({
      beneficeRestant: 50000,
      seuilAtteint: false,
      ventesParJour: 4,
    });
  });
});
