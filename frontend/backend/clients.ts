import type { Vente } from './types';

export interface ClientFidele {
  nom: string;
  tel?: string;
  nombreAchats: number;
  totalDepense: number;
  dernierAchat: number;
}

function normaliserTel(tel: string): string {
  return tel.replace(/\D/g, '');
}

/** Regroupe les ventes par client (téléphone si connu, sinon nom normalisé)
 *  pour repérer les clients fidèles. Ignore les ventes supprimées et celles
 *  sans nom de client. Trié du plus dépensier au moins dépensier.
 *
 *  Le téléphone est l'identifiant prioritaire et ne se fusionne JAMAIS entre
 *  deux numéros différents, même si le nom est identique (ex: deux clientes
 *  prénommées "Amira" avec des téléphones différents restent distinctes).
 *  Mais une vente SANS téléphone rejoint le téléphone déjà connu pour ce nom
 *  quand ce nom n'a jamais été associé qu'à un seul numéro - typiquement le
 *  même client, une fois enregistré avec son téléphone (vente à crédit) et
 *  une fois sans (vente comptant rapide). Si le nom a déjà 2 téléphones
 *  différents, on ne devine pas lequel des deux c'est : la vente sans
 *  téléphone reste dans un groupe séparé, par nom. Les téléphones sont
 *  comparés par leurs chiffres seulement (espaces ignorés). */
export function clientsFideles(ventes: Vente[]): ClientFidele[] {
  const valides = ventes.filter((v): v is Vente & { clientNom: string } => !v.deleted && !!v.clientNom?.trim());

  // Passe 1 : pour chaque nom normalisé, quels téléphones (normalisés)
  // a-t-on déjà vus, et à quoi ressemblait le premier vu (pour l'affichage) ?
  const telsParNom = new Map<string, Set<string>>();
  const telAfficheParTelNorm = new Map<string, string>();
  for (const v of valides) {
    const telBrut = v.clientTel?.trim();
    if (!telBrut) continue;
    const telNorm = normaliserTel(telBrut);
    if (!telNorm) continue;
    const nomKey = v.clientNom.trim().toLowerCase();
    if (!telsParNom.has(nomKey)) telsParNom.set(nomKey, new Set());
    telsParNom.get(nomKey)!.add(telNorm);
    if (!telAfficheParTelNorm.has(telNorm)) telAfficheParTelNorm.set(telNorm, telBrut);
  }

  // Passe 2 : regroupement proprement dit.
  const parCle = new Map<string, ClientFidele>();
  for (const v of valides) {
    const nom = v.clientNom.trim();
    const nomKey = nom.toLowerCase();
    const telBrut = v.clientTel?.trim();
    const telNorm = telBrut ? normaliserTel(telBrut) : undefined;
    const telsConnusPourCeNom = telsParNom.get(nomKey);

    let cle: string;
    let telNormFinal: string | undefined;
    if (telNorm) {
      cle = telNorm;
      telNormFinal = telNorm;
    } else if (telsConnusPourCeNom && telsConnusPourCeNom.size === 1) {
      telNormFinal = Array.from(telsConnusPourCeNom)[0];
      cle = telNormFinal;
    } else {
      cle = nomKey;
      telNormFinal = undefined;
    }

    const existant = parCle.get(cle);
    if (existant) {
      existant.nombreAchats += 1;
      existant.totalDepense += v.total;
      existant.dernierAchat = Math.max(existant.dernierAchat, v.date);
    } else {
      parCle.set(cle, {
        nom,
        tel: telNormFinal ? telAfficheParTelNorm.get(telNormFinal) : undefined,
        nombreAchats: 1,
        totalDepense: v.total,
        dernierAchat: v.date,
      });
    }
  }

  return Array.from(parCle.values()).sort((a, b) => b.totalDepense - a.totalDepense);
}
