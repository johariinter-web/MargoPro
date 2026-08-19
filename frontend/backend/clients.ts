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
 *  sans nom de client. Trié du plus dépensier au moins dépensier. */
export function clientsFideles(ventes: Vente[]): ClientFidele[] {
  const parCle = new Map<string, ClientFidele>();
  const phoneToKey = new Map<string, string>(); // Maps phone → the key used
  const nameToKey = new Map<string, string>();   // Maps normalized name → the key used

  for (const v of ventes) {
    if (v.deleted || !v.clientNom?.trim()) continue;
    const nom = v.clientNom.trim();
    const tel = v.clientTel?.trim() || undefined;
    const nomNormalized = nom.toLowerCase();

    // Determine the key: prefer existing key if we've seen this phone or name before
    let cle: string;

    if (tel && phoneToKey.has(tel)) {
      // Already seen this phone
      cle = phoneToKey.get(tel)!;
    } else if (nameToKey.has(nomNormalized)) {
      // Already seen this name
      cle = nameToKey.get(nomNormalized)!;
    } else if (tel) {
      // New phone - use as key
      cle = tel;
      phoneToKey.set(tel, cle);
    } else {
      // New name - use normalized name as key
      cle = nomNormalized;
      nameToKey.set(nomNormalized, cle);
    }

    const existant = parCle.get(cle);
    if (existant) {
      existant.nombreAchats += 1;
      existant.totalDepense += v.total;
      existant.dernierAchat = Math.max(existant.dernierAchat, v.date);
      if (!existant.tel && tel) {
        existant.tel = tel;
        phoneToKey.set(tel, cle);
      }
    } else {
      parCle.set(cle, { nom, tel, nombreAchats: 1, totalDepense: v.total, dernierAchat: v.date });
      if (tel) {
        phoneToKey.set(tel, cle);
      }
      nameToKey.set(nomNormalized, cle);
    }
  }

  return Array.from(parCle.values()).sort((a, b) => b.totalDepense - a.totalDepense);
}
