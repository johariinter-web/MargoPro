'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/lib/hooks/useConfig';
import { createClient } from '@/lib/supabase/client';
import { consumeReferralCode } from '@/lib/parrainage';

const T = {
  accent: '#D4601A', accentLight: '#FEF0E6',
  bg: '#FAF7F3', surface: '#FFFFFF',
  text: '#1C1811', textSub: '#6A5D52',
  border: '#E6DDD3',
};

const DEVISES = [
  { code: 'XOF', symbole: 'FCFA', libelle: "FCFA (UEMOA — Sénégal, Côte d'Ivoire, Mali...)" },
  { code: 'XAF', symbole: 'FCFA', libelle: 'FCFA (CEMAC — Cameroun, Gabon, Congo...)' },
  { code: 'GNF', symbole: 'GNF', libelle: 'GNF — Guinée' },
  { code: 'CDF', symbole: 'FC', libelle: 'FC — RDC' },
  { code: 'MGA', symbole: 'Ar', libelle: 'Ar — Madagascar' },
  { code: 'MAD', symbole: 'MAD', libelle: 'MAD — Maroc' },
  { code: 'TND', symbole: 'TND', libelle: 'TND — Tunisie' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { saveConfig } = useConfig();
  const [nomCommerce, setNomCommerce] = useState('');
  const [deviseCode, setDeviseCode] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (active && data.user) {
          await consumeReferralCode(supabase, data.user.id, 'Filleul');
        }
      } catch {
        // Réseau absent ou Supabase indisponible : ne pas bloquer le démarrage.
      }
    })();
    return () => { active = false; };
  }, []);

  async function terminer() {
    const devise = DEVISES.find(d => d.code === deviseCode)!;
    await saveConfig({ nomCommerce, devise: devise.code, symboleDevise: devise.symbole, onboardingComplete: true });
    router.push('/');
  }

  const pretAContinuer = nomCommerce.trim() !== '' && deviseCode !== '';

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column', padding: '0 0 40px' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 24px 0' }}>
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

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 8 }}>Quelle devise tu utilises ?</label>
            <select
              value={deviseCode}
              onChange={e => setDeviseCode(e.target.value)}
              style={{ width: '100%', border: `2px solid ${deviseCode ? T.accent : T.border}`, borderRadius: 14, padding: '14px 16px', fontSize: 16, fontWeight: 600, color: deviseCode ? T.text : T.textSub, background: T.surface, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' as const, transition: 'border-color 0.2s' }}
            >
              <option value="" disabled>Choisis ta devise</option>
              {DEVISES.map(d => (
                <option key={d.code} value={d.code}>{d.libelle}</option>
              ))}
            </select>
          </div>

          <button onClick={terminer} disabled={!pretAContinuer}
            style={{ width: '100%', height: 52, borderRadius: 14, background: T.accent, color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: pretAContinuer ? 1 : 0.4, transition: 'opacity 0.2s', fontFamily: 'Manrope, sans-serif' }}>
            Commencer
          </button>
        </div>
      </div>
    </div>
  );
}
