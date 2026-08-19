import type { Vente } from './types';

export interface ClientFidele {
  nom: string;
  tel?: string;
  nombreAchats: number;
  totalDepense: number;
  dernierAchat: number;
}

/** Regroupe les ventes par client (téléphone si connu, sinon nom normalisé)
 *  pour repérer les clients fidèles. Ignore les ventes supprimées et celles
 *  sans nom de client. Trié du plus dépensier au moins dépensier.
 *
 *  Le téléphone est l'identifiant prioritaire : deux ventes avec des
 *  téléphones différents sont TOUJOURS deux clients différents, même si le
 *  nom est identique (ex: deux clientes prénommées "Amira"). Sans téléphone,
 *  le nom normalisé sert de repli - moins fiable, mais mieux que rien. */
export function clientsFideles(ventes: Vente[]): ClientFidele[] {
  const parCle = new Map<string, ClientFidele>();

  for (const v of ventes) {
    if (v.deleted || !v.clientNom?.trim()) continue;
    const nom = v.clientNom.trim();
    const tel = v.clientTel?.trim() || undefined;
    const cle = tel || nom.toLowerCase();

    const existant = parCle.get(cle);
    if (existant) {
      existant.nombreAchats += 1;
      existant.totalDepense += v.total;
      existant.dernierAchat = Math.max(existant.dernierAchat, v.date);
    } else {
      parCle.set(cle, { nom, tel, nombreAchats: 1, totalDepense: v.total, dernierAchat: v.date });
    }
  }

  return Array.from(parCle.values()).sort((a, b) => b.totalDepense - a.totalDepense);
}
