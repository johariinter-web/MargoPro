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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doneRef = useRef(false);
  const [erreur, setErreur] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let active = true;

    function stopAll() {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    async function start() {
      // 1. Vérifier la disponibilité de BarcodeDetector
      if (!('BarcodeDetector' in window)) {
        setErreur(
          'Scan non disponible sur ce navigateur.\n' +
          'Sur iPhone : mettez iOS à jour (17.4+) ou saisissez le code à la main.'
        );
        return;
      }

      // 2. Demander l'accès à la caméra
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        if (active) setErreur(
          "Impossible d'accéder à la caméra.\n" +
          'Sur iPhone : Réglages → Safari → Caméra → Autoriser.'
        );
        return;
      }

      if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;

      // 3. Attendre que la vidéo soit prête (metadata + premier frame)
      await new Promise<void>(resolve => {
        video.onloadedmetadata = () => video.play().then(resolve).catch(resolve);
      });

      if (!active) return;
      setScanning(true);

      // 4. Construire le détecteur avec les formats disponibles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BD = (window as any).BarcodeDetector;
      let formats: string[];
      try {
        const supported: string[] = await BD.getSupportedFormats();
        const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
        formats = wanted.filter(f => supported.includes(f));
        if (formats.length === 0) formats = supported; // fallback : tout ce qui est dispo
      } catch {
        formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
      }

      let detector: { detect: (src: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>> };
      try {
        detector = new BD({ formats });
      } catch {
        if (active) setErreur('Impossible d\'initialiser le détecteur de codes-barres.');
        return;
      }

      // 5. Boucle de détection via canvas (plus fiable que passer la vidéo directement)
      async function tick() {
        if (!active || doneRef.current) return;

        const vid = videoRef.current;
        const cvs = canvasRef.current;
        if (!vid || !cvs || vid.readyState < 2 || vid.videoWidth === 0) {
          timerRef.current = setTimeout(tick, 100);
          return;
        }

        cvs.width = vid.videoWidth;
        cvs.height = vid.videoHeight;
        const ctx = cvs.getContext('2d');
        if (!ctx) { timerRef.current = setTimeout(tick, 200); return; }

        ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);

        try {
          const results = await detector.detect(cvs);
          if (results.length > 0 && !doneRef.current && active) {
            doneRef.current = true;
            stopAll();
            onScan(results[0].rawValue);
            return;
          }
        } catch { /* frame non lisible, on réessaie */ }

        if (active) timerRef.current = setTimeout(tick, 200);
      }

      // Démarrer après 500ms pour laisser la caméra se stabiliser
      timerRef.current = setTimeout(tick, 500);
    }

    start();
    return () => { active = false; stopAll(); };
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
                style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }}
              />
              {/* Canvas caché — sert à la détection */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {/* Viseur */}
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: 220, height: 80, borderRadius: 8,
                  border: `2px solid ${T.accent}`,
                  boxShadow: '0 0 0 2000px rgba(0,0,0,0.35)',
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
