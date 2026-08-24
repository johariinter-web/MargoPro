import { describe, it, expect } from 'vitest';
import { creerVente, meilleursProduits } from '../ventes';
import type { Vente } from '../types';

function venteTest(overrides: Partial<Vente>): Vente {
  return {
    id: 'v' + Math.random(),
    produitId: 'p1',
    produitNom: 'Savon',
    quantite: 1,
    prixVente: 1000,
    prixAchat: 500,
    total: 1000,
    benefice: 500,
    date: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('creerVente', () => {
  it('reste en comptant sans client quand rien n\'est fourni (comportement existant)', () => {
    const vente = creerVente('p1', 'Savon', 2, 1000, 500);
    expect(vente.modeReglement).toBe('comptant');
    expect(vente.clientNom).toBeUndefined();
  });

  it('reste un crédit quand credit est fourni, même si client est aussi fourni', () => {
    const vente = creerVente('p1', 'Savon', 1, 1000, 500,
      { clientNom: 'Amira', montantRecu: 0 },
      { nom: 'Ignoré', tel: 'Ignoré' }
    );
    expect(vente.modeReglement).toBe('credit');
    expect(vente.clientNom).toBe('Amira');
  });

  it('enregistre un client sur une vente comptant quand client est fourni sans credit', () => {
    const vente = creerVente('p1', 'Savon', 1, 1000, 500, undefined, { nom: 'Amira', tel: '90000000' });
    expect(vente.modeReglement).toBe('comptant');
    expect(vente.clientNom).toBe('Amira');
    expect(vente.clientTel).toBe('90000000');
  });

  it('accepte un client sans téléphone', () => {
    const vente = creerVente('p1', 'Savon', 1, 1000, 500, undefined, { nom: 'Amira' });
    expect(vente.clientNom).toBe('Amira');
    expect(vente.clientTel).toBeUndefined();
  });
});

describe('meilleursProduits', () => {
  it('additionne quantite, chiffre d\'affaires et benefice pour le meme produit', () => {
    const ventes = [
      venteTest({ produitId: 'p1', produitNom: 'Savon', quantite: 2, total: 2000, benefice: 1000 }),
      venteTest({ produitId: 'p1', produitNom: 'Savon', quantite: 3, total: 3000, benefice: 1500 }),
    ];
    const resultat = meilleursProduits(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].quantiteVendue).toBe(5);
    expect(resultat[0].chiffreAffaires).toBe(5000);
    expect(resultat[0].benefice).toBe(2500);
  });

  it('separe les produits differents', () => {
    const ventes = [
      venteTest({ produitId: 'p1', produitNom: 'Savon', quantite: 1 }),
      venteTest({ produitId: 'p2', produitNom: 'Riz', quantite: 1 }),
    ];
    expect(meilleursProduits(ventes)).toHaveLength(2);
  });

  it('trie par quantite vendue decroissante par defaut', () => {
    const ventes = [
      venteTest({ produitId: 'p1', produitNom: 'Peu vendu', quantite: 1 }),
      venteTest({ produitId: 'p2', produitNom: 'Beaucoup vendu', quantite: 10 }),
    ];
    const resultat = meilleursProduits(ventes);
    expect(resultat[0].nom).toBe('Beaucoup vendu');
  });

  it('un produit qui se vend peu peut avoir plus de benefice qu\'un produit qui se vend beaucoup', () => {
    const ventes = [
      venteTest({ produitId: 'p1', produitNom: 'Marge fine, gros volume', quantite: 100, benefice: 100 }),
      venteTest({ produitId: 'p2', produitNom: 'Marge grasse, petit volume', quantite: 1, benefice: 5000 }),
    ];
    const resultat = meilleursProduits(ventes);
    // trie par quantite : le gros volume arrive en premier...
    expect(resultat[0].nom).toBe('Marge fine, gros volume');
    // ...mais son benefice reste bien inferieur au produit a faible volume
    const grosVolume = resultat.find(p => p.nom === 'Marge fine, gros volume')!;
    const petitVolume = resultat.find(p => p.nom === 'Marge grasse, petit volume')!;
    expect(petitVolume.benefice).toBeGreaterThan(grosVolume.benefice);
  });

  it('retourne un tableau vide pour aucune vente', () => {
    expect(meilleursProduits([])).toEqual([]);
  });
});
