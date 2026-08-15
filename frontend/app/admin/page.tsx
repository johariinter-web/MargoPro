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
        <div className="space-y-3">
          {comptes.map((c) => (
            <div key={c.userId} className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-stone-800 dark:text-stone-50">{c.nomCommerce}</p>
                {c.isPremium ? (
                  <span className="text-emerald-600 font-semibold text-sm shrink-0">Premium</span>
                ) : (
                  <span className="text-stone-400 text-sm shrink-0">Gratuit / essai</span>
                )}
              </div>
              <p className="text-stone-500 dark:text-stone-400 text-sm break-all">{c.email}</p>
              <p className="text-stone-500 dark:text-stone-400 text-sm">Inscrit le {formatDate(c.inscritLe)}</p>
              <div className="flex gap-6 pt-1">
                <div>
                  <p className="text-2xl font-bold text-stone-800 dark:text-stone-50">{c.nbProduits}</p>
                  <p className="text-stone-500 dark:text-stone-400 text-xs">Produits</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-stone-800 dark:text-stone-50">{c.nbVentes}</p>
                  <p className="text-stone-500 dark:text-stone-400 text-xs">Ventes</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
