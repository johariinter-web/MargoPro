'use client';

import { useEffect, useRef, useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const T = useColors();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [erreur, setErreur] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (!active || !videoRef.current) return;

        const reader = new BrowserMultiFormatReader();

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current,
          (result) => {
            if (!active || !result) return;
            active = false;
            controls.stop();
            onScan(result.getText());
          }
        );

        stopRef.current = () => controls.stop();
        if (active) setScanning(true);

      } catch (err: unknown) {
        if (!active) return;
        const name = err instanceof Error ? err.name : '';
        if (name === 'NotAllowedError') {
          setErreur(
            "Impossible d'accéder à la caméra.\n" +
            'Sur iPhone : Réglages → Safari → Caméra → Autoriser.'
          );
        } else {
          setErreur('Impossible de démarrer le scanner. Essayez de recharger la page.');
        }
      }
    }

    start();

    return () => {
      active = false;
      stopRef.current?.();
    };
  }, [onScan]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(28,24,17,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: T.surface, borderRadius: 24, overflow: 'hidden', width: 'min(360px, 94vw)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3M15 5h3a1 1 0 011 1v3M15 19h3a1 1 0 001-1v-3"
                stroke={T.accent} strokeWidth="1.75" strokeLinecap="round"/>
              <rect x="7" y="8" width="2" height="8" rx="1" fill={T.text}/>
              <rect x="11" y="8" width="1" height="8" rx="0.5" fill={T.text}/>
              <rect x="14" y="8" width="3" height="8" rx="1" fill={T.text}/>
            </svg>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Scanner un code-barres</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 24, color: T.textMuted, lineHeight: 1, padding: '0 2px' }}
          >
            ×
          </button>
        </div>

        {erreur ? (
          <div style={{ padding: '20px 20px 28px', textAlign: 'center' }}>
            <div style={{
              background: T.redBg, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
              fontSize: 13, color: T.red, fontWeight: 600, lineHeight: 1.6, whiteSpace: 'pre-line',
            }}>
              {erreur}
            </div>
            <button
              onClick={onClose}
              style={{
                height: 44, borderRadius: 12, background: T.accent,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                color: 'white', padding: '0 24px',
              }}
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div style={{ position: 'relative', width: '100%', background: '#000', minHeight: 200 }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={{ width: '100%', display: 'block', maxHeight: 340, objectFit: 'cover' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: '82%', height: 130, borderRadius: 10,
                  border: `3px solid ${T.accent}`,
                  boxShadow: '0 0 0 2000px rgba(0,0,0,0.45)',
                }} />
              </div>
            </div>
            <div style={{ padding: '12px 20px 18px', textAlign: 'center', fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
              {scanning ? 'Pointez vers le code-barres du produit' : 'Initialisation de la caméra…'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
