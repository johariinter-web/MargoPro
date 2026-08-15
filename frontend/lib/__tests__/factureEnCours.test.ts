import { describe, it, expect } from 'vitest';
import { ajouterLigne, retirerLigne, totalLignes, type LigneFacture } from '../factureEnCours';

describe('ajouterLigne', () => {
  it('ajoute une ligne avec un id unique et le bon total', () => {
    const lignes = ajouterLigne([], 'Savon', 2, 500);
    expect(lignes).toHaveLength(1);
    expect(lignes[0].nom).toBe('Savon');
    expect(lignes[0].quantite).toBe(2);
    expect(lignes[0].prixUnitaire).toBe(500);
    expect(lignes[0].total).toBe(1000);
    expect(lignes[0].id).toBeTruthy();
  });

  it('ajoute à la suite des lignes existantes sans les modifier', () => {
    const depart: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 }];
    const lignes = ajouterLigne(depart, 'Huile', 1, 700);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toEqual(depart[0]);
    expect(lignes[1].nom).toBe('Huile');
  });
});

describe('retirerLigne', () => {
  it('retire uniquement la ligne avec cet id', () => {
    const depart: LigneFacture[] = [
      { id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 },
      { id: 'b', nom: 'Huile', quantite: 1, prixUnitaire: 700, total: 700 },
    ];
    const lignes = retirerLigne(depart, 'a');
    expect(lignes).toHaveLength(1);
    expect(lignes[0].id).toBe('b');
  });

  it("ne fait rien si l'id n'existe pas", () => {
    const depart: LigneFacture[] = [{ id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 }];
    const lignes = retirerLigne(depart, 'inconnu');
    expect(lignes).toEqual(depart);
  });
});

describe('totalLignes', () => {
  it('additionne le total de toutes les lignes', () => {
    const lignes: LigneFacture[] = [
      { id: 'a', nom: 'Riz', quantite: 1, prixUnitaire: 300, total: 300 },
      { id: 'b', nom: 'Huile', quantite: 2, prixUnitaire: 700, total: 1400 },
    ];
    expect(totalLignes(lignes)).toBe(1700);
  });

  it('retourne 0 pour un panier vide', () => {
    expect(totalLignes([])).toBe(0);
  });
});
