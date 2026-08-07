'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { ModalUpgrade } from './ModalUpgrade';

interface Props {
  titre: string;
  description: string;
}

export function AccesPremiumRequis({ titre, description }: Props) {
  const T = useColors();
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{
      background: T.surface, borderRadius: 16, padding: '28px 20px',
      textAlign: 'center', boxShadow: T.shadow, fontFamily: 'Manrope, sans-serif',
    }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>
        {titre} — fonctionnalité Premium
      </div>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
        {description}
      </div>
      <button
        onClick={() => setShowModal(true)}
        style={{
          height: 48, borderRadius: 14, padding: '0 24px',
          background: T.accent, color: 'white', border: 'none',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
          fontFamily: 'Manrope, sans-serif',
        }}
      >
        Passer au Premium
      </button>
      {showModal && <ModalUpgrade onClose={() => setShowModal(false)} />}
    </div>
  );
}
