// Calcul du prix de vente et de la rentabilité réelle d'un produit e-commerce,
// en tenant compte des frais cachés (transport, douane, change, plateforme, retours, pub)
// et du prix constaté sur le marché.

export type PlateformeVente = 'amazon-fba' | 'shopify' | 'marketplace' | 'site-propre' | 'autre';

export interface PresetPlateforme {
  label: string;
  commissionPct: number;
  fraisFixe: number;
  fraisTraitementPct: number;
}

export const PRESETS_PLATEFORME: Record<PlateformeVente, PresetPlateforme> = {
  'amazon-fba': { label: 'Amazon FBA', commissionPct: 15, fraisFixe: 3, fraisTraitementPct: 0 },
  'shopify': { label: 'Shopify (paiement en ligne)', commissionPct: 0, fraisFixe: 0.3, fraisTraitementPct: 2.9 },
  'marketplace': { label: 'Marketplace (Etsy, eBay...)', commissionPct: 10, fraisFixe: 0.25, fraisTraitementPct: 3 },
  'site-propre': { label: 'Site perso / vente directe', commissionPct: 0, fraisFixe: 0, fraisTraitementPct: 2 },
  'autre': { label: 'Autre / manuel', commissionPct: 0, fraisFixe: 0, fraisTraitementPct: 0 },
};

export const SEUILS_RENTABILITE = {
  margeAvantPubDefaut: 30,
  margeApresPubMin: 20,
  margeApresPubCible: 25,
  roiAcceptable: 60,
  roiCible: 100,
};

export interface RentabiliteExportInput {
  coutProduit: number;
  tauxChange: number;
  margeSecuriteChangePct: number;
  fraisTransportUnitaire: number;
  droitsDouanePct: number;
  tvaAchatPct: number;
  fraisCachesFixe: number;
  tauxRetourPct: number;
  commissionPlateformePct: number;
  fraisFixePlateforme: number;
  fraisTraitementPaiementPct: number;
  margeCibleAvantPubPct: number;
  budgetPubPct: number;
  tvaVentePct: number;
}

export interface DecompositionPrix {
  prixVenteHT: number;
  prixVenteTTC: number;
  fraisPlateformeMontant: number;
  fraisPubMontant: number;
  margeAvantPubMontant: number;
  margeAvantPubPct: number;
  margeApresPubMontant: number;
  margeApresPubPct: number;
  roiPct: number;
}

export interface RentabiliteExportResultat extends DecompositionPrix {
  coutRevientBase: number;
  coutRevientAjusteRetours: number;
  possible: boolean;
}

// Coût de revient unitaire (converti, frais d'import inclus), avant provision pour les retours.
export function coutRevientBase(input: RentabiliteExportInput): number {
  const coutConverti = input.coutProduit * input.tauxChange * (1 + input.margeSecuriteChangePct / 100);
  const douane = coutConverti * (input.droitsDouanePct / 100);
  const tvaImport = coutConverti * (input.tvaAchatPct / 100);
  return coutConverti + douane + tvaImport + input.fraisTransportUnitaire + input.fraisCachesFixe;
}

// Coût de revient ajusté : chaque vente "porte" le coût des unités perdues/retournées.
export function coutRevientAjusteRetours(coutBase: number, tauxRetourPct: number): number {
  if (tauxRetourPct >= 100) return Infinity;
  return coutBase / (1 - tauxRetourPct / 100);
}

// Décompose un prix de vente HT donné en frais, marge et ROI (sert au calcul direct et à la simulation marché).
function decomposerPrix(input: RentabiliteExportInput, coutAjuste: number, prixVenteHT: number): DecompositionPrix {
  const fraisPlateformeMontant = prixVenteHT * (input.commissionPlateformePct + input.fraisTraitementPaiementPct) / 100 + input.fraisFixePlateforme;
  const fraisPubMontant = prixVenteHT * input.budgetPubPct / 100;
  const margeAvantPubMontant = prixVenteHT - coutAjuste - fraisPlateformeMontant;
  const margeApresPubMontant = margeAvantPubMontant - fraisPubMontant;
  const investissement = coutAjuste + fraisPlateformeMontant + fraisPubMontant;
  return {
    prixVenteHT,
    prixVenteTTC: prixVenteHT * (1 + input.tvaVentePct / 100),
    fraisPlateformeMontant,
    fraisPubMontant,
    margeAvantPubMontant,
    margeAvantPubPct: prixVenteHT > 0 ? (margeAvantPubMontant / prixVenteHT) * 100 : 0,
    margeApresPubMontant,
    margeApresPubPct: prixVenteHT > 0 ? (margeApresPubMontant / prixVenteHT) * 100 : 0,
    roiPct: investissement > 0 ? (margeApresPubMontant / investissement) * 100 : 0,
  };
}

// Calcule le prix de vente conseillé pour atteindre la marge cible avant pub, tous frais en % inclus.
export function calculerRentabiliteExport(input: RentabiliteExportInput): RentabiliteExportResultat {
  const coutBase = coutRevientBase(input);
  const coutAjuste = coutRevientAjusteRetours(coutBase, input.tauxRetourPct);
  const denominateur = 1 - (input.margeCibleAvantPubPct + input.commissionPlateformePct + input.fraisTraitementPaiementPct) / 100;

  if (!isFinite(coutAjuste) || denominateur <= 0) {
    return {
      coutRevientBase: coutBase,
      coutRevientAjusteRetours: coutAjuste,
      possible: false,
      prixVenteHT: 0, prixVenteTTC: 0, fraisPlateformeMontant: 0, fraisPubMontant: 0,
      margeAvantPubMontant: 0, margeAvantPubPct: 0, margeApresPubMontant: 0, margeApresPubPct: 0, roiPct: 0,
    };
  }

  const prixVenteHT = (coutAjuste + input.fraisFixePlateforme) / denominateur;
  const decomposition = decomposerPrix(input, coutAjuste, prixVenteHT);

  return { coutRevientBase: coutBase, coutRevientAjusteRetours: coutAjuste, possible: true, ...decomposition };
}

// Simule la rentabilité réelle si on vend au prix constaté sur le marché (TTC) plutôt qu'au prix calculé.
export function simulerMargeAuPrixMarche(input: RentabiliteExportInput, prixMarcheTTC: number): DecompositionPrix {
  const coutBase = coutRevientBase(input);
  const coutAjuste = coutRevientAjusteRetours(coutBase, input.tauxRetourPct);
  const prixVenteHT = prixMarcheTTC / (1 + input.tvaVentePct / 100);
  return decomposerPrix(input, coutAjuste, prixVenteHT);
}

export type PositionMarche = 'sous_le_marche' | 'aligne' | 'trop_cher';

export function comparerAuMarche(prixVenteTTC: number, prixMarcheMin: number, prixMarcheMax: number): { position: PositionMarche; ecartPctVsMoyenne: number } {
  const moyenne = (prixMarcheMin + prixMarcheMax) / 2;
  const ecartPctVsMoyenne = moyenne > 0 ? ((prixVenteTTC - moyenne) / moyenne) * 100 : 0;
  let position: PositionMarche = 'aligne';
  if (prixVenteTTC > prixMarcheMax) position = 'trop_cher';
  else if (prixVenteTTC < prixMarcheMin) position = 'sous_le_marche';
  return { position, ecartPctVsMoyenne };
}
