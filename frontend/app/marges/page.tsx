'use client';

import { useState } from 'react';
import { calculerMarge, calculerPrixVente } from '@backend/marge';
import { useConfig } from '@/lib/hooks/useConfig';

export default function MargesPage() {
  const { config } = useConfig();
  const [prixAchat, setPrixAchat] = useState('');
  const [margePercent, setMargePercent] = useState(30);

  const symbole = config?.symboleDevise ?? 'FCFA';
  const achat = Number(prixAchat) || 0;
  const prixVente = calculerPrixVente(achat, margePercent);
  const { margePercent: margeCalc, margeMontant } = calculerMarge(achat, prixVente);

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-50">Calculateur de marge</h1>

      {/* Prix d'achat */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 space-y-3">
        <label className="block text-lg font-semibold text-stone-700 dark:text-stone-300">
          Prix d'achat ({symbole})
        </label>
        <input
          type="number"
          value={prixAchat}
          onChange={e => setPrixAchat(e.target.value)}
          placeholder="Ex: 500"
          min="0"
          className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-4 text-2xl font-bold bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none"
        />
      </div>

      {/* Curseur marge */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-lg font-semibold text-stone-700 dark:text-stone-300">Marge souhaitée</label>
          <span className="text-3xl font-bold text-emerald">{margePercent}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="200"
          step="5"
          value={margePercent}
          onChange={e => setMargePercent(Number(e.target.value))}
          className="w-full h-3 rounded-full accent-emerald cursor-pointer"
        />
        <div className="flex justify-between text-sm text-stone-500 dark:text-stone-400">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
          <span>200%</span>
        </div>

        {/* Presets rapides */}
        <div className="flex gap-2 flex-wrap">
          {[10, 20, 30, 50, 100].map(v => (
            <button
              key={v}
              onClick={() => setMargePercent(v)}
              className={`px-3 py-2 rounded-lg text-sm font-bold min-h-[40px] ${
                margePercent === v
                  ? 'bg-emerald text-white'
                  : 'bg-stone-100 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
              }`}
            >
              {v}%
            </button>
          ))}
        </div>
      </div>

      {/* Résultat */}
      <div className="bg-emerald-light dark:bg-emerald/20 rounded-2xl p-5 space-y-4 border border-emerald/30">
        <h2 className="text-lg font-semibold text-emerald-dark">Résultat</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-lg text-stone-700 dark:text-stone-300">Prix de vente</span>
            <span className="text-3xl font-bold text-emerald">
              {achat > 0 ? `${prixVente.toLocaleString('fr-FR')} ${symbole}` : '—'}
            </span>
          </div>
          <div className="h-px bg-emerald/20" />
          <div className="flex justify-between items-center">
            <span className="text-stone-600 dark:text-stone-400">Bénéfice par unité</span>
            <span className="text-xl font-bold text-green-gain">
              {achat > 0 ? `+${margeMontant.toLocaleString('fr-FR')} ${symbole}` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-stone-600 dark:text-stone-400">Marge réelle</span>
            <span className="text-xl font-bold text-stone-700 dark:text-stone-300">
              {achat > 0 ? `${margeCalc}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Tableau comparatif */}
      {achat > 0 && (
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 space-y-3">
          <h2 className="text-base font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
            Simulation — ventes multiples
          </h2>
          <div className="space-y-2">
            {[1, 5, 10, 20, 50].map(qte => (
              <div key={qte} className="flex justify-between py-2 border-b border-stone-100 dark:border-stone-700 last:border-0">
                <span className="text-stone-600 dark:text-stone-400">{qte} unité{qte > 1 ? 's' : ''}</span>
                <span className="font-bold text-emerald">
                  +{(margeMontant * qte).toLocaleString('fr-FR')} {symbole}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
