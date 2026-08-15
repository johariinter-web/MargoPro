export interface LigneFacture {
  id: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

export function ajouterLigne(
  lignes: LigneFacture[],
  nom: string,
  quantite: number,
  prixUnitaire: number
): LigneFacture[] {
  const ligne: LigneFacture = {
    id: crypto.randomUUID(),
    nom,
    quantite,
    prixUnitaire,
    total: quantite * prixUnitaire,
  };
  return [...lignes, ligne];
}

export function retirerLigne(lignes: LigneFacture[], id: string): LigneFacture[] {
  return lignes.filter((l) => l.id !== id);
}

export function totalLignes(lignes: LigneFacture[]): number {
  return lignes.reduce((s, l) => s + l.total, 0);
}
