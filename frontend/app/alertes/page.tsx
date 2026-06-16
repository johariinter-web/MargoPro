'use client';

import { useRouter } from 'next/navigation';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';

function formatMontant(n: number, symbole: string) {
  return `${n.toLocaleString('fr-FR')} ${symbole}`;
}

export default function AlertesPage() {
  const router = useRouter();
  const T = useColors();
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
          <div style={{ width: 72, height: 72, borderRadius: 20, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-xl font-semibold text-stone-700 dark:text-stone-300">Aucune alerte</p>
          <p className="text-stone-500 dark:text-stone-400">Tous vos stocks sont suffisants.</p>
          <button
            onClick={() => router.push('/stock')}
            style={{ background: T.accent, color: 'white', borderRadius: 12, padding: '12px 24px', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', minHeight: 48 }}
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
            style={{ width: '100%', background: T.accent, color: 'white', borderRadius: 12, padding: '16px', fontSize: 17, fontWeight: 700, border: 'none', cursor: 'pointer', minHeight: 56 }}
          >
            Gérer le stock →
          </button>
        </>
      )}
    </div>
  );
}
