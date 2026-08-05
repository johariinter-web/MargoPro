import { FedaPay, Transaction, Webhook } from 'fedapay';

FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY!);
FedaPay.setEnvironment((process.env.FEDAPAY_ENVIRONMENT as 'sandbox' | 'live') ?? 'sandbox');

export const PRIX_PREMIUM_FCFA = 3500;

export interface TransactionPayload {
  description: string;
  amount: number;
  currency: { iso: string };
  callback_url: string;
  custom_metadata: { supabase_user_id: string };
}

/**
 * Forme de l'objet renvoyé par `Webhook.constructEvent()`.
 *
 * Confirmé par inspection de node_modules/fedapay :
 * - `Webhook.constructEvent` (src/Webhook.ts) fait juste `JSON.parse(payload)` après avoir
 *   vérifié la signature — il renvoie donc le JSON brut envoyé par FedaPay, sans wrapper.
 * - `node_modules/fedapay/test/WebhookTest.ts` (tests "stub event" / "send event") montre
 *   que le corps envoyé par FedaPay a la forme `{ name: 'transaction.create', entity: {...} }`
 *   où `entity` contient l'objet concerné (donc `entity.id` = id de la transaction).
 */
export interface FedapayEvent {
  name: string;
  entity: { id: number; [key: string]: unknown };
  [key: string]: unknown;
}

export function buildTransactionPayload(userId: string, callbackUrl: string): TransactionPayload {
  return {
    description: 'Abonnement Premium MargoPro - 1 mois',
    amount: PRIX_PREMIUM_FCFA,
    currency: { iso: 'XOF' },
    callback_url: callbackUrl,
    custom_metadata: { supabase_user_id: userId },
  };
}

export async function creerTransactionAbonnement(
  userId: string,
  callbackUrl: string
): Promise<{ transactionId: number; url: string }> {
  const transaction = await Transaction.create(buildTransactionPayload(userId, callbackUrl));
  const { url } = await transaction.generateToken();
  return { transactionId: transaction.id, url };
}

/**
 * Récupère le statut réel d'une transaction FedaPay, ainsi que l'utilisateur MargoPro
 * associé (via `custom_metadata.supabase_user_id`, envoyé à la création de la transaction).
 *
 * Note sur `custom_metadata` : le SDK (FedaPayObject.refreshFrom, dans
 * node_modules/fedapay/src/FedaPayObject.ts) recopie dynamiquement TOUS les champs renvoyés
 * par l'API sur l'objet Transaction, sans liste blanche/noire — il n'existe aucun mécanisme
 * `expand` dans le SDK (absent de tout node_modules/fedapay). Donc si l'API FedaPay renvoie
 * `custom_metadata` dans la réponse de GET /v1/transactions/:id (comme le documente la doc
 * publique FedaPay pour l'objet Transaction), il sera automatiquement exposé ici sans code
 * supplémentaire. Ce point precis (le contenu réel de la réponse API) ne peut pas être
 * vérifié à 100% depuis le seul code source du SDK — à confirmer manuellement avec de vraies
 * clés lors de l'intégration.
 */
export async function verifierTransaction(
  transactionId: number
): Promise<{ status: string; userId: string | undefined }> {
  const transaction = await Transaction.retrieve(transactionId);
  return {
    status: transaction.status,
    userId: transaction.custom_metadata?.supabase_user_id,
  };
}

export function verifierSignatureWebhook(rawBody: string, signature: string): FedapayEvent {
  return Webhook.constructEvent(
    rawBody,
    signature,
    process.env.FEDAPAY_WEBHOOK_SECRET!
  ) as FedapayEvent;
}
