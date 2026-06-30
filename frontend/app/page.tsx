'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useConfig } from '@/lib/hooks/useConfig';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { useColors } from '@/lib/hooks/useColors';
import { createClient } from '@/lib/supabase/client';
import BarcodeScanner from '@/components/BarcodeScanner';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function Dashboard() {
  const T = useColors();
  const router = useRouter();
  const { config, isReady } = useConfig();
  const { produits, alertes, total: totalStock } = useStock();
  const { stats, ventes } = useVentes('jour');
  const [authChecked, setAuthChecked] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  function handleScanAccueil(barcode: string) {
    setShowScanner(false);
    sessionStorage.setItem('margopro_scan_barcode', barcode);
    router.push('/ventes');
  }

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/auth');
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  useEffect(() => {
    if (authChecked && isReady && (!config || !config.onboardingComplete)) {
      router.replace('/onboarding');
    }
  }, [authChecked, isReady, config, router]);

  if (!authChecked || !isReady || !config) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: T.bg }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: `3px solid ${T.border}`, borderTopColor: T.accent,
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const symbole = config.symboleDevise;
  const margePercent = stats.chiffreAffaires > 0 ? Math.round(stats.benefice / stats.chiffreAffaires * 100) : 0;

  // Build donut from real today's ventes
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const ventesToday = ventes.filter(v => v.date >= todayStart.getTime());
  const topMap = new Map<string, { nom: string; total: number }>();
  for (const v of ventesToday) {
    const ex = topMap.get(v.produitId) ?? { nom: v.produitNom, total: 0 };
    topMap.set(v.produitId, { nom: ex.nom, total: ex.total + v.total });
  }
  const topArr = Array.from(topMap.values()).sort((a, b) => b.total - a.total);
  const totalCA = topArr.reduce((s, p) => s + p.total, 0);
  const DONUT_COLORS = ['#D4601A', '#2E7D46', '#C47A06', '#9E8E84'];
  const top3 = topArr.slice(0, 3);
  const donutData = top3.map((p, i) => ({
    l: p.nom.length > 12 ? p.nom.slice(0, 12) + '…' : p.nom,
    p: totalCA > 0 ? Math.round(p.total / totalCA * 100) : 0,
    c: DONUT_COLORS[i],
  }));
  if (topArr.length > 3 && totalCA > 0) {
    const autresPct = 100 - donutData.reduce((s, d) => s + d.p, 0);
    if (autresPct > 0) donutData.push({ l: 'Autres', p: autresPct, c: DONUT_COLORS[3] });
  }
  const hasDonutData = donutData.length > 0;

  // Build conic-gradient from percentages
  let cumDeg = 0;
  const conicStops = donutData.map(d => {
    const deg = (d.p / 100) * 360;
    const stop = `${d.c} ${cumDeg}deg ${cumDeg + deg}deg`;
    cumDeg += deg;
    return stop;
  }).join(',');

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 90 }}>
      {showScanner && (
        <BarcodeScanner onScan={handleScanAccueil} onClose={() => setShowScanner(false)} />
      )}

      {/* HEADER */}
      <div style={{ padding: '12px 18px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '-0.5px', fontFamily: 'Manrope, sans-serif' }}>
              Accueil
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, fontFamily: 'Manrope, sans-serif', marginTop: 1 }}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link href="/abonnement" style={{ textDecoration: 'none' }}>
            <div style={{
              height: 32, borderRadius: 20, padding: '0 12px',
              background: T.accent, color: 'white',
              fontSize: 12, fontWeight: 800, letterSpacing: '0.3px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Manrope, sans-serif',
            }}>
              Abonnement
            </div>
          </Link>
          <Link href="/parametres" style={{ textDecoration: 'none' }}>
            <button style={{
              width: 40, height: 40, borderRadius: 12, background: T.bgSubtle,
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" stroke={T.textSub} strokeWidth="1.75"/>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={T.textSub} strokeWidth="1.75"/>
              </svg>
            </button>
          </Link>
          <Link href="/alertes" style={{ textDecoration: 'none' }}>
            <button style={{
              width: 40, height: 40, borderRadius: 12, background: T.bgSubtle,
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={T.textSub} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {alertes.length > 0 && (
                <span style={{
                  position: 'absolute', top: 8, right: 8, width: 8, height: 8,
                  borderRadius: '50%', background: T.red,
                  boxShadow: `0 0 0 2px ${T.bgSubtle}`,
                }} />
              )}
            </button>
          </Link>
        </div>
      </div>

      {/* SCROLLABLE CONTENT */}
      <div style={{ padding: '0 14px 12px', overflowY: 'auto', scrollbarWidth: 'none' }}>

        {/* KPI GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>

          {/* Card 1 - CA du jour */}
          <div style={{ background: T.surface, borderRadius: 16, padding: '14px 14px 12px', boxShadow: T.shadow }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Manrope, sans-serif' }}>
              CA DU JOUR
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-1.2px', lineHeight: 1 }}>
              {fmtF(stats.chiffreAffaires)} <span style={{ fontSize: 14 }}>{symbole}</span>
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 5, fontFamily: 'Manrope, sans-serif' }}>
              {stats.nombreVentes} vente{stats.nombreVentes !== 1 ? 's' : ''} aujourd&apos;hui
            </div>
          </div>

          {/* Card 2 - Bénéfice */}
          <div style={{ background: T.greenBg, borderRadius: 16, padding: '14px 14px 12px', boxShadow: T.shadow }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Manrope, sans-serif' }}>
              BÉNÉFICE
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.green, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-1.2px', lineHeight: 1 }}>
              {fmtF(stats.benefice)} <span style={{ fontSize: 14 }}>{symbole}</span>
            </div>
            <div style={{ fontSize: 11, color: T.green, fontWeight: 600, marginTop: 5, fontFamily: 'Manrope, sans-serif' }}>
              Marge {margePercent}%
            </div>
          </div>

          {/* Card 3 - Ventes */}
          <div style={{ background: T.accentLight, borderRadius: 16, padding: '14px 14px 12px', boxShadow: T.shadow }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Manrope, sans-serif' }}>
              VENTES
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-1.2px', lineHeight: 1 }}>
              {stats.nombreVentes}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 5, fontFamily: 'Manrope, sans-serif' }}>
              aujourd&apos;hui
            </div>
          </div>

          {/* Card 4 - Stock total */}
          <div style={{ background: T.surface, borderRadius: 16, padding: '14px 14px 12px', boxShadow: T.shadow }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 6, fontFamily: 'Manrope, sans-serif' }}>
              STOCK
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-1.2px', lineHeight: 1 }}>
              {fmtF(totalStock)}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 5, fontFamily: 'Manrope, sans-serif', color: alertes.length > 0 ? T.red : T.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
              {alertes.length > 0 ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {alertes.length} alertes
                </>
              ) : `${produits.length} produits`}
            </div>
          </div>
        </div>

        {/* PIE CHART CARD */}
        <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
              Top produits
            </span>
            <span style={{ fontSize: 12, color: T.textMuted, fontFamily: 'Manrope, sans-serif' }}>
              Aujourd&apos;hui
            </span>
          </div>
          {hasDonutData ? (
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 12 }}>
              {/* Donut */}
              <div style={{
                width: 96, height: 96, borderRadius: '50%', flexShrink: 0,
                background: `conic-gradient(${conicStops})`,
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', inset: 18, borderRadius: '50%', background: T.surface }} />
              </div>
              {/* Legend */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {donutData.map(d => (
                  <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: d.c, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>{d.l}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{d.p}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px 0 8px', color: T.textMuted, fontSize: 13, fontFamily: 'Manrope, sans-serif' }}>
              Aucune vente enregistrée aujourd&apos;hui
            </div>
          )}
          <div
            onClick={() => router.push('/ventes')}
            style={{ fontSize: 13, color: T.accent, fontWeight: 700, textAlign: 'right', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
          >
            Voir rapport complet →
          </div>
        </div>

        {/* CTA BUTTONS */}
        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button
            onClick={() => router.push('/ventes')}
            style={{
              flex: 1, height: 52, borderRadius: 14, background: T.accent,
              color: 'white', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Nouvelle vente
          </button>
          <button
            onClick={() => setShowScanner(true)}
            style={{
              width: 52, height: 52, borderRadius: 14, background: T.bgSubtle,
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={T.textSub} strokeWidth="1.75" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="4" stroke={T.textSub} strokeWidth="1.75"/>
            </svg>
          </button>
        </div>

      </div>
    </div>
  );
}
