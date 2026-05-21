'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/lib/hooks/useConfig';

const DEVISES = [
  { code: 'XOF', symbole: 'FCFA', nom: 'Franc CFA (UEMOA) — Sénégal, Côte d\'Ivoire, Mali...' },
  { code: 'XAF', symbole: 'FCFA', nom: 'Franc CFA (CEMAC) — Cameroun, Gabon, Congo...' },
  { code: 'GNF', symbole: 'GNF', nom: 'Franc guinéen — Guinée' },
  { code: 'CDF', symbole: 'FC', nom: 'Franc congolais — RDC' },
  { code: 'MGA', symbole: 'Ar', nom: 'Ariary — Madagascar' },
  { code: 'MAD', symbole: 'MAD', nom: 'Dirham — Maroc' },
  { code: 'TND', symbole: 'TND', nom: 'Dinar — Tunisie' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { saveConfig } = useConfig();
  const [etape, setEtape] = useState(1);
  const [nomCommerce, setNomCommerce] = useState('');
  const [deviseCode, setDeviseCode] = useState('');
  const [cguAccepte, setCguAccepte] = useState(false);

  async function terminer() {
    const devise = DEVISES.find(d => d.code === deviseCode)!;
    await saveConfig({
      nomCommerce,
      devise: devise.code,
      symboleDevise: devise.symbole,
      onboardingComplete: true,
    });
    router.push('/');
  }

  return (
    <div className="min-h-screen bg-stone-bg flex flex-col pb-20">
      {/* Barre de progression */}
      <div className="flex gap-2 p-4 pt-8">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-1.5 flex-1 rounded-full transition-colors ${n <= etape ? 'bg-emerald' : 'bg-stone-200'}`}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-8">

        {/* Étape 1 — Bienvenue */}
        {etape === 1 && (
          <div className="space-y-8">
            <div>
              <p className="text-5xl mb-4">👋</p>
              <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-50">
                Bienvenue sur MargoPro
              </h1>
              <p className="text-lg text-stone-600 dark:text-stone-400 mt-2">
                Gérez votre commerce simplement, même sans internet.
              </p>
            </div>
            <div className="space-y-3">
              <label className="block text-lg font-semibold text-stone-800 dark:text-stone-100">
                Comment s'appelle ton commerce ?
              </label>
              <input
                type="text"
                value={nomCommerce}
                onChange={(e) => setNomCommerce(e.target.value)}
                placeholder="Ex: Boutique Aminata"
                className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-4 text-xl bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none"
                autoFocus
              />
            </div>
            <button
              onClick={() => setEtape(2)}
              disabled={!nomCommerce.trim()}
              className="w-full bg-emerald text-white rounded-xl py-4 text-xl font-bold min-h-[56px] disabled:opacity-40 transition-opacity"
            >
              Continuer →
            </button>
          </div>
        )}

        {/* Étape 2 — Devise */}
        {etape === 2 && (
          <div className="space-y-6">
            <div>
              <p className="text-5xl mb-4">💱</p>
              <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-50">
                Quelle devise tu utilises ?
              </h1>
            </div>
            <div className="space-y-3">
              {DEVISES.map((d) => (
                <button
                  key={d.code}
                  onClick={() => setDeviseCode(d.code)}
                  className={`w-full text-left border-2 rounded-xl px-4 py-4 transition-colors ${
                    deviseCode === d.code
                      ? 'border-emerald bg-emerald-light dark:bg-emerald/20'
                      : 'border-stone-200 dark:border-stone-600 bg-white dark:bg-stone-800'
                  }`}
                >
                  <span className="font-bold text-lg text-stone-800 dark:text-stone-100">{d.symbole}</span>
                  <span className="text-stone-600 dark:text-stone-400 text-sm block">{d.nom}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEtape(1)}
                className="flex-1 border-2 border-stone-200 dark:border-stone-600 text-stone-800 dark:text-stone-100 rounded-xl py-4 text-lg font-semibold min-h-[56px]"
              >
                ← Retour
              </button>
              <button
                onClick={() => setEtape(3)}
                disabled={!deviseCode}
                className="flex-[2] bg-emerald text-white rounded-xl py-4 text-lg font-bold min-h-[56px] disabled:opacity-40"
              >
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* Étape 3 — Prêt */}
        {etape === 3 && (
          <div className="space-y-8">
            <div>
              <p className="text-5xl mb-4">🚀</p>
              <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-50">
                C'est parti, {nomCommerce} !
              </h1>
              <p className="text-lg text-stone-600 dark:text-stone-400 mt-2">
                Ajoutez votre premier produit pour commencer à suivre votre stock et vos bénéfices.
              </p>
            </div>
            <div className="bg-emerald-light dark:bg-emerald/20 rounded-2xl p-5 space-y-2">
              <p className="font-semibold text-emerald-dark">✅ Tout est prêt :</p>
              <ul className="space-y-1 text-stone-700 dark:text-stone-300">
                <li>📦 Gérez votre stock</li>
                <li>💰 Calculez vos marges</li>
                <li>📊 Suivez vos ventes</li>
                <li>📴 Fonctionne sans internet</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cguAccepte}
                onChange={(e) => setCguAccepte(e.target.checked)}
                className="mt-1 w-5 h-5 accent-emerald flex-shrink-0"
              />
              <span className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                J&apos;ai lu et j&apos;accepte les{' '}
                <a
                  href="https://eidma.co/cgu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald underline"
                >
                  Conditions Générales d&apos;Utilisation
                </a>{' '}
                de MargoPro.
              </span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => setEtape(2)}
                className="flex-1 border-2 border-stone-200 dark:border-stone-600 text-stone-800 dark:text-stone-100 rounded-xl py-4 text-lg font-semibold min-h-[56px]"
              >
                ← Retour
              </button>
              <button
                onClick={terminer}
                disabled={!cguAccepte}
                className="flex-[2] bg-emerald text-white rounded-xl py-4 text-xl font-bold min-h-[56px] disabled:opacity-40 transition-opacity"
              >
                Commencer maintenant 🎉
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
