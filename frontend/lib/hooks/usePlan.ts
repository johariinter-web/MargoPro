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
  accesFonctionnalitesPremium: boolean;  // faux uniquement si l'essai est expire et pas Premium
  isLoading?: boolean;     // true pendant que Dexie charge (< 100ms)
}

const TRIAL_DAYS_ESSAI_EN_COURS = 30;
const TRIAL_DAYS_NOUVEAU_COMPTE = 15;
// Comptes deja en essai au moment de ce changement (2026-08-09) : gardent leurs
// 30 jours d'origine, pas raccourcis en cours de route. Nouveaux comptes a
// partir de ce moment : 15 jours.
const CHANGEMENT_DUREE_ESSAI = new Date('2026-08-09T20:52:36Z').getTime();
const WARNING_DAYS = 7;

export function computePlanStatus(
  trialStart: number | undefined,
  isPremium: boolean,
  activeProductCount: number,
  now: number = Date.now(),
  premiumExpiresAt?: number
): PlanInfo {
  const premiumActif = isPremium && (premiumExpiresAt === undefined || premiumExpiresAt > now);

  if (premiumActif) {
    return { status: 'premium', daysRemaining: 0, isPremium: true, activeProductCount, canAddProduct: true, accesFonctionnalitesPremium: true };
  }

  if (trialStart === undefined) {
    return { status: 'trial', daysRemaining: TRIAL_DAYS_NOUVEAU_COMPTE, isPremium: false, activeProductCount, canAddProduct: true, accesFonctionnalitesPremium: true };
  }

  // Comptes deja en essai avant le changement du 2026-08-09 : gardent leurs
  // 30 jours d'origine (grandfathering, pas raccourci en cours de route).
  // Nouveaux comptes : 15 jours, pour tout le monde (le "essai 30 jours si
  // arrive via le lien Pro" a ete retire le 2026-08-14 -- retardait
  // inutilement le signal de conversion, y compris pour les affilies qui
  // attendent de savoir si leur filleul va s'abonner).
  const dureeEssai = trialStart < CHANGEMENT_DUREE_ESSAI ? TRIAL_DAYS_ESSAI_EN_COURS : TRIAL_DAYS_NOUVEAU_COMPTE;
  const elapsed = Math.floor((now - trialStart) / (1000 * 60 * 60 * 24));
  const remaining = Math.max(0, dureeEssai - elapsed);

  let status: PlanStatus;
  if (remaining === 0) status = 'expired';
  else if (remaining <= WARNING_DAYS) status = 'warning';
  else status = 'trial';

  const canAddProduct = status !== 'expired' || activeProductCount < 5;
  const accesFonctionnalitesPremium = status !== 'expired';

  return { status, daysRemaining: remaining, isPremium: false, activeProductCount, canAddProduct, accesFonctionnalitesPremium };
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
      activeProductCount,
      Date.now(),
      config?.premiumExpiresAt
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
    daysRemaining: TRIAL_DAYS_NOUVEAU_COMPTE,
    isPremium: false,
    activeProductCount: 0,
    canAddProduct: true,
    accesFonctionnalitesPremium: true,
    isLoading: true,
  };
}
