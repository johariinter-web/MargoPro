import { describe, it, expect } from 'vitest';
import { computePlanStatus } from '../hooks/usePlan';

const DAY = 24 * 60 * 60 * 1000;
// Ancre avant le changement de duree d'essai (2026-08-09) : les tests qui
// s'appuient sur 30 jours restent valides indefiniment, peu importe quand
// la suite tourne vraiment.
const NOW_essai_en_cours = new Date('2026-08-05T00:00:00Z').getTime();

describe('computePlanStatus', () => {
  it('retourne premium si isPremium = true, peu importe le reste', () => {
    const r = computePlanStatus(undefined, true, 100, Date.now());
    expect(r.status).toBe('premium');
    expect(r.canAddProduct).toBe(true);
    expect(r.daysRemaining).toBe(0);
  });

  it('retourne trial si trialStart non défini (pas encore commencé)', () => {
    const r = computePlanStatus(undefined, false, 0, Date.now());
    expect(r.status).toBe('trial');
    expect(r.canAddProduct).toBe(true);
    expect(r.daysRemaining).toBe(15);
  });

  it('essai deja en cours avant le 2026-08-09 : garde 30 jours meme apres le changement', () => {
    const trialStart = new Date('2026-08-01T00:00:00Z').getTime();
    const now = new Date('2026-08-03T00:00:00Z').getTime(); // 2 jours ecoules
    const r = computePlanStatus(trialStart, false, 3, now);
    expect(r.status).toBe('trial');
    expect(r.daysRemaining).toBe(28);
  });

  it('nouveau compte apres le 2026-08-09 : 15 jours d\'essai', () => {
    const trialStart = new Date('2026-08-10T00:00:00Z').getTime();
    const now = new Date('2026-08-12T00:00:00Z').getTime(); // 2 jours ecoules
    const r = computePlanStatus(trialStart, false, 3, now);
    expect(r.status).toBe('trial');
    expect(r.daysRemaining).toBe(13);
  });

  it('nouveau compte : expire apres 15 jours, pas 30', () => {
    const trialStart = new Date('2026-08-10T00:00:00Z').getTime();
    const now = new Date('2026-08-26T00:00:00Z').getTime(); // 16 jours ecoules
    const r = computePlanStatus(trialStart, false, 8, now);
    expect(r.status).toBe('expired');
    expect(r.daysRemaining).toBe(0);
  });

  it('essaiEtendu (arrive via le lien Pro) : 30 jours meme pour un nouveau compte', () => {
    const trialStart = new Date('2026-08-10T00:00:00Z').getTime();
    const now = new Date('2026-08-26T00:00:00Z').getTime(); // 16 jours ecoules
    const r = computePlanStatus(trialStart, false, 8, now, undefined, true);
    expect(r.status).toBe('trial');
    expect(r.daysRemaining).toBe(14);
  });

  it('essaiEtendu mais trialStart pas encore defini : 30 jours annonces', () => {
    const r = computePlanStatus(undefined, false, 0, Date.now(), undefined, true);
    expect(r.status).toBe('trial');
    expect(r.daysRemaining).toBe(30);
  });

  it('essaiEtendu ignore pour un compte deja en essai avant le changement (garde 30, pas de double bonus)', () => {
    const trialStart = new Date('2026-08-01T00:00:00Z').getTime();
    const now = new Date('2026-08-03T00:00:00Z').getTime();
    const r = computePlanStatus(trialStart, false, 3, now, undefined, true);
    expect(r.daysRemaining).toBe(28);
  });

  it('retourne trial si 22 jours écoulés (8 restants)', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 22 * DAY, false, 3, now);
    expect(r.status).toBe('trial');
    expect(r.daysRemaining).toBe(8);
  });

  it('retourne warning si exactement 7 jours restants', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 23 * DAY, false, 2, now);
    expect(r.status).toBe('warning');
    expect(r.daysRemaining).toBe(7);
  });

  it('retourne warning si 1 jour restant', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 29 * DAY, false, 4, now);
    expect(r.status).toBe('warning');
    expect(r.daysRemaining).toBe(1);
  });

  it('retourne expired si 30 jours dépassés', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 31 * DAY, false, 8, now);
    expect(r.status).toBe('expired');
    expect(r.daysRemaining).toBe(0);
  });

  it('canAddProduct = false si expiré et exactement 5 produits actifs', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 31 * DAY, false, 5, now);
    expect(r.canAddProduct).toBe(false);
  });

  it('canAddProduct = false si expiré et plus de 5 produits actifs', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 31 * DAY, false, 12, now);
    expect(r.canAddProduct).toBe(false);
  });

  it('canAddProduct = true si expiré mais seulement 4 produits actifs', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 31 * DAY, false, 4, now);
    expect(r.canAddProduct).toBe(true);
  });

  it('reste premium si premiumExpiresAt est dans le futur', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(undefined, true, 2, now, now + 10 * DAY);
    expect(r.status).toBe('premium');
    expect(r.canAddProduct).toBe(true);
  });

  it('retombe sur le calcul trial/expired si premiumExpiresAt est depasse', () => {
    const now = NOW_essai_en_cours;
    // isPremium encore true localement (pas resynchronise), mais la date
    // de fin est passee : ne doit plus etre traite comme premium actif.
    const r = computePlanStatus(now - 31 * DAY, true, 8, now, now - 1 * DAY);
    expect(r.status).toBe('expired');
    expect(r.canAddProduct).toBe(false);
  });

  it('reste premium si premiumExpiresAt est absent (comportement historique)', () => {
    const r = computePlanStatus(undefined, true, 100, Date.now());
    expect(r.status).toBe('premium');
  });

  it('accesFonctionnalitesPremium = true pendant le premium actif', () => {
    const r = computePlanStatus(undefined, true, 2, Date.now());
    expect(r.accesFonctionnalitesPremium).toBe(true);
  });

  it('accesFonctionnalitesPremium = true pendant l\'essai (trialStart non defini)', () => {
    const r = computePlanStatus(undefined, false, 0, Date.now());
    expect(r.accesFonctionnalitesPremium).toBe(true);
  });

  it('accesFonctionnalitesPremium = true en warning (essai bientot termine)', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 23 * DAY, false, 2, now);
    expect(r.status).toBe('warning');
    expect(r.accesFonctionnalitesPremium).toBe(true);
  });

  it('accesFonctionnalitesPremium = false une fois l\'essai expire', () => {
    const now = NOW_essai_en_cours;
    const r = computePlanStatus(now - 31 * DAY, false, 2, now);
    expect(r.status).toBe('expired');
    expect(r.accesFonctionnalitesPremium).toBe(false);
  });
});
