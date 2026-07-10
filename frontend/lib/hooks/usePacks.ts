'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerPack } from '@backend/packs';
import { requestSync } from '../syncController';
import type { Pack } from '@backend/types';

export function usePacks() {
  const packs = useLiveQuery(
    () => db.packs.orderBy('nom').filter((p) => !p.deleted).toArray()
  ) ?? [];

  async function ajouterPack(
    data: Omit<Pack, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> {
    const erreur = validerPack(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.packs.add({
      ...data,
      id: genId(),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });
    requestSync();
    return null;
  }

  async function modifierPack(
    id: string,
    data: Partial<Omit<Pack, 'id' | 'createdAt'>>
  ): Promise<string | null> {
    const erreur = validerPack(data);
    if (erreur) return erreur;
    await db.packs.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerPack(id: string) {
    await db.packs.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  return { packs, ajouterPack, modifierPack, supprimerPack };
}
