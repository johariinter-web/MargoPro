export interface Produit {
  id: string;
  nom: string;
  quantite: number;
  prixAchat: number;
  prixVente: number;
  seuilAlerte: number;
  codeBarres?: string;
  categorie?: string;
  tailleConditionnement?: number;
  photo?: string;       // base64 local, pour l'affichage hors-ligne
  photoPath?: string | null; // chemin Supabase Storage ; null = à synchroniser
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  archived?: boolean;   // true = masqué mais non supprimé
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
  updatedAt: number;
  deleted?: boolean;
  modeReglement?: 'comptant' | 'credit';
  clientNom?: string;
  clientTel?: string;
  montantRecu?: number;
  type?: 'produit' | 'pack';
}

export interface Pack {
  id: string;
  nom: string;
  composants: Array<{ produitId: string; produitNom: string; quantite: number }>;
  prixVente: number;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Config {
  id: 'singleton';
  nomCommerce: string;
  devise: string;
  symboleDevise: string;
  onboardingComplete: boolean;
  trialStart?: number;  // timestamp ms du premier produit ajouté
  isPremium?: boolean;  // true = plan Premium actif
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
