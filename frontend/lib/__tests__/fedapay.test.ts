import { describe, it, expect } from 'vitest';
import { buildTransactionPayload, PRIX_PREMIUM_FCFA } from '../fedapay';

describe('PRIX_PREMIUM_FCFA', () => {
  it('vaut 3500', () => {
    expect(PRIX_PREMIUM_FCFA).toBe(3500);
  });
});

describe('buildTransactionPayload', () => {
  it('construit le payload avec le bon montant, la bonne devise et la metadata utilisateur', () => {
    const payload = buildTransactionPayload('user-abc-123', 'https://margopro.eidma.co/abonnement?paiement=retour');
    expect(payload.amount).toBe(3500);
    expect(payload.currency).toEqual({ iso: 'XOF' });
    expect(payload.callback_url).toBe('https://margopro.eidma.co/abonnement?paiement=retour');
    expect(payload.custom_metadata).toEqual({ supabase_user_id: 'user-abc-123' });
    expect(payload.description).toContain('MargoPro');
  });
});
