export interface Produit {
  id: string;
  nom: string;
  quantite: number;
  prixAchat: number;
  prixVente: number;
  seuilAlerte: number;
  createdAt: number;
  updatedAt: number;
}

export interface Vente {
  id: string;
  produitId: string;
  produitNom: string;
  quantite: number;
  prixVente: number;
  prixAchat: number;
  total: number;
  benefice: number;
  date: number;
}

export interface Config {
  id: 'singleton';
  nomCommerce: string;
  devise: string;
  symboleDevise: string;
  onboardingComplete: boolean;
}

export type Periode = 'jour' | 'semaine' | 'mois' | 'tout';

export interface StatsPeriode {
  chiffreAffaires: number;
  benefice: number;
  nombreVentes: number;
  periode: Periode;
}
