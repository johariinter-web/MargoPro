'use client';

import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { useConfig } from '@/lib/hooks/useConfig';
import type { Periode } from '@backend/types';

function formatMontant(n: number, symbole: string) {
  return `${n.toLocaleString('fr-FR')} ${symbole}`;
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'jour', label: 'Aujourd\'hui' },
  { value: 'semaine', label: 'Cette semaine' },
  { value: 'mois', label: 'Ce mois' },
  { value: 'tout', label: 'Tout' },
];

export default function VentesPage() {
  const { config } = useConfig();
  const { produits, deduireStock } = useStock();
  const [periode, setPeriode] = useState<Periode>('jour');
  const { ventes, stats, enregistrerVente } = useVentes(periode);

  const [showForm, setShowForm] = useState(false);
  const [produitId, setProduitId] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [erreur, setErreur] = useState('');

  const symbole = config?.symboleDevise ?? 'FCFA';

  async function handleVente() {
    setErreur('');
    const produit = produits.find(p => p.id === produitId);
    if (!produit) { setErreur('Choisissez un produit'); return; }
    const qte = Number(quantite);
    if (!qte || qte <= 0) { setErreur('Quantité invalide'); return; }
    if (qte > produit.quantite) { setErreur(`Stock insuffisant (${produit.quantite} disponibles)`); return; }
    await enregistrerVente(produit.id, produit.nom, qte, produit.prixVente, produit.prixAchat);
    await deduireStock(produit.id, qte);
    setProduitId('');
    setQuantite('1');
    setShowForm(false);
  }

  return (
    <div className="pb-24 px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-50">Ventes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-emerald text-white rounded-xl px-4 py-3 font-bold text-lg min-h-[48px]"
        >
          + Vente
        </button>
      </div>

      {/* Formulaire vente rapide */}
      {showForm && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 space-y-4">
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-50">Enregistrer une vente</h2>
          {erreur && <p className="text-orange-alert font-semibold">{erreur}</p>}

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">Produit</label>
            <select
              value={produitId}
              onChange={e => setProduitId(e.target.value)}
              className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none"
            >
              <option value="">Choisir un produit...</option>
              {produits.filter(p => p.quantite > 0).map(p => (
                <option key={p.id} value={p.id}>
                  {p.nom} — {formatMontant(p.prixVente, symbole)} ({p.quantite} dispo)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">Quantité</label>
            <input
              type="number"
              value={quantite}
              onChange={e => setQuantite(e.target.value)}
              min="1"
              className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none"
            />
          </div>

          {produitId && (
            <div className="bg-stone-50 dark:bg-stone-700 rounded-xl p-3">
              {(() => {
                const p = produits.find(pr => pr.id === produitId);
                if (!p) return null;
                const qte = Number(quantite) || 0;
                return (
                  <p className="text-stone-700 dark:text-stone-300">
                    Total : <strong>{formatMontant(p.prixVente * qte, symbole)}</strong> ·
                    Bénéfice : <strong className="text-green-gain">+{formatMontant((p.prixVente - p.prixAchat) * qte, symbole)}</strong>
                  </p>
                );
              })()}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => { setShowForm(false); setErreur(''); }}
              className="flex-1 border-2 border-stone-200 dark:border-stone-600 text-stone-800 dark:text-stone-100 rounded-xl py-3 text-lg font-semibold min-h-[48px]"
            >
              Annuler
            </button>
            <button
              onClick={handleVente}
              className="flex-[2] bg-emerald text-white rounded-xl py-3 text-lg font-bold min-h-[48px]"
            >
              ✅ Confirmer
            </button>
          </div>
        </div>
      )}

      {/* Filtres période */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PERIODES.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriode(p.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold min-h-[40px] transition-colors ${
              periode === p.value
                ? 'bg-emerald text-white'
                : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Résumé période */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border border-stone-100 dark:border-stone-700">
          <p className="text-sm text-stone-600 dark:text-stone-400 font-medium">Chiffre d'affaires</p>
          <p className="text-2xl font-bold text-stone-800 dark:text-stone-50 mt-1">
            {formatMontant(stats.chiffreAffaires, symbole)}
          </p>
        </div>
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border border-stone-100 dark:border-stone-700">
          <p className="text-sm text-stone-600 dark:text-stone-400 font-medium">Bénéfice</p>
          <p className="text-2xl font-bold text-green-gain mt-1">
            +{formatMontant(stats.benefice, symbole)}
          </p>
        </div>
      </div>

      {/* Historique */}
      {ventes.length === 0 ? (
        <div className="text-center py-8 text-stone-600 dark:text-stone-400">
          <p className="text-4xl mb-2">🛒</p>
          <p className="text-lg">Aucune vente pour cette période</p>
        </div>
      ) : (
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
            Historique ({stats.nombreVentes} ventes)
          </h2>
          <div className="bg-white dark:bg-stone-800 rounded-2xl divide-y divide-stone-100 dark:divide-stone-700 shadow-sm border border-stone-100 dark:border-stone-700">
            {ventes.slice(0, 50).map(v => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-semibold text-stone-800 dark:text-stone-100">{v.produitNom}</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    {v.quantite} × {formatMontant(v.prixVente, symbole)} · {formatDate(v.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-stone-800 dark:text-stone-100">{formatMontant(v.total, symbole)}</p>
                  <p className="text-sm text-green-gain font-semibold">+{formatMontant(v.benefice, symbole)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
