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
export async function genererImageFacture(d: DonneesFacture): Promise<Blob> {
  const W = 600, pad = 30;
  const ligneH = 32;
  const headerH = 140;
  const totalH = 70;
  const H = headerH + d.lignes.length * ligneH + totalH + pad;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non disponible');

  ctx.fillStyle = '#FAF7F3';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1C1811';
  ctx.font = '800 28px sans-serif';
  ctx.fillText(d.nomBoutique, pad, 46);

  ctx.font = '600 14px sans-serif';
  ctx.fillStyle = '#6A5D52';
  const dateStr = new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(dateStr, pad, 70);
  if (d.clientNom) ctx.fillText(`Client : ${d.clientNom}`, pad, 92);

  ctx.strokeStyle = '#E6DDD3';
  ctx.beginPath();
  ctx.moveTo(pad, headerH - 20);
  ctx.lineTo(W - pad, headerH - 20);
  ctx.stroke();

  let y = headerH;
  ctx.font = '600 15px sans-serif';
  for (const ligne of d.lignes) {
    ctx.fillStyle = '#1C1811';
    ctx.textAlign = 'left';
    ctx.fillText(`${ligne.nom} x${ligne.quantite}`, pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(`${fmtF(ligne.total)} ${d.symbole}`, W - pad, y);
    ctx.textAlign = 'left';
    y += ligneH;
  }

  ctx.strokeStyle = '#E6DDD3';
  ctx.beginPath();
  ctx.moveTo(pad, y + 10);
  ctx.lineTo(W - pad, y + 10);
  ctx.stroke();

  ctx.font = '800 22px sans-serif';
  ctx.fillStyle = '#D4601A';
  ctx.textAlign = 'left';
  ctx.fillText('Total', pad, y + 44);
  ctx.textAlign = 'right';
  ctx.fillText(`${fmtF(d.total)} ${d.symbole}`, W - pad, y + 44);

  const blob: Blob | null = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/jpeg', 0.9));
  if (!blob) throw new Error("Échec de génération de l'image");
  return blob;
}
