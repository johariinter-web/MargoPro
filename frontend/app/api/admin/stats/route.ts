import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

// Compte unique de Juanita, seule personne autorisée à voir cet écran.
// App mono-propriétaire : pas de table de permissions, un id en dur suffit.
const ADMIN_USER_ID = 'bee33ee0-c3cd-46d8-83c2-c42f0ea617cb';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }
  if (user.id !== ADMIN_USER_ID) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const service = createServiceClient();

  const [{ data: authUsers }, { data: configs }, { data: produits }, { data: ventes }] = await Promise.all([
    service.auth.admin.listUsers({ perPage: 1000 }),
    service.from('config').select('user_id, nom_commerce, is_premium, premium_expires_at, trial_start, date_abonnement'),
    service.from('produits').select('user_id').eq('deleted', false),
    service.from('ventes').select('user_id').eq('deleted', false),
  ]);

  const emailParId = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? '']));
  const createdAtParId = new Map((authUsers?.users ?? []).map((u) => [u.id, u.created_at]));

  const compterParId = (lignes: { user_id: string }[] | null) => {
    const compte = new Map<string, number>();
    for (const ligne of lignes ?? []) {
      compte.set(ligne.user_id, (compte.get(ligne.user_id) ?? 0) + 1);
    }
    return compte;
  };
  const nbProduits = compterParId(produits);
  const nbVentes = compterParId(ventes);

  const comptes = (configs ?? []).map((c) => ({
    userId: c.user_id,
    nomCommerce: c.nom_commerce ?? '(sans nom)',
    email: emailParId.get(c.user_id) ?? '',
    inscritLe: c.date_abonnement ?? (createdAtParId.get(c.user_id) ? new Date(createdAtParId.get(c.user_id)!).getTime() : null),
    isPremium: c.is_premium,
    premiumExpiresAt: c.premium_expires_at,
    trialStart: c.trial_start,
    nbProduits: nbProduits.get(c.user_id) ?? 0,
    nbVentes: nbVentes.get(c.user_id) ?? 0,
  }));

  comptes.sort((a, b) => (b.inscritLe ?? 0) - (a.inscritLe ?? 0));

  return NextResponse.json({ comptes });
}
