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
    await db.config.put({ id: 'singleton', ...data, updatedAt: Date.now() });
    requestSync();
  }

  return { config, saveConfig, isReady };
}
