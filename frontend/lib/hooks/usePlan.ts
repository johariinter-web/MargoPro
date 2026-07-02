'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../db';
import { requestSync } from '../syncController';

export type PlanStatus = 'premium' | 'trial' | 'warning' | 'expired';

export interface PlanInfo {
  status: PlanStatus;
  daysRemaining: number;   // 0 si expiré ou premium
  isPremium: boolean;
  activeProductCount: number;
  canAddProduct: boolean;
}

const TRIAL_DAYS = 30;
const WARNING_DAYS = 7;

export function computePlanStatus(
  trialStart: number | undefined,
  isPremium: boolean,
  activeProductCount: number,
  now: number = Date.now()
): PlanInfo {
  if (isPremium) {
    return { status: 'premium', daysRemaining: 0, isPremium: true, activeProductCount, canAddProduct: true };
  }

  if (trialStart === undefined) {
    return { status: 'trial', daysRemaining: TRIAL_DAYS, isPremium: false, activeProductCount, canAddProduct: true };
  }

  const elapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, TRIAL_DAYS - elapsed);

  let status: PlanStatus;
  if (remaining === 0) status = 'expired';
  else if (remaining <= WARNING_DAYS) status = 'warning';
  else status = 'trial';

  const canAddProduct = status !== 'expired' || activeProductCount < 5;

  return { status, daysRemaining: remaining, isPremium: false, activeProductCount, canAddProduct };
}

export function usePlan(): PlanInfo {
  const result = useLiveQuery(async () => {
    const config = await db.config.get('singleton');
    const activeProductCount = await db.produits
      .filter(p => !p.deleted && !p.archived)
      .count();
    return computePlanStatus(
      config?.trialStart,
      config?.isPremium ?? false,
      activeProductCount
    );
  });

  // Désarchiver tous les produits dès que l'utilisateur passe au Premium
  useEffect(() => {
    if (!result?.isPremium) return;
    const now = Date.now();
    db.produits
      .filter(p => !!p.archived)
      .modify({ archived: false, updatedAt: now })
      .then(() => requestSync());
  }, [result?.isPremium]);

  return result ?? {
    status: 'trial',
    daysRemaining: TRIAL_DAYS,
    isPremium: false,
    activeProductCount: 0,
    canAddProduct: true,
  };
}
