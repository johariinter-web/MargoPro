'use client';

import { useEffect, useState } from 'react';
import { ajouterLigne, retirerLigne, totalLignes, lignesDuJour, type LigneFacture } from '../factureEnCours';

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
  try {
    return window.localStorage.getItem(CLE_CLIENT) ?? '';
  } catch {
    return '';
  }
}

function sauvegarderLignes(lignes: LigneFacture[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLE_LIGNES, JSON.stringify(lignes));
  } catch {
    /* stockage indisponible : le panier reste en mémoire pour cette session */
  }
}

export function useFactureEnCours() {
  const [lignes, setLignesState] = useState<LigneFacture[]>([]);
  const [clientNom, setClientNomState] = useState<string>('');

  useEffect(() => {
    // Ne garde que les lignes du jour même : un panier oublié la veille (ou
    // plus tôt) ne doit jamais se retrouver mélangé aux achats d'aujourd'hui
    // dans une même facture. Les lignes périmées sont aussi purgées du
    // stockage, pas seulement masquées à l'affichage.
    const duJour = lignesDuJour(lireLignes());
    setLignesState(duJour);
    sauvegarderLignes(duJour);
    setClientNomState(lireClient());
  }, []);

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
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(CLE_CLIENT, nom);
      } catch {
        /* stockage indisponible : le nom reste en mémoire pour cette session */
      }
    }
  }

  function vider() {
    setLignesState([]);
    setClientNomState('');
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(CLE_LIGNES);
        window.localStorage.removeItem(CLE_CLIENT);
      } catch {
        /* stockage indisponible : rien à nettoyer côté disque */
      }
    }
  }

  return { lignes, clientNom, setClientNom, ajouter, retirer, vider, total: totalLignes(lignes) };
}
