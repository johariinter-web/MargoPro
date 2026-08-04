import { describe, it, expect } from 'vitest';
import { isPublicPath } from '../authGate';

describe('isPublicPath', () => {
  it('autorise /auth', () => {
    expect(isPublicPath('/auth')).toBe(true);
  });

  it('autorise les sous-pages de /auth', () => {
    expect(isPublicPath('/auth/nouveau-mot-de-passe')).toBe(true);
  });

  it('autorise /cgu', () => {
    expect(isPublicPath('/cgu')).toBe(true);
  });

  it('bloque la racine', () => {
    expect(isPublicPath('/')).toBe(false);
  });

  it('bloque /onboarding', () => {
    expect(isPublicPath('/onboarding')).toBe(false);
  });

  it('bloque /stock', () => {
    expect(isPublicPath('/stock')).toBe(false);
  });

  it('ne fait pas de faux positif sur un prefixe partiel', () => {
    expect(isPublicPath('/cguelquechose')).toBe(false);
    expect(isPublicPath('/authentification')).toBe(false);
  });

  it('bloque les sous-pages de /cgu (correspondance exacte seulement)', () => {
    expect(isPublicPath('/cgu/mentions-legales')).toBe(false);
  });

  it('autorise le webhook FedaPay', () => {
    expect(isPublicPath('/api/webhooks/fedapay')).toBe(true);
  });

  it('ne rend pas publiques les autres routes API', () => {
    expect(isPublicPath('/api/paiement/creer')).toBe(false);
    expect(isPublicPath('/api/webhooksfoo')).toBe(false);
  });
});
