'use client';

import { useState } from 'react';
import { usePlan } from '@/lib/hooks/usePlan';
import { ModalUpgrade } from './ModalUpgrade';

export function BanniereEssai() {
  const plan = usePlan();
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (plan.status !== 'warning' || dismissed) return null;

  const j = plan.daysRemaining;
  const msg = j === 1 ? 'expire demain' : `expire dans ${j} jour${j > 1 ? 's' : ''}`;

  return (
    <>
      <div style={{
        background: '#F97316', color: 'white',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600,
        flexWrap: 'wrap',
      }}>
        <span>⏳ Votre essai gratuit {msg}</span>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'white', color: '#F97316',
              border: 'none', borderRadius: 8, padding: '0 12px',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', height: 32,
            }}
          >
            Passer au Premium
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              background: 'rgba(255,255,255,0.25)', border: 'none',
              borderRadius: 8, color: 'white', fontWeight: 700, fontSize: 18,
              cursor: 'pointer', width: 32, height: 32, lineHeight: 1, padding: 0,
            }}
            aria-label="Fermer la bannière"
          >
            ×
          </button>
        </div>
      </div>
      {showModal && <ModalUpgrade onClose={() => setShowModal(false)} />}
    </>
  );
}
