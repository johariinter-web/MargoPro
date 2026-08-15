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
  const [ouvert, setOuvert] = useState<string | null>(null);

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
        <div className="space-y-2">
          {comptes.map((c) => {
            const estOuvert = ouvert === c.userId;
            return (
              <div key={c.userId} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 overflow-hidden">
                <button
                  onClick={() => setOuvert(estOuvert ? null : c.userId)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <span className="font-semibold text-stone-800 dark:text-stone-50 truncate">{c.nomCommerce}</span>
                  <span className="flex items-center gap-2 shrink-0 text-xs text-stone-500 dark:text-stone-400">
                    <span>{c.nbProduits} prod. · {c.nbVentes} ventes</span>
                    {c.isPremium && <span className="text-emerald-600 font-semibold">Premium</span>}
                    <span className="text-stone-400">{estOuvert ? '▲' : '▼'}</span>
                  </span>
                </button>
                {estOuvert && (
                  <div className="px-3 pb-3 pt-1 border-t border-stone-100 dark:border-stone-700 text-sm text-stone-600 dark:text-stone-300 space-y-1">
                    <p className="break-all">{c.email}</p>
                    <p>Inscrit le {formatDate(c.inscritLe)}</p>
                    <p>{c.isPremium ? 'Premium' : 'Gratuit / essai'}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
