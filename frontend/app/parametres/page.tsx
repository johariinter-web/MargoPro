'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/lib/hooks/useConfig';
import { useStock } from '@/lib/hooks/useStock';

const DEVISES = [
  { code: 'XOF', symbole: 'FCFA', nom: 'Franc CFA (UEMOA)' },
  { code: 'XAF', symbole: 'FCFA', nom: 'Franc CFA (CEMAC)' },
  { code: 'GNF', symbole: 'GNF', nom: 'Franc guinéen' },
  { code: 'CDF', symbole: 'FC', nom: 'Franc congolais' },
  { code: 'MGA', symbole: 'Ar', nom: 'Ariary' },
  { code: 'MAD', symbole: 'MAD', nom: 'Dirham' },
  { code: 'TND', symbole: 'TND', nom: 'Dinar' },
];

export default function ParametresPage() {
  const router = useRouter();
  const { config, saveConfig } = useConfig();
  const { alertes } = useStock();
  const [nomCommerce, setNomCommerce] = useState(config?.nomCommerce ?? '');
  const [deviseCode, setDeviseCode] = useState(config?.devise ?? '');
  const [sauvegarde, setSauvegarde] = useState(false);

  async function handleSauvegarder() {
    const devise = DEVISES.find(d => d.code === deviseCode);
    if (!devise || !nomCommerce.trim()) return;
    await saveConfig({
      nomCommerce: nomCommerce.trim(),
      devise: devise.code,
      symboleDevise: devise.symbole,
      onboardingComplete: true,
    });
    setSauvegarde(true);
    setTimeout(() => setSauvegarde(false), 2000);
  }

  return (
    <div className="pb-24 px-4 pt-6 space-y-6">
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-50">Paramètres</h1>

      {/* Alertes */}
      <button
        onClick={() => router.push('/alertes')}
        className={`w-full flex items-center justify-between rounded-2xl p-4 shadow-sm border-2 ${
          alertes.length > 0
            ? 'bg-orange-alert/10 border-orange-alert'
            : 'bg-white dark:bg-stone-800 border-stone-100 dark:border-stone-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="text-left">
            <p className={`font-bold text-base ${alertes.length > 0 ? 'text-orange-alert' : 'text-stone-800 dark:text-stone-50'}`}>
              Alertes stock
            </p>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {alertes.length > 0
                ? `${alertes.length} produit${alertes.length > 1 ? 's' : ''} en stock bas`
                : 'Tous les stocks sont suffisants'}
            </p>
          </div>
        </div>
        <span className="text-stone-400 text-xl">→</span>
      </button>

      {/* Nom du commerce */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700 space-y-3">
        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-50">Mon commerce</h2>
        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-1">
            Nom du commerce
          </label>
          <input
            type="text"
            value={nomCommerce}
            onChange={(e) => setNomCommerce(e.target.value)}
            placeholder="Ex: Boutique Aminata"
            className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300 mb-2">
            Devise
          </label>
          <div className="space-y-2">
            {DEVISES.map((d) => (
              <button
                key={d.code}
                onClick={() => setDeviseCode(d.code)}
                className={`w-full text-left border-2 rounded-xl px-4 py-3 transition-colors ${
                  deviseCode === d.code
                    ? 'border-emerald bg-emerald-light dark:bg-emerald/20'
                    : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800'
                }`}
              >
                <span className="font-bold text-stone-800 dark:text-stone-100">{d.symbole}</span>
                <span className="text-stone-500 dark:text-stone-400 text-sm"> — {d.nom}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSauvegarder}
          disabled={!nomCommerce.trim() || !deviseCode}
          className="w-full bg-emerald text-white rounded-xl py-3 text-base font-bold min-h-[48px] disabled:opacity-40"
        >
          {sauvegarde ? '✅ Sauvegardé !' : 'Sauvegarder'}
        </button>
      </div>

      {/* CGU */}
      <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 shadow-sm border border-stone-100 dark:border-stone-700">
        <h2 className="text-lg font-bold text-stone-800 dark:text-stone-50 mb-3">Légal</h2>
        <a
          href="https://eidma.co/cgu"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between py-2"
        >
          <span className="text-stone-700 dark:text-stone-300">Conditions Générales d&apos;Utilisation</span>
          <span className="text-emerald text-lg">→</span>
        </a>
      </div>

      {/* Version */}
      <p className="text-center text-xs text-stone-400 dark:text-stone-500 pb-4">
        MargoPro — Version bêta
      </p>
    </div>
  );
}
