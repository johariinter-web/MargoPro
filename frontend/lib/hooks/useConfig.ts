'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { requestSync } from '../syncController';
import type { Config } from '@backend/types';

export function useConfig() {
  // Wrap result in an object so we can distinguish "loading" (undefined) from "no config" (null)
  const result = useLiveQuery(async () => {
    const c = await db.config.get('singleton');
    return { data: c ?? null };
  });

  const isReady = result !== undefined;
  const config = result?.data ?? null;

  async function saveConfig(data: Omit<Config, 'id'>) {
    // Fusionne avec la config locale existante (ex: isPremium, premiumExpiresAt,
    // trialStart) au lieu de l'ecraser : un appelant qui ne passe que
    // nomCommerce/devise (Parametres, Onboarding) ne doit jamais effacer les
    // champs geres ailleurs (statut Premium recu par synchro cloud).
    const existant = await db.config.get('singleton');
    await db.config.put({ ...existant, id: 'singleton', ...data, updatedAt: Date.now() });
    requestSync();
  }

  return { config, saveConfig, isReady };
}
