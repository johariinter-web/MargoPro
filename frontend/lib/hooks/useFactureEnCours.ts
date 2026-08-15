'use client';

import { useState } from 'react';
import { ajouterLigne, retirerLigne, totalLignes, type LigneFacture } from '../factureEnCours';

const CLE_LIGNES = 'margopro_facture_lignes';
const CLE_CLIENT = 'margopro_facture_client';

function lireLignes(): LigneFacture[] {
  if (typeof window === 'undefined') return [];
  try {
    const brut = window.localStorage.getItem(CLE_LIGNES);
    return brut ? JSON.parse(brut) : [];
  } catch {
    return [];
  }
}

function lireClient(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CLE_CLIENT) ?? '';
}

function sauvegarderLignes(lignes: LigneFacture[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CLE_LIGNES, JSON.stringify(lignes));
}

export function useFactureEnCours() {
  const [lignes, setLignesState] = useState<LigneFacture[]>(() => lireLignes());
  const [clientNom, setClientNomState] = useState<string>(() => lireClient());

  function ajouter(nom: string, quantite: number, prixUnitaire: number) {
    setLignesState((prev) => {
      const suivant = ajouterLigne(prev, nom, quantite, prixUnitaire);
      sauvegarderLignes(suivant);
      return suivant;
    });
  }

  function retirer(id: string) {
    setLignesState((prev) => {
      const suivant = retirerLigne(prev, id);
      sauvegarderLignes(suivant);
      return suivant;
    });
  }

  function setClientNom(nom: string) {
    setClientNomState(nom);
    if (typeof window !== 'undefined') window.localStorage.setItem(CLE_CLIENT, nom);
  }

  function vider() {
    setLignesState([]);
    setClientNomState('');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CLE_LIGNES);
      window.localStorage.removeItem(CLE_CLIENT);
    }
  }

  return { lignes, clientNom, setClientNom, ajouter, retirer, vider, total: totalLignes(lignes) };
}
