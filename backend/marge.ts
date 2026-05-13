export function calculerMarge(prixAchat: number, prixVente: number): {
  margePercent: number;
  margeMontant: number;
} {
  if (prixAchat <= 0) return { margePercent: 0, margeMontant: 0 };
  const margeMontant = prixVente - prixAchat;
  const margePercent = (margeMontant / prixAchat) * 100;
  return { margePercent: Math.round(margePercent * 10) / 10, margeMontant };
}

export function calculerPrixVente(prixAchat: number, margePercent: number): number {
  return Math.round(prixAchat * (1 + margePercent / 100));
}

export function calculerPrixAchat(prixVente: number, margePercent: number): number {
  if (margePercent >= 100) return 0;
  return Math.round(prixVente / (1 + margePercent / 100));
}
