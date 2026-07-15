import { describe, it, expect } from 'vitest';
import {
  validerFournisseur,
  validerCommande,
  dateLivraisonPrevue,
  estEnRetard,
  commandesEnRetard,
  fournisseurAUneCommandeEnRetard,
} from '../fournisseurs';
import type { Commande } from '../types';

const JOUR_MS = 24 * 60 * 60 * 1000;

function creerCommande(overrides: Partial<Commande> = {}): Commande {
  const now = Date.now();
  return {
    id: 'c1',
    fournisseurId: 'f1',
    dateCommande: now,
    delaiJours: 7,
    montant: 100000,
    recue: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('validerFournisseur', () => {
  it('refuse un nom vide', () => {
    expect(validerFournisseur({ nom: '' })).toBe('Le nom est obligatoire');
  });

  it('refuse un nom absent', () => {
    expect(validerFournisseur({})).toBe('Le nom est obligatoire');
  });

  it('accepte un nom valide sans aucun autre champ', () => {
    expect(validerFournisseur({ nom: 'Grossiste Koné' })).toBeNull();
  });
});

describe('validerCommande', () => {
  it('refuse un fournisseurId absent', () => {
    expect(validerCommande({ dateCommande: Date.now(), delaiJours: 7, montant: 100 })).toBe('Fournisseur introuvable');
  });

  it('refuse un délai négatif', () => {
    expect(validerCommande({ fournisseurId: 'f1', dateCommande: Date.now(), delaiJours: -1, montant: 100 })).toBe('Le délai de livraison ne peut pas être négatif');
  });

  it('refuse un montant négatif', () => {
    expect(validerCommande({ fournisseurId: 'f1', dateCommande: Date.now(), delaiJours: 7, montant: -1 })).toBe('Le montant ne peut pas être négatif');
  });

  it('accepte une commande valide', () => {
    expect(validerCommande({ fournisseurId: 'f1', dateCommande: Date.now(), delaiJours: 7, montant: 100000 })).toBeNull();
  });
});

describe('dateLivraisonPrevue', () => {
  it('ajoute le délai en jours à la date de commande', () => {
    const base = new Date('2026-07-01T00:00:00Z').getTime();
    const commande = creerCommande({ dateCommande: base, delaiJours: 7 });
    expect(dateLivraisonPrevue(commande)).toBe(base + 7 * JOUR_MS);
  });

  it('gère un délai de 0 jour (livraison le jour même)', () => {
    const base = new Date('2026-07-01T00:00:00Z').getTime();
    const commande = creerCommande({ dateCommande: base, delaiJours: 0 });
    expect(dateLivraisonPrevue(commande)).toBe(base);
  });
});

describe('estEnRetard', () => {
  it("n'est pas en retard si la date prévue n'est pas encore passée", () => {
    const now = Date.now();
    const commande = creerCommande({ dateCommande: now, delaiJours: 7 });
    expect(estEnRetard(commande, now)).toBe(false);
  });

  it('est en retard si la date prévue est dépassée et pas reçue', () => {
    const now = Date.now();
    const commande = creerCommande({ dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: false });
    expect(estEnRetard(commande, now)).toBe(true);
  });

  it("n'est jamais en retard si déjà marquée reçue", () => {
    const now = Date.now();
    const commande = creerCommande({ dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: true });
    expect(estEnRetard(commande, now)).toBe(false);
  });
});

describe('commandesEnRetard', () => {
  it('filtre uniquement les commandes en retard, pas les autres', () => {
    const now = Date.now();
    const enRetard = creerCommande({ id: 'c1', dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: false });
    const aTemps = creerCommande({ id: 'c2', dateCommande: now, delaiJours: 7, recue: false });
    const recue = creerCommande({ id: 'c3', dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: true });
    expect(commandesEnRetard([enRetard, aTemps, recue], now)).toEqual([enRetard]);
  });
});

describe('fournisseurAUneCommandeEnRetard', () => {
  it('détecte une commande en retard pour le bon fournisseur uniquement', () => {
    const now = Date.now();
    const enRetard = creerCommande({ id: 'c1', fournisseurId: 'f1', dateCommande: now - 10 * JOUR_MS, delaiJours: 7, recue: false });
    expect(fournisseurAUneCommandeEnRetard([enRetard], 'f1', now)).toBe(true);
    expect(fournisseurAUneCommandeEnRetard([enRetard], 'f2', now)).toBe(false);
  });
});
