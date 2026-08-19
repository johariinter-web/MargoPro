import { describe, it, expect } from 'vitest';
import { creerVente } from '../ventes';

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
