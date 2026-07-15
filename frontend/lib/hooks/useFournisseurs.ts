'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db, genId } from '../db';
import {
  validerFournisseur,
  validerCommande,
  commandesEnRetard,
  fournisseurAUneCommandeEnRetard,
} from '@backend/fournisseurs';
import { requestSync } from '../syncController';
import type { Fournisseur, Commande } from '@backend/types';

export function useFournisseurs() {
  const fournisseurs = useLiveQuery(
    () => db.fournisseurs.orderBy('nom').filter((f) => !f.deleted).toArray()
  ) ?? [];

  const commandes = useLiveQuery(
    () => db.commandes.orderBy('dateCommande').reverse().filter((c) => !c.deleted).toArray()
  ) ?? [];

  async function ajouterFournisseur(
    data: Omit<Fournisseur, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string | null> {
    const erreur = validerFournisseur(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.fournisseurs.add({ ...data, id: genId(), createdAt: now, updatedAt: now, deleted: false });
    requestSync();
    return null;
  }

  async function modifierFournisseur(
    id: string,
    data: Partial<Omit<Fournisseur, 'id' | 'createdAt'>>
  ): Promise<string | null> {
    const erreur = validerFournisseur(data);
    if (erreur) return erreur;
    await db.fournisseurs.update(id, { ...data, updatedAt: Date.now() });
    requestSync();
    return null;
  }

  async function supprimerFournisseur(id: string) {
    await db.fournisseurs.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  async function ajouterCommande(
    data: Omit<Commande, 'id' | 'createdAt' | 'updatedAt' | 'recue'>
  ): Promise<string | null> {
    const erreur = validerCommande(data);
    if (erreur) return erreur;
    const now = Date.now();
    await db.commandes.add({ ...data, id: genId(), recue: false, createdAt: now, updatedAt: now, deleted: false });
    requestSync();
    return null;
  }

  async function marquerCommandeRecue(id: string) {
    await db.commandes.update(id, { recue: true, updatedAt: Date.now() });
    requestSync();
  }

  async function supprimerCommande(id: string) {
    await db.commandes.update(id, { deleted: true, updatedAt: Date.now() });
    requestSync();
  }

  function commandesDuFournisseur(fournisseurId: string): Commande[] {
    return commandes.filter((c) => c.fournisseurId === fournisseurId);
  }

  function fournisseurEnRetard(fournisseurId: string): boolean {
    return fournisseurAUneCommandeEnRetard(commandes, fournisseurId);
  }

  return {
    fournisseurs,
    commandes,
    enRetard: commandesEnRetard(commandes),
    ajouterFournisseur,
    modifierFournisseur,
    supprimerFournisseur,
    ajouterCommande,
    marquerCommandeRecue,
    supprimerCommande,
    commandesDuFournisseur,
    fournisseurEnRetard,
  };
}
