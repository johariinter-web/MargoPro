export interface LigneFacture {
  id: string;
  nom: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
  date: number;
}

export function ajouterLigne(
  lignes: LigneFacture[],
  nom: string,
  quantite: number,
  prixUnitaire: number,
  date: number = Date.now()
): LigneFacture[] {
  const ligne: LigneFacture = {
    id: crypto.randomUUID(),
    nom,
    quantite,
    prixUnitaire,
    total: quantite * prixUnitaire,
    date,
  };
  return [...lignes, ligne];
}

export function retirerLigne(lignes: LigneFacture[], id: string): LigneFacture[] {
  return lignes.filter((l) => l.id !== id);
}

export function totalLignes(lignes: LigneFacture[]): number {
  return lignes.reduce((s, l) => s + l.total, 0);
}

/** Ne garde que les lignes ajoutées le même jour calendaire que `maintenant`.
 *  Évite qu'un panier oublié mélange les achats de plusieurs jours (et donc
 *  probablement de plusieurs clients) dans une seule facture. */
export function lignesDuJour(lignes: LigneFacture[], maintenant: number = Date.now()): LigneFacture[] {
  const debutJour = new Date(maintenant);
  debutJour.setHours(0, 0, 0, 0);
  return lignes.filter((l) => l.date >= debutJour.getTime());
}
