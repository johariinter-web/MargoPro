'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/lib/hooks/useConfig';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';

function formatMontant(n: number, symbole: string) {
  return `${n.toLocaleString('fr-FR')} ${symbole}`;
}

function formatHeure(ts: number) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function salutation() {
  const h = new Date().getHours();
  if (h < 12) return 'Bonjour';
  if (h < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

export default function Dashboard() {
  const router = useRouter();
  const { config, isReady } = useConfig();
  const { produits, alertes, total: totalStock } = useStock();
  const { ventes, stats, top3 } = useVentes('jour');

  useEffect(() => {
    if (isReady && (!config || !config.onboardingComplete)) {
      router.replace('/onboarding');
    }
  }, [isReady, config, router]);

  if (!isReady || !config) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-10 h-10 border-4 border-emerald border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const symbole = config.symboleDevise;
  const meilleurProduit = top3[0];
  const ventesRecentes = ventes.slice(0, 5);

  return (
    <div className="pb-24 min-h-screen bg-stone-bg dark:bg-stone-900">

      {/* Header vert émeraude */}
      <div className="bg-gradient-to-br from-[#059669] to-[#10B981] px-5 pt-10 pb-16 rounded-b-[2rem]">
        <p className="text-emerald-100 text-base font-medium">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <h1 className="text-white text-2xl font-bold mt-1">
          {salutation()} {config.nomCommerce} 👋
        </h1>
        {alertes.length > 0 && (
          <button
            onClick={() => router.push('/stock')}
            className="mt-3 inline-flex items-center gap-2 bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-full"
          >
            ⚠️ {alertes.length} alerte{alertes.length > 1 ? 's' : ''} stock bas
          </button>
        )}
      </div>

      {/* 3 cartes flottantes sur le header */}
      <div className="px-4 -mt-10 grid grid-cols-3 gap-3">
        {/* Bénéfice du jour */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-3 shadow-lg flex flex-col items-center text-center">
          <span className="text-2xl">💵</span>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium mt-1 uppercase tracking-wide leading-tight">Bénéfice</p>
          <p className="text-base font-bold text-[#059669] mt-1 leading-tight">
            {stats.benefice > 0 ? '+' : ''}{formatMontant(stats.benefice, symbole)}
          </p>
        </div>

        {/* Stock total */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-3 shadow-lg flex flex-col items-center text-center">
          <span className="text-2xl">📦</span>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium mt-1 uppercase tracking-wide leading-tight">Stock</p>
          <p className="text-base font-bold text-stone-800 dark:text-stone-100 mt-1 leading-tight">
            {totalStock} unités
          </p>
          <p className="text-[10px] text-stone-400">{produits.length} produits</p>
        </div>

        {/* Meilleur produit */}
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-3 shadow-lg flex flex-col items-center text-center">
          <span className="text-2xl">🏆</span>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium mt-1 uppercase tracking-wide leading-tight">Top</p>
          <p className="text-[11px] font-bold text-stone-800 dark:text-stone-100 mt-1 leading-tight line-clamp-2">
            {meilleurProduit ? meilleurProduit.nom : '—'}
          </p>
        </div>
      </div>

      <div className="px-4 pt-6 space-y-6">

        {/* Résumé du jour */}
        <section>
          <h2 className="text-base font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide mb-3">
            Aujourd'hui
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border border-stone-100 dark:border-stone-700">
              <p className="text-xs text-stone-500 uppercase tracking-wide">Chiffre d'affaires</p>
              <p className="text-2xl font-bold text-stone-800 dark:text-stone-100 mt-1">
                {formatMontant(stats.chiffreAffaires, symbole)}
              </p>
              <p className="text-xs text-stone-400 mt-1">{stats.nombreVentes} vente{stats.nombreVentes !== 1 ? 's' : ''}</p>
            </div>
            <div className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border border-stone-100 dark:border-stone-700">
              <p className="text-xs text-stone-500 uppercase tracking-wide">Bénéfice net</p>
              <p className={`text-2xl font-bold mt-1 ${stats.benefice >= 0 ? 'text-[#059669]' : 'text-red-500'}`}>
                {stats.benefice >= 0 ? '+' : ''}{formatMontant(stats.benefice, symbole)}
              </p>
              <p className="text-xs text-stone-400 mt-1">
                {stats.chiffreAffaires > 0
                  ? `${Math.round((stats.benefice / stats.chiffreAffaires) * 100)}% marge`
                  : 'Aucune vente'}
              </p>
            </div>
          </div>
        </section>

        {/* Activité récente */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
              Activité récente
            </h2>
            {ventes.length > 5 && (
              <button
                onClick={() => router.push('/ventes')}
                className="text-[#059669] text-sm font-semibold"
              >
                Voir tout →
              </button>
            )}
          </div>

          {ventesRecentes.length === 0 ? (
            <div className="bg-white dark:bg-stone-800 rounded-2xl p-8 text-center shadow-sm border border-stone-100 dark:border-stone-700 space-y-3">
              <p className="text-4xl">🛒</p>
              <p className="text-stone-600 dark:text-stone-400 font-medium">Aucune vente aujourd'hui</p>
              <button
                onClick={() => router.push('/ventes')}
                className="bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-bold min-h-[44px]"
              >
                Enregistrer une vente
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-700">
              {ventesRecentes.map((v) => (
                <div key={v.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-light rounded-xl flex items-center justify-center text-lg">
                      🛒
                    </div>
                    <div>
                      <p className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{v.produitNom}</p>
                      <p className="text-xs text-stone-400">{v.quantite} unité{v.quantite > 1 ? 's' : ''} · {formatHeure(v.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-stone-800 dark:text-stone-100 text-sm">{formatMontant(v.total, symbole)}</p>
                    <p className="text-xs text-[#059669] font-semibold">+{formatMontant(v.benefice, symbole)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top produits */}
        {top3.length > 0 && (
          <section>
            <h2 className="text-base font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide mb-3">
              Meilleurs produits
            </h2>
            <div className="bg-white dark:bg-stone-800 rounded-2xl shadow-sm border border-stone-100 dark:border-stone-700 divide-y divide-stone-100 dark:divide-stone-700">
              {top3.map((p, i) => (
                <div key={p.nom} className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                    <div>
                      <p className="font-semibold text-stone-800 dark:text-stone-100">{p.nom}</p>
                      <p className="text-xs text-stone-400">{p.quantite} vendu{p.quantite > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  <p className="font-bold text-[#059669]">{formatMontant(p.total, symbole)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* État vide — aucun produit */}
        {produits.length === 0 && (
          <div className="text-center py-10 space-y-4">
            <p className="text-6xl">📦</p>
            <p className="text-xl font-semibold text-stone-700 dark:text-stone-300">Aucun produit encore</p>
            <p className="text-stone-500">Ajoutez votre premier produit pour commencer</p>
            <button
              onClick={() => router.push('/stock')}
              className="bg-[#059669] text-white rounded-xl px-6 py-3 text-lg font-bold min-h-[48px]"
            >
              + Ajouter un produit
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
