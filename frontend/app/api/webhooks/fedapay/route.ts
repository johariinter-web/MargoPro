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
  } catch {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  // Ne jamais faire confiance au statut transmis dans l'evenement recu :
  // revenir a l'API FedaPay pour lire le vrai statut, comme recommande
  // par FedaPay elle-meme (une personne malveillante pourrait sinon
  // forger une requete pretendant qu'un paiement a reussi).
  const transactionId = event.entity?.id;
  if (typeof transactionId !== 'number') {
    return NextResponse.json({ error: 'Evenement sans id de transaction' }, { status: 400 });
  }

  let status: string;
  let userId: string | undefined;
  try {
    ({ status, userId } = await verifierTransaction(transactionId));
  } catch {
    // Panne reseau, erreur FedaPay, transaction introuvable, etc. On repond
    // en erreur structuree (plutot que de laisser planter la route) pour que
    // FedaPay considere la livraison du webhook comme un echec et reessaie
    // plus tard.
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
    .select('user_id');

  if (error) {
    return NextResponse.json({ error: 'Echec de mise a jour Supabase' }, { status: 500 });
  }

  // Supabase ne remonte pas d'erreur sur un update a 0 ligne (ex: la ligne
  // config de l'utilisateur n'existe pas encore, course possible entre la
  // creation du compte et l'arrivee du webhook). Sans ce controle, on
  // repondrait 200 a FedaPay (qui ne reessaierait donc jamais) alors que le
  // Premium n'a jamais ete active.
  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'Aucune ligne config trouvee pour cet utilisateur' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
