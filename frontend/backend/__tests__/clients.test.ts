import { describe, it, expect } from 'vitest';
import { clientsFideles } from '../clients';
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

describe('clientsFideles', () => {
  it('regroupe deux ventes du même client (même nom exact)', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', total: 1000, date: 1000 }),
      venteTest({ clientNom: 'Amira', total: 2000, date: 2000 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].nombreAchats).toBe(2);
    expect(resultat[0].totalDepense).toBe(3000);
  });

  it('regroupe par téléphone même si la casse du nom diffère', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: '90000000', total: 1000 }),
      venteTest({ clientNom: 'amira', clientTel: '90000000', total: 500 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].totalDepense).toBe(1500);
  });

  it('regroupe par nom normalisé (espaces/casse) quand il n\'y a pas de téléphone', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', total: 1000 }),
      venteTest({ clientNom: '  amira  ', total: 500 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].nombreAchats).toBe(2);
  });

  it('ignore les ventes sans nom de client', () => {
    const ventes = [venteTest({ clientNom: undefined })];
    expect(clientsFideles(ventes)).toHaveLength(0);
  });

  it('ignore les ventes supprimées', () => {
    const ventes = [venteTest({ clientNom: 'Amira', deleted: true })];
    expect(clientsFideles(ventes)).toHaveLength(0);
  });

  it('garde le téléphone dès qu\'une des ventes le fournit', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: undefined }),
      venteTest({ clientNom: 'Amira', clientTel: '90000000' }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat[0].tel).toBe('90000000');
  });

  it('garde la date la plus récente comme dernier achat', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', date: 2000 }),
      venteTest({ clientNom: 'Amira', date: 5000 }),
      venteTest({ clientNom: 'Amira', date: 1000 }),
    ];
    expect(clientsFideles(ventes)[0].dernierAchat).toBe(5000);
  });

  it('trie du plus dépensier au moins dépensier', () => {
    const ventes = [
      venteTest({ clientNom: 'Petit', total: 500 }),
      venteTest({ clientNom: 'Gros', total: 5000 }),
      venteTest({ clientNom: 'Moyen', total: 2000 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat.map(c => c.nom)).toEqual(['Gros', 'Moyen', 'Petit']);
  });

  it('retourne un tableau vide pour aucune vente', () => {
    expect(clientsFideles([])).toEqual([]);
  });
});
