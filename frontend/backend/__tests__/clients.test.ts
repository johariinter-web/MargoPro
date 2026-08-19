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

  it('garde le même téléphone quand il est fourni sur chaque vente du client', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: '90000000', total: 1000 }),
      venteTest({ clientNom: 'Amira', clientTel: '90000000', total: 500 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].tel).toBe('90000000');
  });

  it('ne fusionne jamais deux clients de même nom mais avec des téléphones différents', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: '111', total: 1000 }),
      venteTest({ clientNom: 'Amira', clientTel: '222', total: 5000 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(2);
    const tels = resultat.map(c => c.tel).sort();
    expect(tels).toEqual(['111', '222']);
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

  it('fusionne une vente à crédit (avec téléphone) et une vente comptant du même client (sans téléphone)', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: '77123456', total: 2000, modeReglement: 'credit' }),
      venteTest({ clientNom: 'Amira', clientTel: undefined, total: 1000, modeReglement: 'comptant' }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].nombreAchats).toBe(2);
    expect(resultat[0].totalDepense).toBe(3000);
    expect(resultat[0].tel).toBe('77123456');
  });

  it('ne devine pas à qui rattacher une vente sans téléphone quand le nom a déjà 2 téléphones différents', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: '111', total: 1000 }),
      venteTest({ clientNom: 'Amira', clientTel: '222', total: 1000 }),
      venteTest({ clientNom: 'Amira', clientTel: undefined, total: 500 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(3);
  });

  it('regroupe le même téléphone écrit avec ou sans espaces', () => {
    const ventes = [
      venteTest({ clientNom: 'Amira', clientTel: '77 123 45 67', total: 1000 }),
      venteTest({ clientNom: 'Amira', clientTel: '771234567', total: 500 }),
    ];
    const resultat = clientsFideles(ventes);
    expect(resultat).toHaveLength(1);
    expect(resultat[0].totalDepense).toBe(1500);
    expect(resultat[0].tel).toBe('77 123 45 67');
  });
});
