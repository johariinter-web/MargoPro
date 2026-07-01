export interface Produit {
  id: string;
  nom: string;
  quantite: number;
  prixAchat: number;
  prixVente: number;
  seuilAlerte: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  archived?: boolean;      // true = masqué mais non supprimé
  codeBarres?: string;
  categorie?: string;
  tailleConditionnement?: number;
  photo?: string;
  photoPath?: string | null;
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
  updatedAt?: number;
  deleted?: boolean;
}

export interface Config {
  id: 'singleton';
  nomCommerce: string;
  devise: string;
  symboleDevise: string;
  onboardingComplete: boolean;
  trialStart?: number;     // timestamp ms du premier produit ajouté
  isPremium?: boolean;     // true = plan Premium actif
  dateAbonnement?: number;
  updatedAt?: number;
}

export type Periode = 'jour' | 'semaine' | 'mois' | 'tout';

export interface StatsPeriode {
  chiffreAffaires: number;
  benefice: number;
  nombreVentes: number;
  periode: Periode;
}
