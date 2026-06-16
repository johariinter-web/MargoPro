'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/lib/hooks/useConfig';

const T = {
  accent: '#D4601A', accentLight: '#FEF0E6',
  green: '#2E7D46', greenBg: '#EAF5EE',
  bg: '#FAF7F3', surface: '#FFFFFF',
  text: '#1C1811', textSub: '#6A5D52', textMuted: '#9E8E84',
  border: '#E6DDD3',
};

const DEVISES = [
  { code: 'XOF', symbole: 'FCFA', nom: "Franc CFA (UEMOA) — Sénégal, Côte d'Ivoire, Mali..." },
  { code: 'XAF', symbole: 'FCFA', nom: 'Franc CFA (CEMAC) — Cameroun, Gabon, Congo...' },
  { code: 'GNF', symbole: 'GNF', nom: 'Franc guinéen — Guinée' },
  { code: 'CDF', symbole: 'FC', nom: 'Franc congolais — RDC' },
  { code: 'MGA', symbole: 'Ar', nom: 'Ariary — Madagascar' },
  { code: 'MAD', symbole: 'MAD', nom: 'Dirham — Maroc' },
  { code: 'TND', symbole: 'TND', nom: 'Dinar — Tunisie' },
];

function _Slide0Ill() {
  return (
    <div style={{ flex: 1, background: 'linear-gradient(155deg,#FFF3E0,#FFE0B2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: 'rgba(212,96,26,0.1)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '0 32px', position: 'relative' }}>
        {[{col:'#D4601A',l:'Huile'},{col:'#2E7D46',l:'Riz'},{col:'#C47A06',l:'Sucre'},{col:'#2E7D46',l:'Fanta'},{col:'#7A5C3A',l:'Sardine'},{col:'#D4601A',l:'Savon'},{col:'#C47A06',l:'Crédit'},{col:'#2E7D46',l:'Eau'},{col:'#D4601A',l:'Tomate'}].map((item,i) => (
          <div key={i} style={{ width: 72, height: 72, borderRadius: 16, background: `${item.col}20`, border: `2px solid ${item.col}35`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: item.col, opacity: 0.7 }}/>
            <span style={{ fontSize: 9, fontWeight: 700, color: item.col }}>{item.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function OnboardingPage() {
  const router = useRouter();
  const { saveConfig } = useConfig();
  const [phase, setPhase] = useState<'slide' | 'form'>('slide');
  const [etape, setEtape] = useState(1);
  const [nomCommerce, setNomCommerce] = useState('');
  const [deviseCode, setDeviseCode] = useState('');
  const [cguAccepte, setCguAccepte] = useState(false);

  async function terminer() {
    const devise = DEVISES.find(d => d.code === deviseCode)!;
    await saveConfig({ nomCommerce, devise: devise.code, symboleDevise: devise.symbole, onboardingComplete: true });
    router.push('/');
  }

  if (phase === 'slide') {
    return (
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: T.bg, overflow: 'hidden' }}>
        {/* Illustration */}
        <div style={{ flex: 1, background: 'linear-gradient(155deg, #FEF0E6, #FDDBB8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 180, height: 120, borderRadius: 18, background: 'rgba(255,255,255,0.85)', border: '2px solid rgba(212,96,26,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, boxShadow: '0 8px 24px rgba(212,96,26,0.12)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="3" height="16" rx="0.5" fill="#D4601A"/>
                <rect x="6.5" y="4" width="1.5" height="16" rx="0.5" fill="#D4601A"/>
                <rect x="9.5" y="4" width="3" height="16" rx="0.5" fill="#D4601A"/>
                <rect x="14" y="4" width="1.5" height="16" rx="0.5" fill="#D4601A"/>
                <rect x="17" y="4" width="1.5" height="16" rx="0.5" fill="#D4601A"/>
                <rect x="20" y="4" width="2" height="16" rx="0.5" fill="#D4601A"/>
              </svg>
              <div style={{ fontSize: 10, color: '#D4601A', fontWeight: 600, fontFamily: '"Space Grotesk", sans-serif' }}>6 294 900 XXXXXX</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'rgba(212,96,26,0.12)', borderRadius: 12, padding: '10px 16px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="#D4601A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#D4601A', fontFamily: 'Manrope, sans-serif' }}>Huile de palme 1L · 2 800 F</span>
            </div>
          </div>
        </div>

        {/* Carte bas */}
        <div style={{ background: T.surface, borderRadius: '24px 24px 0 0', marginTop: -20, padding: '28px 28px 40px', flexShrink: 0 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, letterSpacing: '-0.7px', lineHeight: 1.25, marginBottom: 10 }}>
            Scanne, enregistre,{'\n'}c&apos;est tout
          </h1>
          <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.65, fontWeight: 500, marginBottom: 24 }}>
            Flash le code-barres, choisis la quantité et confirme. La vente est enregistrée.
          </p>
          <button
            onClick={() => setPhase('form')}
            style={{ width: '100%', height: 52, borderRadius: 14, background: T.accent, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', marginBottom: 14 }}
          >
            Suivant
          </button>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => setPhase('form')}
              style={{ fontSize: 13, color: T.textMuted, fontWeight: 500, cursor: 'pointer', background: 'none', border: 'none', borderBottom: `1px solid ${T.border}`, paddingBottom: 2, fontFamily: 'Manrope, sans-serif' }}
            >
              J&apos;ai déjà un compte
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column', padding: '0 0 40px' }}>
      <div style={{ display: 'flex', gap: 8, padding: '20px 24px 0' }}>
        {[1,2,3].map(n => (
          <div key={n} style={{ height: 6, flex: 1, borderRadius: 3, background: n <= etape ? T.accent : T.border, transition: 'background 0.3s' }}/>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 24px 0' }}>

        {etape === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 12, boxShadow: '0 4px 16px rgba(212,96,26,0.2)' }} />
              <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.7px', marginBottom: 8 }}>Bienvenue sur MargoPro</h1>
              <p style={{ fontSize: 15, color: T.textSub, lineHeight: 1.6 }}>Gérez votre commerce simplement, même sans internet.</p>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>Comment s&apos;appelle ton commerce ?</label>
              <input
                type="text"
                value={nomCommerce}
                onChange={e => setNomCommerce(e.target.value)}
                placeholder="Ex: Boutique Aminata"
                autoFocus
                style={{ width: '100%', border: `2px solid ${nomCommerce ? T.accent : T.border}`, borderRadius: 14, padding: '14px 16px', fontSize: 18, fontWeight: 600, color: T.text, background: T.surface, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
              />
            </div>
            <button onClick={() => setEtape(2)} disabled={!nomCommerce.trim()}
              style={{ width: '100%', height: 52, borderRadius: 14, background: T.accent, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: nomCommerce.trim() ? 1 : 0.4, transition: 'opacity 0.2s', fontFamily: 'Manrope, sans-serif' }}>
              Continuer →
            </button>
          </div>
        )}

        {etape === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <p style={{ fontSize: 48, marginBottom: 12 }}>💱</p>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.7px' }}>Quelle devise tu utilises ?</h1>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '45vh', overflowY: 'auto', scrollbarWidth: 'none' as const }}>
              {DEVISES.map(d => (
                <button key={d.code} onClick={() => setDeviseCode(d.code)}
                  style={{ width: '100%', textAlign: 'left', border: `2px solid ${deviseCode === d.code ? T.accent : T.border}`, borderRadius: 14, padding: '14px 16px', background: deviseCode === d.code ? T.accentLight : T.surface, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Manrope, sans-serif' }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: T.text, display: 'block' }}>{d.symbole}</span>
                  <span style={{ fontSize: 12, color: T.textMuted, display: 'block', marginTop: 2 }}>{d.nom}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEtape(1)} style={{ flex: 1, height: 52, borderRadius: 14, border: `2px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>← Retour</button>
              <button onClick={() => setEtape(3)} disabled={!deviseCode} style={{ flex: 2, height: 52, borderRadius: 14, background: T.accent, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: deviseCode ? 1 : 0.4, fontFamily: 'Manrope, sans-serif' }}>Continuer →</button>
            </div>
          </div>
        )}

        {etape === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 12, boxShadow: '0 4px 16px rgba(212,96,26,0.2)' }} />
              <h1 style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.7px' }}>C&apos;est parti, {nomCommerce} !</h1>
              <p style={{ fontSize: 15, color: T.textSub, lineHeight: 1.6, marginTop: 8 }}>Ajoutez votre premier produit pour commencer.</p>
            </div>
            <div style={{ background: T.accentLight, borderRadius: 16, padding: '16px 18px' }}>
              <p style={{ fontWeight: 700, color: T.accent, marginBottom: 10, fontSize: 14 }}>✅ Tout est prêt :</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['📦 Gérez votre stock','💰 Calculez vos marges','📊 Suivez vos ventes','📴 Fonctionne sans internet'].map((item,i) => (
                  <span key={i} style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{item}</span>
                ))}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={cguAccepte} onChange={e => setCguAccepte(e.target.checked)} style={{ marginTop: 2, width: 20, height: 20, accentColor: T.accent, flexShrink: 0 }}/>
              <span style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>
                J&apos;ai lu et j&apos;accepte les <a href="/cgu" style={{ color: T.accent }}>Conditions Générales d&apos;Utilisation</a> de MargoPro.
              </span>
            </label>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setEtape(2)} style={{ flex: 1, height: 52, borderRadius: 14, border: `2px solid ${T.border}`, background: T.surface, color: T.text, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>← Retour</button>
              <button onClick={terminer} disabled={!cguAccepte} style={{ flex: 2, height: 52, borderRadius: 14, background: T.accent, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: cguAccepte ? 1 : 0.4, fontFamily: 'Manrope, sans-serif' }}>Commencer 🎉</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
