import { describe, it, expect } from 'vitest';
import { ajouterLigne, retirerLigne, totalLignes, lignesDuJour, type LigneFacture } from '../factureEnCours';

describe('ajouterLigne', () => {
  it('ajoute une ligne avec un id unique, la bonne date et le bon total', () => {
    const maintenant = new Date('2026-08-14T10:00:00Z').getTime();
    const lignes = ajouterLigne([], 'Savon', 2, 500, maintenant);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].nom).toBe('Savon');
    expect(lignes[0].quantite).toBe(2);
    expect(lignes[0].prixUnitaire).toBe(500);
    expect(lignes[0].total).toBe(1000);
    expect(lignes[0].id).toBeTruthy();
    expect(lignes[0].date).toBe(maintenant);
  });

  it('ajoute à la suite des lignes existantes sans les modifier', () => {
    const depart: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300, date: 1000 }];
    const lignes = ajouterLigne(depart, 'Huile', 1, 700, 2000);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toEqual(depart[0]);
    expect(lignes[1].nom).toBe('Huile');
  });

  it('utilise Date.now() par défaut si aucune date fournie', () => {
    const avant = Date.now();
    const lignes = ajouterLigne([], 'Riz', 1, 300);
    const apres = Date.now();
    expect(lignes[0].date).toBeGreaterThanOrEqual(avant);
    expect(lignes[0].date).toBeLessThanOrEqual(apres);
  });
});

describe('retirerLigne', () => {
  it('retire uniquement la ligne avec cet id', () => {
    const depart: LigneFacture[] = [
      { id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300, date: 1000 },
      { id: 'b', nom: 'Huile', quantite: 1, prixUnitaire: 700, total: 700, date: 1000 },
    ];
    const lignes = retirerLigne(depart, 'a');
    expect(lignes).toHaveLength(1);
    expect(lignes[0].id).toBe('b');
  });

  it("ne fait rien si l'id n'existe pas", () => {
    const depart: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300, date: 1000 }];
    const lignes = retirerLigne(depart, 'inconnu');
    expect(lignes).toEqual(depart);
  });
});

describe('totalLignes', () => {
  it('additionne le total de toutes les lignes', () => {
    const lignes: LigneFacture[] = [
      { id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300, date: 1000 },
      { id: 'b', nom: 'Huile', quantite: 2, prixUnitaire: 700, total: 1400, date: 1000 },
    ];
    expect(totalLignes(lignes)).toBe(1700);
  });

  it('retourne 0 pour un panier vide', () => {
    expect(totalLignes([])).toBe(0);
  });
});

describe('lignesDuJour', () => {
  it("garde une ligne ajoutée plus tôt le même jour", () => {
    const maintenant = new Date('2026-08-14T18:00:00').getTime();
    const cematin = new Date('2026-08-14T08:00:00').getTime();
    const lignes: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300, date: cematin }];
    expect(lignesDuJour(lignes, maintenant)).toHaveLength(1);
  });

  it("retire une ligne ajoutée la veille", () => {
    const maintenant = new Date('2026-08-14T08:00:00').getTime();
    const hier = new Date('2026-08-13T20:00:00').getTime();
    const lignes: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300, date: hier }];
    expect(lignesDuJour(lignes, maintenant)).toHaveLength(0);
  });

  it('retourne un tableau vide pour un panier vide', () => {
    expect(lignesDuJour([])).toEqual([]);
  });
});
