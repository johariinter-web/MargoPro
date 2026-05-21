'use client';

import { useRouter } from 'next/navigation';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';

function formatMontant(n: number, symbole: string) {
  return `${n.toLocaleString('fr-FR')} ${symbole}`;
}

export default function AlertesPage() {
  const router = useRouter();
  const { config } = useConfig();
  const { alertes, produits } = useStock();
  const symbole = config?.symboleDevise ?? 'FCFA';

  return (
    <div className="pb-24 px-4 pt-6 space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-stone-500 dark:text-stone-400 text-2xl leading-none"
          aria-label="Retour"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-50">Alertes stock</h1>
      </div>

      {alertes.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-6xl">✅</p>
          <p className="text-xl font-semibold text-stone-700 dark:text-stone-300">Aucune alerte</p>
          <p className="text-stone-500 dark:text-stone-400">Tous vos stocks sont suffisants.</p>
          <button
            onClick={() => router.push('/stock')}
            className="bg-emerald text-white rounded-xl px-6 py-3 font-bold min-h-[48px]"
          >
            Voir le stock
          </button>
        </div>
      ) : (
        <>
          <div className="bg-orange-alert/10 border border-orange-alert/30 rounded-2xl p-4">
            <p className="text-orange-alert font-bold text-lg">
              ⚠️ {alertes.length} produit{alertes.length > 1 ? 's' : ''} en stock bas
            </p>
            <p className="text-stone-600 dark:text-stone-400 text-sm mt-1">
              Réapprovisionnez ces produits pour éviter les ruptures.
            </p>
          </div>

          <div className="space-y-3">
            {alertes.map((produit) => {
              const manquant = produit.seuilAlerte - produit.quantite;
              return (
                <div
                  key={produit.id}
                  className="bg-white dark:bg-stone-800 rounded-2xl p-4 shadow-sm border-2 border-orange-alert"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-stone-800 dark:text-stone-50">{produit.nom}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl font-bold text-orange-alert">
                          {produit.quantite} unités
                        </span>
                        <span className="text-orange-alert text-sm font-bold">⚠️ Stock bas</span>
                      </div>
                      <p className="text-stone-500 dark:text-stone-400 text-sm mt-1">
                        Seuil d&apos;alerte : {produit.seuilAlerte} unités
                        {manquant > 0 && ` · Manquant : ${manquant} unités`}
                      </p>
                      <p className="text-stone-500 dark:text-stone-400 text-sm">
                        Prix achat : {formatMontant(produit.prixAchat, symbole)}
                      </p>
                    </div>
                    <span className="text-3xl ml-3">📦</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => router.push('/stock')}
            className="w-full bg-emerald text-white rounded-xl py-4 text-lg font-bold min-h-[56px]"
          >
            Gérer le stock →
          </button>
        </>
      )}
    </div>
  );
}
