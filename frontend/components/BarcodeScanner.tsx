'use client';

import { useEffect, useRef, useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

const SCANNER_ID = 'barcode-scanner-container';

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const T = useColors();
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [erreur, setErreur] = useState('');
  const [scanning, setScanning] = useState(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      const scanner = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = scanner;

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 100 } },
        (decodedText: string) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          scanner.stop().catch(() => {}).finally(() => onScan(decodedText));
        },
        () => {}
      )
        .then(() => setScanning(true))
        .catch(() => setErreur("Impossible d'accéder à la caméra.\nVérifiez que vous avez accordé les autorisations."));
    });

    return () => {
      scannerRef.current?.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(28,24,17,0.9)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Manrope, sans-serif',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: T.surface, borderRadius: 24, overflow: 'hidden',
        width: 'min(360px, 94vw)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px 12px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 9V6a1 1 0 011-1h3M3 15v3a1 1 0 001 1h3M15 5h3a1 1 0 011 1v3M15 19h3a1 1 0 001-1v-3" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round"/>
              <rect x="7" y="8" width="2" height="8" rx="1" fill={T.text}/>
              <rect x="11" y="8" width="1" height="8" rx="0.5" fill={T.text}/>
              <rect x="14" y="8" width="3" height="8" rx="1" fill={T.text}/>
            </svg>
            <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Scanner un code-barres</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 24, color: T.textMuted, lineHeight: 1, padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>

        {erreur ? (
          <div style={{ padding: '20px 20px 28px', textAlign: 'center' }}>
            <div style={{
              background: T.redBg, borderRadius: 12, padding: '14px 16px', marginBottom: 16,
              fontSize: 13, color: T.red, fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-line',
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
            <div
              id={SCANNER_ID}
              style={{ width: '100%', background: '#000' }}
            />
            <div style={{
              padding: '12px 20px 18px', textAlign: 'center',
              fontSize: 13, color: T.textMuted, fontWeight: 600,
            }}>
              {scanning ? 'Pointez vers le code-barres du produit' : 'Initialisation de la caméra...'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
