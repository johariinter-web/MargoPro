'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import { validerDepense } from '@backend/depenses';
import { requestSync } from '../syncController';
import type { Depense } from '@backend/types';

export function useDepenses() {
  const depenses = useLiveQuery(
    () => db.depenses.orderBy('date').reverse().filter((d) => !d.deleted).toArray()
  ) ?? [];

  async function ajouterDepense(
    data: Omit<Depense, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> {
    const erreur = validerDepense(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.depenses.add({ ...data, id: genId(), createdAt: now, updatedAt: now, deleted: false });
    requestSync();
    return null;
  }

  async function modifierDepense(
    id: string,
    data: Partial<Omit<Depense, 'id' | 'createdAt'>>
  ): Promise<string | null> {
    const erreur = validerDepense(data);
    if (erreur) return erreur;
    await db.depenses.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerDepense(id: string) {
    await db.depenses.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  return { depenses, ajouterDepense, modifierDepense, supprimerDepense };
}
