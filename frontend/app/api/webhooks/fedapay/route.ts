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

  const { status, userId } = await verifierTransaction(transactionId);

  if (status !== 'approved' || !userId) {
    return NextResponse.json({ ok: true, ignore: true });
  }

  const service = createServiceClient();
  const { error } = await service
    .from('config')
    .update({
      is_premium: true,
      premium_expires_at: Date.now() + TRENTE_JOURS_MS,
      updated_at: Date.now(),
    })
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: 'Echec de mise a jour Supabase' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
