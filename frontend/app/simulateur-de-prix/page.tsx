'use client';

import { useState } from 'react';
import { calculerPrixVente } from '@backend/marge';

const T = {
  accent: '#D4601A',
  accentLight: '#FEF0E6',
  bg: '#FAF7F3',
  surface: '#FFFFFF',
  bgSubtle: '#F3EDE5',
  text: '#1C1811',
  textSub: '#6A5D52',
  textMuted: '#9E8E84',
  border: '#E6DDD3',
  green: '#2E7D46',
};

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function SimulateurDePrixPage() {
  const [prixAchat, setPrixAchat] = useState('');
  const [margePctStr, setMargePctStr] = useState('30');
  const margePct = Math.min(1000, Math.max(0, Number(margePctStr) || 0));

  const prixAchatNum = parseFloat(prixAchat) || 0;
  const prixVenteCalc = prixAchatNum > 0 ? calculerPrixVente(prixAchatNum, margePct) : 0;
  const beneficeCalc = prixVenteCalc - prixAchatNum;

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, fontFamily: 'Manrope, sans-serif', paddingBottom: 48 }}>

      {/* HEADER */}
      <div style={{ padding: '32px 20px 8px', textAlign: 'center' }}>
        <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 64, height: 64, borderRadius: 16, boxShadow: '0 4px 16px rgba(212,96,26,0.18)', marginBottom: 12 }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, letterSpacing: '0.4px' }}>MargoPro</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.text, margin: '6px 0 4px' }}>Simulateur de prix de vente</h1>
        <p style={{ fontSize: 13, color: T.textMuted, margin: 0, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
          Connais ton prix de vente et ton bénéfice en quelques secondes. Gratuit, sans inscription.
        </p>
      </div>

      <div style={{ padding: '16px 20px 0', maxWidth: 420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* CALCULATEUR */}
        <div style={{ background: T.surface, borderRadius: 20, padding: 16, boxShadow: '0 1px 3px rgba(28,24,17,0.06), 0 4px 14px rgba(28,24,17,0.05)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
            Calculateur
          </div>

          {/* Prix d'achat */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>
              Prix d&apos;achat (FCFA)
            </div>
            <div style={{ background: T.bgSubtle, borderRadius: 12, padding: '12px 16px' }}>
              <input
                type="number" onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()}
                value={prixAchat}
                onChange={e => setPrixAchat(e.target.value)}
                placeholder="0"
                min="0"
                style={{
                  width: '100%', border: 'none', background: 'transparent',
                  fontSize: 28, fontWeight: 800, color: T.text,
                  outline: 'none', fontFamily: '"Space Grotesk", sans-serif',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Marge souhaitée */}
          <div style={{ marginBottom: prixVenteCalc > 0 ? 14 : 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Marge souhaitée</div>
              <div style={{
                background: T.bgSubtle, borderRadius: 10, padding: '6px 12px',
                display: 'flex', alignItems: 'center', gap: 3,
              }}>
                <input
                  type="number" onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()}
                  min={0}
                  max={1000}
                  value={margePctStr}
                  onChange={e => setMargePctStr(e.target.value)}
                  style={{
                    width: 52, border: 'none', background: 'transparent',
                    fontSize: 16, fontWeight: 800, color: T.accent,
                    fontFamily: '"Space Grotesk", sans-serif',
                    outline: 'none', textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>%</span>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={margePct}
              onChange={e => setMargePctStr(e.target.value)}
              style={{ width: '100%', accentColor: T.accent }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textMuted, marginTop: 4 }}>
              <span>0%</span>
              <span>250%</span>
              <span>500%</span>
              <span>1000%+</span>
            </div>
          </div>

          {/* Résultat */}
          {prixVenteCalc > 0 && (
            <div style={{ background: T.accentLight, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Prix de vente conseillé</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                  {fmtF(prixVenteCalc)} <span style={{ fontSize: 13 }}>FCFA</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Bénéfice par unité</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T.green, fontFamily: '"Space Grotesk", sans-serif' }}>
                  +{fmtF(beneficeCalc)} <span style={{ fontSize: 13 }}>FCFA</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* LIMITE + APPEL A L'ACTION */}
        <div style={{ background: T.surface, borderRadius: 20, padding: 18, boxShadow: '0 1px 3px rgba(28,24,17,0.06), 0 4px 14px rgba(28,24,17,0.05)', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: T.textSub, lineHeight: 1.6, margin: '0 0 14px' }}>
            Ce calcul ne tient pas compte de tes vraies charges (loyer, transport...). <strong style={{ color: T.text }}>MargoPro</strong> calcule ta vraie marge plancher automatiquement, à partir de tes vraies ventes — et suit ton stock au quotidien.
          </p>
          <a
            href="/auth"
            style={{
              display: 'inline-block', width: '100%', height: 48, lineHeight: '48px',
              borderRadius: 14, background: T.accent, color: '#fff',
              fontSize: 15, fontWeight: 700, textDecoration: 'none',
              boxSizing: 'border-box',
            }}
          >
            Essayer MargoPro gratuitement
          </a>
        </div>
      </div>
    </div>
  );
}
