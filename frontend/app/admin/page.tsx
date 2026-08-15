'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CompteAdmin {
  userId: string;
  nomCommerce: string;
  email: string;
  inscritLe: number | null;
  isPremium: boolean;
  premiumExpiresAt: number | null;
  trialStart: number | null;
  nbProduits: number;
  nbVentes: number;
}

function formatDate(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminPage() {
  const router = useRouter();
  const [comptes, setComptes] = useState<CompteAdmin[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          router.replace('/');
          return;
        }
        if (!res.ok) {
          setErreur('Impossible de charger les données.');
          return;
        }
        const data = await res.json();
        setComptes(data.comptes);
      })
      .catch(() => setErreur('Impossible de charger les données.'));
  }, [router]);

  return (
    <div className="pb-24 px-4 pt-6 space-y-5">
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-50">Comptes inscrits</h1>

      {erreur && <p className="text-orange-alert">{erreur}</p>}

      {!erreur && !comptes && (
        <p className="text-stone-500 dark:text-stone-400">Chargement…</p>
      )}

      {comptes && comptes.length === 0 && (
        <p className="text-stone-500 dark:text-stone-400">Aucun compte inscrit.</p>
      )}

      {comptes && comptes.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-700">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 text-left">
                  <th className="px-3 py-2 font-semibold">Commerce</th>
                  <th className="px-3 py-2 font-semibold">Email</th>
                  <th className="px-3 py-2 font-semibold">Inscrit le</th>
                  <th className="px-3 py-2 font-semibold text-right">Produits</th>
                  <th className="px-3 py-2 font-semibold text-right">Ventes</th>
                  <th className="px-3 py-2 font-semibold">Premium</th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((c) => (
                  <tr key={c.userId} className="border-t border-stone-200 dark:border-stone-700">
                    <td className="px-3 py-2 font-medium text-stone-800 dark:text-stone-50">{c.nomCommerce}</td>
                    <td className="px-3 py-2 text-stone-600 dark:text-stone-300">{c.email}</td>
                    <td className="px-3 py-2 text-stone-600 dark:text-stone-300">{formatDate(c.inscritLe)}</td>
                    <td className="px-3 py-2 text-right text-stone-800 dark:text-stone-50">{c.nbProduits}</td>
                    <td className="px-3 py-2 text-right text-stone-800 dark:text-stone-50">{c.nbVentes}</td>
                    <td className="px-3 py-2">
                      {c.isPremium ? (
                        <span className="text-emerald-600 font-semibold">Premium</span>
                      ) : (
                        <span className="text-stone-400">Gratuit / essai</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-stone-400 text-xs text-center">← Fais glisser le tableau vers la gauche pour voir toutes les colonnes →</p>
        </>
      )}
    </div>
  );
}
