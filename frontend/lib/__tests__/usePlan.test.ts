import { describe, it, expect } from 'vitest';
import { computePlanStatus } from '../hooks/usePlan';

const DAY = 24 * 60 * 60 * 1000;

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
    expect(r.daysRemaining).toBe(30);
  });

  it('retourne trial si 22 jours écoulés (8 restants)', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 22 * DAY, false, 3, now);
    expect(r.status).toBe('trial');
    expect(r.daysRemaining).toBe(8);
  });

  it('retourne warning si exactement 7 jours restants', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 23 * DAY, false, 2, now);
    expect(r.status).toBe('warning');
    expect(r.daysRemaining).toBe(7);
  });

  it('retourne warning si 1 jour restant', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 29 * DAY, false, 4, now);
    expect(r.status).toBe('warning');
    expect(r.daysRemaining).toBe(1);
  });

  it('retourne expired si 30 jours dépassés', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 8, now);
    expect(r.status).toBe('expired');
    expect(r.daysRemaining).toBe(0);
  });

  it('canAddProduct = false si expiré et exactement 5 produits actifs', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 5, now);
    expect(r.canAddProduct).toBe(false);
  });

  it('canAddProduct = false si expiré et plus de 5 produits actifs', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 12, now);
    expect(r.canAddProduct).toBe(false);
  });

  it('canAddProduct = true si expiré mais seulement 4 produits actifs', () => {
    const now = Date.now();
    const r = computePlanStatus(now - 31 * DAY, false, 4, now);
    expect(r.canAddProduct).toBe(true);
  });
});
