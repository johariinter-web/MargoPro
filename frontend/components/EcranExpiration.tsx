'use client';

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePlan } from '@/lib/hooks/usePlan';
import { ModalUpgrade } from './ModalUpgrade';
import { db } from '@/lib/db';
import { requestSync } from '@/lib/syncController';

export function EcranExpiration() {
  const plan = usePlan();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const produits = useLiveQuery(
    () => db.produits.orderBy('nom').filter(p => !p.deleted && !p.archived).toArray()
  ) ?? [];

  // Pendant le chargement Dexie, bloquer l'affichage pour éviter un flash de contenu non autorisé
  if (plan.isLoading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 999, background: '#FAFAF9' }} />
  );

  if (plan.status !== 'expired' || plan.activeProductCount <= 5) return null;

  function toggle(id: string) {
    setSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 5) {
        next.add(id);
      }
      return next;
    });
  }

  async function confirmer() {
    if (selection.size !== 5 || loading) return;
    setLoading(true);
    try {
      const now = Date.now();
      for (const p of produits) {
        if (!selection.has(p.id)) {
          await db.produits.update(p.id, { archived: true, updatedAt: now });
        }
      }
      requestSync();
      // usePlan se re-calcule automatiquement via useLiveQuery → EcranExpiration disparaît
    } catch {
      setLoading(false);
    }
  }

  const selCount = selection.size;

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: '#FAFAF9',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Manrope, sans-serif',
        maxWidth: 480, margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ padding: '36px 24px 16px', borderBottom: '1px solid #E5E7EB' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1C1811', marginBottom: 10 }}>
            Essai terminé
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.7 }}>
            Votre essai de 30 jours est terminé. Choisissez 5 produits à garder actifs. Les autres seront archivés — pas supprimés. Ils reviennent si vous passez au Premium.
          </div>
          <div style={{
            marginTop: 14, display: 'inline-block',
            fontSize: 13, fontWeight: 700, borderRadius: 20, padding: '4px 12px',
            background: selCount === 5 ? '#D1FAE5' : '#FFF7ED',
            color: selCount === 5 ? '#059669' : '#F97316',
          }}>
            {selCount}/5 sélectionnés
          </div>
        </div>

        {/* Liste produits */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {produits.map(p => {
            const checked = selection.has(p.id);
            const disabled = !checked && selCount >= 5;
            return (
              <div
                key={p.id}
                onClick={() => !disabled && toggle(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 24px',
                  opacity: disabled ? 0.35 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  borderBottom: '1px solid #F3F4F6',
                  background: checked ? '#F0FDF4' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  border: checked ? 'none' : '2px solid #D1D5DB',
                  background: checked ? '#059669' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checked && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7l3.5 3.5L11.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1C1811', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.nom}
                  </div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    Qté : {p.quantite}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px 40px', borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={confirmer}
            disabled={selCount !== 5 || loading}
            style={{
              height: 52, borderRadius: 14, border: 'none',
              background: selCount === 5 ? '#059669' : '#E5E7EB',
              color: selCount === 5 ? 'white' : '#9CA3AF',
              cursor: selCount === 5 && !loading ? 'pointer' : 'default',
              fontWeight: 700, fontSize: 16, fontFamily: 'Manrope, sans-serif',
            }}
          >
            {loading ? 'Enregistrement…' : 'Confirmer la sélection'}
          </button>
          <button
            onClick={() => setShowModal(true)}
            style={{
              height: 48, borderRadius: 14, border: '2px solid #059669',
              background: 'transparent', color: '#059669',
              cursor: 'pointer', fontWeight: 700, fontSize: 14,
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            Passer au Premium — tout garder
          </button>
        </div>
      </div>

      {showModal && <ModalUpgrade onClose={() => setShowModal(false)} />}
    </>
  );
}
