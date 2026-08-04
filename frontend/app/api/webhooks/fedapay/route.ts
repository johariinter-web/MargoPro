import { NextResponse, type NextRequest } from 'next/server';
import { verifierSignatureWebhook, verifierTransaction } from '@/lib/fedapay';
import { createServiceClient } from '@/lib/supabase/service';

const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-fedapay-signature') ?? '';

  let event;
  try {
    event = verifierSignatureWebhook(rawBody, signature);
  } catch (err) {
    // Ne jamais logger l'erreur brute ici : elle peut contenir des
    // fragments du corps de la requete. On ne garde que le message.
    console.error('[webhook fedapay] signature invalide :', err instanceof Error ? err.message : 'erreur inconnue');
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  // Ne jamais faire confiance au statut transmis dans l'evenement recu :
  // revenir a l'API FedaPay pour lire le vrai statut, comme recommande
  // par FedaPay elle-meme (une personne malveillante pourrait sinon
  // forger une requete pretendant qu'un paiement a reussi).
  const rawId = event.entity?.id;
  const transactionId = typeof rawId === 'string' ? Number(rawId) : rawId;
  if (typeof transactionId !== 'number' || !Number.isFinite(transactionId)) {
    console.error('[webhook fedapay] evenement sans id de transaction valide :', event?.name);
    return NextResponse.json({ error: 'Evenement sans id de transaction valide' }, { status: 400 });
  }

  let status: string;
  let userId: string | undefined;
  try {
    ({ status, userId } = await verifierTransaction(transactionId));
  } catch (err) {
    // Panne reseau, erreur FedaPay, transaction introuvable, etc. On repond
    // en erreur structuree (plutot que de laisser planter la route) pour que
    // FedaPay considere la livraison du webhook comme un echec et reessaie
    // plus tard.
    // Attention : ne jamais logger l'objet d'erreur complet (err) - le SDK
    // fedapay y attache la requete HTTP d'origine, en-tete Authorization
    // (cle secrete FEDAPAY_SECRET_KEY) inclus. Seul err.message est sur.
    console.error('[webhook fedapay] echec verifierTransaction pour', transactionId, ':', err instanceof Error ? err.message : 'erreur inconnue');
    return NextResponse.json({ error: 'Echec de verification de la transaction' }, { status: 500 });
  }

  if (status !== 'approved' || !userId) {
    return NextResponse.json({ ok: true, ignore: true });
  }

  const service = createServiceClient();
  const { data, error } = await service
    .from('config')
    .update({
      is_premium: true,
      premium_expires_at: Date.now() + TRENTE_JOURS_MS,
      updated_at: Date.now(),
    })
    .eq('user_id', userId)
    .select('user_id, is_premium, premium_expires_at');

  if (error) {
    console.error('[webhook fedapay] echec mise a jour Supabase pour', userId, ':', error.message);
    return NextResponse.json({ error: 'Echec de mise a jour Supabase' }, { status: 500 });
  }

  // Supabase ne remonte pas d'erreur sur un update a 0 ligne (ex: la ligne
  // config de l'utilisateur n'existe pas encore, course possible entre la
  // creation du compte et l'arrivee du webhook). Sans ce controle, on
  // repondrait 200 a FedaPay (qui ne reessaierait donc jamais) alors que le
  // Premium n'a jamais ete active.
  const ligne = data?.[0];
  if (!ligne) {
    console.error('[webhook fedapay] aucune ligne config trouvee pour', userId, '(transaction', transactionId, ')');
    return NextResponse.json({ error: 'Aucune ligne config trouvee pour cet utilisateur' }, { status: 500 });
  }

  // Le trigger Postgres config_proteger_premium peut silencieusement
  // reverter is_premium/premium_expires_at a leur ancienne valeur si sa
  // condition de reconnaissance de la cle service_role ne correspond pas
  // (voir migration 2026-08-02). La ligne serait alors bien affectee (1
  // ligne, pas d'erreur), mais Premium n'aurait jamais ete accorde. On
  // verifie donc explicitement la valeur retournee avant de repondre 200 a
  // FedaPay, pour ne jamais masquer un paiement reussi qui n'active rien.
  if (ligne.is_premium !== true) {
    console.error('[webhook fedapay] is_premium non active apres update pour', userId, '(transaction', transactionId, ') - trigger Postgres probablement en cause');
    return NextResponse.json({ error: "L'activation Premium n'a pas ete confirmee" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
