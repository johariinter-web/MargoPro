'use client';

import { useRouter } from 'next/navigation';

interface Props {
  onClose: () => void;
}

export function ModalUpgrade({ onClose }: Props) {
  const router = useRouter();

  function allerAAbonnement() {
    onClose();
    router.push('/abonnement');
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(28,24,17,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif', padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 20, padding: '32px 24px',
        maxWidth: 340, width: '100%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>⭐</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1C1811', marginBottom: 10 }}>
          Passer au Premium
        </div>
        <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, lineHeight: 1.7 }}>
          Débloque les produits illimités et plus encore pour 3500 FCFA/mois.
        </div>
        <button
          onClick={allerAAbonnement}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            width: '100%', height: 52, borderRadius: 14,
            background: '#059669', color: 'white', border: 'none', cursor: 'pointer',
            fontWeight: 700, fontSize: 15,
            marginBottom: 12,
          }}
        >
          Passer au Premium
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%', height: 44, borderRadius: 12,
            background: '#F3F4F6', border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14, color: '#6B7280',
          }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
