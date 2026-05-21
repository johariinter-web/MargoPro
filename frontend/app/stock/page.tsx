'use client';

import { useState } from 'react';
import AlerteBadge from '@/components/AlerteBadge';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import type { Produit } from '@backend/types';

function formatMontant(n: number, symbole: string) {
  return `${n.toLocaleString('fr-FR')} ${symbole}`;
}

const CHAMPS_VIDES = { nom: '', quantite: '', prixAchat: '', prixVente: '', seuilAlerte: '5' };

export default function StockPage() {
  const { config } = useConfig();
  const { produits, alertes, ajouterProduit, supprimerProduit } = useStock();
  const [showForm, setShowForm] = useState(false);
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');

  const symbole = config?.symboleDevise ?? 'FCFA';

  const produitsFiltres = produits.filter(p =>
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  async function handleAjouter() {
    setErreur('');
    const err = await ajouterProduit({
      nom: champs.nom.trim(),
      quantite: Number(champs.quantite),
      prixAchat: Number(champs.prixAchat),
      prixVente: Number(champs.prixVente),
      seuilAlerte: Number(champs.seuilAlerte) || 5,
    });
    if (err) { setErreur(err); return; }
    setChamps(CHAMPS_VIDES);
    setShowForm(false);
  }

  return (
    <div className="pb-24 px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-50">Stock</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-emerald text-white rounded-xl px-4 py-3 font-bold text-lg min-h-[48px]"
        >
          + Ajouter
        </button>
      </div>

      {alertes.length > 0 && <AlerteBadge count={alertes.length} />}

      {/* Recherche */}
      <input
        type="search"
        value={recherche}
        onChange={e => setRecherche(e.target.value)}
        placeholder="🔍 Rechercher un produit..."
        className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-lg bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none"
      />

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 space-y-4">
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-50">Nouveau produit</h2>
          {erreur && <p className="text-orange-alert font-semibold">{erreur}</p>}
          {[
            { key: 'nom', label: 'Nom du produit', placeholder: 'Ex: Savon Protex', type: 'text' },
            { key: 'quantite', label: 'Quantité', placeholder: '0', type: 'number' },
            { key: 'prixAchat', label: `Prix d'achat (${symbole})`, placeholder: '0', type: 'number' },
            { key: 'prixVente', label: `Prix de vente (${symbole})`, placeholder: '0', type: 'number' },
            { key: 'seuilAlerte', label: 'Seuil d\'alerte stock bas', placeholder: '5', type: 'number' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key}>
              <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">{label}</label>
              <input
                type={type}
                value={champs[key as keyof typeof champs]}
                onChange={e => setChamps(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                min={type === 'number' ? '0' : undefined}
                className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none"
              />
            </div>
          ))}
          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); setErreur(''); setChamps(CHAMPS_VIDES); }}
              className="flex-1 border-2 border-stone-200 dark:border-stone-600 text-stone-800 dark:text-stone-100 rounded-xl py-3 text-lg font-semibold min-h-[48px]"
            >
              Annuler
            </button>
            <button
              onClick={handleAjouter}
              className="flex-[2] bg-emerald text-white rounded-xl py-3 text-lg font-bold min-h-[48px]"
            >
              ✅ Ajouter
            </button>
          </div>
        </div>
      )}

      {/* Liste des produits */}
      {produitsFiltres.length === 0 && !showForm && (
        <div className="text-center py-12 text-stone-600 dark:text-stone-400">
          <p className="text-5xl mb-3">📦</p>
          <p className="text-xl">{recherche ? 'Aucun produit trouvé' : 'Aucun produit pour l\'instant'}</p>
        </div>
      )}

      <div className="space-y-3">
        {produitsFiltres.map((produit: Produit) => {
          const stockBas = produit.quantite <= produit.seuilAlerte;
          return (
            <div
              key={produit.id}
              className={`bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border-2 ${
                stockBas ? 'border-orange-alert' : 'border-stone-100 dark:border-stone-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-stone-800 dark:text-stone-50">{produit.nom}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-2xl font-bold ${stockBas ? 'text-orange-alert' : 'text-emerald'}`}>
                      {produit.quantite} unités
                    </span>
                    {stockBas && <span className="text-orange-alert text-sm font-bold">⚠️ Stock bas</span>}
                  </div>
                  <p className="text-stone-600 dark:text-stone-400 text-sm mt-1">
                    Achat: {formatMontant(produit.prixAchat, symbole)} · Vente: {formatMontant(produit.prixVente, symbole)}
                  </p>
                </div>
                <button
                  onClick={() => supprimerProduit(produit.id)}
                  className="text-stone-400 hover:text-red-loss p-2 text-xl"
                  aria-label="Supprimer"
                >
                  🗑️
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
