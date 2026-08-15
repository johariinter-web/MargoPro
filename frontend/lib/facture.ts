import type { LigneFacture } from './factureEnCours';

export interface DonneesFacture {
  nomBoutique: string;
  clientNom: string;
  lignes: LigneFacture[];
  total: number;
  date: number;
  symbole: string;
}

function fmtF(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Dessine une facture simple sur un canvas et retourne l'image en JPEG.
 *  Pas de test unitaire pour cette fonction : Canvas n'existe pas dans
 *  l'environnement de test (node) ni dans jsdom de façon fonctionnelle --
 *  même limite déjà acceptée pour partagerProduit()/partagerCatalogue()
 *  dans frontend/app/marges/page.tsx. Vérifiée par build + test manuel. */
function espacer(texte: string): string {
  return texte.toUpperCase().split('').join(' ');
}

function ligneHorizontale(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, couleur: string) {
  ctx.strokeStyle = couleur;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function rectArrondi(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Dessine une facture sur un canvas et retourne l'image en JPEG.
 *  Pas de test unitaire pour cette fonction : Canvas n'existe pas dans
 *  l'environnement de test (node) ni dans jsdom de façon fonctionnelle --
 *  même limite déjà acceptée pour partagerProduit()/partagerCatalogue()
 *  dans frontend/app/marges/page.tsx. Vérifiée par build + test manuel. */
export async function genererImageFacture(d: DonneesFacture): Promise<Blob> {
  const VERT = '#059669';
  const VERT_FONCE = '#047857';
  const VERT_CLAIR = '#ECFDF5';
  const TEXTE = '#1C1811';
  const MUTED = '#78716C';
  const BORDURE = '#E7E5E4';

  const W = 600, pad = 36;
  const bandeH = 8;
  const colQteX = W * 0.66;
  const ligneH = 30;

  const labelY = bandeH + 34;
  const nomY = labelY + 32;
  const metaY = nomY + 26;
  const dividerY1 = metaY + 18;
  const colHeadY = dividerY1 + 24;
  const itemsStartY = colHeadY + 20;
  const itemsEndY = itemsStartY + d.lignes.length * ligneH - ligneH + 4;
  const dividerY2 = itemsEndY + 12;
  const totalBoxY = dividerY2 + 18;
  const totalBoxH = 56;
  const totalBoxBottom = totalBoxY + totalBoxH;
  const footerDividerY = totalBoxBottom + 26;
  const footerTextY = footerDividerY + 24;
  const H = footerTextY + 22;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = VERT;
  ctx.fillRect(0, 0, W, bandeH);

  ctx.textAlign = 'left';
  ctx.font = '700 11px sans-serif';
  ctx.fillStyle = VERT;
  ctx.fillText(espacer('Facture'), pad, labelY);

  ctx.font = '800 26px sans-serif';
  ctx.fillStyle = TEXTE;
  ctx.fillText(d.nomBoutique, pad, nomY);

  ctx.font = '500 13px sans-serif';
  ctx.fillStyle = MUTED;
  const dateStr = new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.textAlign = 'left';
  ctx.fillText(dateStr, pad, metaY);
  if (d.clientNom) {
    ctx.textAlign = 'right';
    ctx.fillText(`Client : ${d.clientNom}`, W - pad, metaY);
  }

  ligneHorizontale(ctx, pad, W - pad, dividerY1, BORDURE);

  ctx.font = '700 10px sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  ctx.fillText(espacer('Article'), pad, colHeadY);
  ctx.textAlign = 'center';
  ctx.fillText(espacer('Qté'), colQteX, colHeadY);
  ctx.textAlign = 'right';
  ctx.fillText(espacer('Montant'), W - pad, colHeadY);

  let y = itemsStartY;
  ctx.font = '600 15px sans-serif';
  for (const ligne of d.lignes) {
    ctx.fillStyle = TEXTE;
    ctx.textAlign = 'left';
    ctx.fillText(ligne.nom, pad, y);
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'center';
    ctx.fillText(`x${ligne.quantite}`, colQteX, y);
    ctx.fillStyle = TEXTE;
    ctx.textAlign = 'right';
    ctx.fillText(`${fmtF(ligne.total)} ${d.symbole}`, W - pad, y);
    y += ligneH;
  }

  ligneHorizontale(ctx, pad, W - pad, dividerY2, BORDURE);

  ctx.fillStyle = VERT_CLAIR;
  rectArrondi(ctx, pad, totalBoxY, W - pad * 2, totalBoxH, 10);
  ctx.fill();

  ctx.font = '700 15px sans-serif';
  ctx.fillStyle = VERT_FONCE;
  ctx.textAlign = 'left';
  ctx.fillText('Total', pad + 20, totalBoxY + totalBoxH / 2 + 5);
  ctx.font = '800 22px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${fmtF(d.total)} ${d.symbole}`, W - pad - 20, totalBoxY + totalBoxH / 2 + 7);

  ligneHorizontale(ctx, pad, W - pad, footerDividerY, BORDURE);
  ctx.font = '500 11px sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText('Facture générée avec MargoPro', W / 2, footerTextY);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.92));
  if (!blob) throw new Error("Échec de génération de l'image");
  return blob;
}
