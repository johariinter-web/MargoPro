import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { creerTransactionAbonnement } from '@/lib/fedapay';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const callbackUrl = new URL('/abonnement?paiement=retour', request.url).toString();

  try {
    const { url } = await creerTransactionAbonnement(user.id, callbackUrl);
    return NextResponse.json({ url });
  } catch (err) {
    // Ne jamais logger l'objet d'erreur complet : le SDK fedapay y attache
    // la requete HTTP d'origine, en-tete Authorization (cle secrete
    // FEDAPAY_SECRET_KEY) inclus. Seul err.message est sur a logger.
    console.error('[paiement creer] echec creation transaction pour', user.id, ':', err instanceof Error ? err.message : 'erreur inconnue');
    return NextResponse.json({ error: "Erreur lors de la création du paiement" }, { status: 500 });
  }
}
