'use client';

import { useRouter } from 'next/navigation';
import { useColors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import { useEffect, useState } from 'react';

const FEATURES = [
  { icon: 'box', color: '#B8860B', bg: '#FEF3D8', label: 'Produits illimités', subtitle: 'Gérez tout votre stock sans limites' },
  { icon: 'image', color: '#059669', bg: '#E3F4EC', label: 'Photos & Catalogue', subtitle: 'Vitrine à partager sur WhatsApp' },
  { icon: 'chart', color: '#2563EB', bg: '#E6F0FE', label: 'Marges & stock mort', subtitle: 'Analysez vos bénéfices' },
  { icon: 'cloud', color: '#7C3AED', bg: '#F2EBFD', label: 'Sauvegarde cloud', subtitle: 'Vos données sur tous vos appareils' },
];

function FeatureIcon({ name, color }: { name: string; color: string }) {
  const common = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none' as const };
  if (name === 'box') return (
    <svg {...common}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/><path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
  if (name === 'chart') return (
    <svg {...common}><path d="M3 3v18h18" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/><path d="M7 14l3-3 3 3 4-5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
  if (name === 'doc') return (
    <svg {...common}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/><path d="M14 2v6h6M8 13h8M8 17h5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
  if (name === 'image') return (
    <svg {...common}><rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="1.75"/><circle cx="8.5" cy="9" r="1.5" stroke={color} strokeWidth="1.5"/><path d="M21 15l-5-4-7 6" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
  return (
    <svg {...common}><path d="M18 10h-1.3A6 6 0 106 15h11a3.5 3.5 0 001-6.85" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
  );
}

const FREE_FEATURES = [
  'Stock jusqu\'à 5 produits',
  'Enregistrer des ventes',
  'Gain du jour (tableau simple)',
  'Fonctionne sans internet',
];

export default function AbonnementPage() {
  const T = useColors();
  const router = useRouter();
  const { config, saveConfig } = useConfig();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (config && !config.dateAbonnement) {
      saveConfig({ ...config, dateAbonnement: Date.now() });
    }
  }, [config]);

  const dateDebut = config?.dateAbonnement ?? Date.now();
  const dateExpiry = new Date(dateDebut + 30 * 24 * 60 * 60 * 1000);
  const joursRestants = Math.max(0, Math.ceil((dateExpiry.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const expiryLabel = dateExpiry.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, fontFamily: 'Manrope, sans-serif', paddingBottom: 40 }}>

      {/* MODAL */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.6)', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: T.surface, borderRadius: '24px 24px 0 0', width: '100%', padding: '28px 24px 40px' }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 20px' }} />
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2-.1-2.8a2 2 0 00-2.8-.1zM12 15l-3-3a12 12 0 015-8c1.9-1.1 5-1 5-1s.1 3.1-1 5a12 12 0 01-8 5z" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 12H4s.5-2.8 2-4 4-1 4-1M12 15v5s2.8-.5 4-2 1-4 1-4" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, textAlign: 'center', marginBottom: 8 }}>Bientôt disponible</div>
            <div style={{ fontSize: 14, color: T.textMuted, textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              Le paiement Mobile Money et Wave sera disponible très bientôt. Continue d&apos;utiliser MargoPro gratuitement en attendant.
            </div>
            <button
              onClick={() => setShowModal(false)}
              style={{ width: '100%', height: 50, borderRadius: 14, background: T.accent, color: 'white', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          onClick={() => router.back()}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: T.text, padding: 0, fontFamily: 'Manrope, sans-serif' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={T.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Abonnement
        </button>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 500, color: T.textMuted, fontFamily: 'Manrope, sans-serif' }}>
          Restaurer
        </button>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* STATUT PREMIUM */}
        <div style={{ background: '#FEF9EC', borderRadius: 20, padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#B8860B', display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.8 11.2a1 1 0 01-1 .8H5.8a1 1 0 01-1-.8L3 7z" stroke="#B8860B" strokeWidth="1.6" strokeLinejoin="round"/>
              </svg>
              Premium actif
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Expire dans {joursRestants} jour{joursRestants > 1 ? 's' : ''} · {expiryLabel}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ background: 'white', borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #E6DDD3' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: T.accent }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>1 en attente</span>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#EAF5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="#2E7D46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* FEATURES */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '1px', marginBottom: 12 }}>
            CE QUE VOUS OBTENEZ
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FEATURES.map(f => (
              <div
                key={f.label}
                style={{ background: T.surface, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(28,24,17,0.06)' }}
              >
                <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FeatureIcon name={f.icon} color={f.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{f.label}</div>
                  <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{f.subtitle}</div>
                </div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: '#EAF5EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="#2E7D46" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PLAN GRATUIT */}
        <div style={{ background: T.bgSubtle, borderRadius: 16, padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 12 }}>Plan gratuit inclut :</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FREE_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke={T.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span style={{ fontSize: 14, color: T.textSub }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* BOUTON RENOUVELER */}
        <button
          onClick={() => setShowModal(true)}
          style={{
            width: '100%', height: 54, borderRadius: 16,
            background: 'transparent', border: `2px solid ${T.accent}`,
            color: T.accent, fontSize: 16, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M21 12a9 9 0 01-9 9 9 9 0 01-6.4-2.6L3 16M3 12a9 9 0 019-9 9 9 0 016.4 2.6L21 8" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M21 3v5h-5M3 21v-5h5" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Renouveler (+30 jours)
        </button>

      </div>
    </div>
  );
}
