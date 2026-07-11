'use client';

import { useState, useEffect, useCallback } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import { createClient } from '@/lib/supabase/client';
import {
  getOrCreateAffiliate,
  updateRecompense,
  fetchAffiliatePaiements,
  computeCommissionSolde,
  computeMoisGratuitProgress,
  type Affiliate,
  type RecompenseType,
} from '@/lib/parrainage';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function Parrainage() {
  const T = useColors();
  const { config } = useConfig();
  const [affiliate, setAffiliate] = useState<Affiliate | null>(null);
  const [solde, setSolde] = useState(0);
  const [progression, setProgression] = useState({ filleulsPayants: 0, moisDus: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
  const [ouvert, setOuvert] = useState(false);

  const charger = useCallback(async () => {
    if (!config?.nomCommerce) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const a = await getOrCreateAffiliate(supabase, data.user.id, config.nomCommerce);
      setAffiliate(a);

      const paiements = await fetchAffiliatePaiements(supabase, a.id);
      setSolde(computeCommissionSolde(paiements));
      setProgression(computeMoisGratuitProgress(paiements, a.mois_gratuits_accordes));
      setError(null);
    } catch {
      setError('Impossible de charger le parrainage. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, [config?.nomCommerce]);

  useEffect(() => { charger(); }, [charger]);

  async function choisirRecompense(recompense: RecompenseType) {
    if (!affiliate) return;
    try {
      const supabase = createClient();
      await updateRecompense(supabase, affiliate.id, recompense);
      setAffiliate({ ...affiliate, recompense });
      setError(null);
    } catch {
      setError('Erreur lors de la sauvegarde. Réessayez.');
    }
  }

  function copierCode() {
    if (!affiliate) return;
    navigator.clipboard.writeText(affiliate.code).then(() => {
      setCopie(true);
      setTimeout(() => setCopie(false), 1500);
    }).catch(() => {
      setError('Impossible de copier le code.');
    });
  }

  function partagerWhatsApp() {
    if (!affiliate) return;
    const texte = `Je gère mon commerce avec MargoPro, l'appli qui suit stock, ventes et marges. Inscris-toi avec mon code ${affiliate.code} : https://eidma.co/?ref=${affiliate.code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texte)}`, '_blank');
  }

  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: T.textMuted,
        marginBottom: 6, paddingLeft: 4,
        fontFamily: 'Manrope, sans-serif',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Parrainage
      </div>
      <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>

        <button
          onClick={() => setOuvert(o => !o)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 16, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
            Programme de parrainage
          </span>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            style={{ flexShrink: 0, transform: ouvert ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          >
            <path d="M6 9l6 6 6-6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {ouvert && (
        <div style={{ padding: '0 16px 16px' }}>

        {loading && (
          <div style={{ textAlign: 'center', color: T.textMuted, fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>
            Chargement…
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', margin: '0 -16px 12px', color: T.red, fontSize: 13, fontFamily: 'Manrope, sans-serif', background: T.redBg }}>
            {error}
          </div>
        )}

        {!loading && affiliate && (
          <>
            <p style={{ fontSize: 13, color: T.textSub, marginTop: 0, marginBottom: 12, fontFamily: 'Manrope, sans-serif' }}>
              Partagez votre code. Vous gagnez une récompense pour chaque commerçant qui s&apos;abonne grâce à vous.
            </p>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.accentLight, borderRadius: 12, padding: '12px 14px', marginBottom: 12,
            }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: T.accent, letterSpacing: '1px', fontFamily: '"Space Grotesk", sans-serif' }}>
                {affiliate.code}
              </span>
              <button
                onClick={copierCode}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 9, border: 'none',
                  background: copie ? T.green : T.accent, color: 'white',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                }}
              >
                {copie ? 'Copié' : 'Copier'}
              </button>
            </div>

            <button
              onClick={partagerWhatsApp}
              style={{
                width: '100%', height: 44, borderRadius: 12, border: 'none',
                background: T.green, color: 'white', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'Manrope, sans-serif', marginBottom: 16,
              }}
            >
              Partager via WhatsApp
            </button>

            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}>
              Votre récompense
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['mois_gratuit', 'commission'] as RecompenseType[]).map(r => (
                <button
                  key={r}
                  onClick={() => choisirRecompense(r)}
                  style={{
                    flex: 1, textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${affiliate.recompense === r ? T.accent : T.border}`,
                    background: affiliate.recompense === r ? T.accentLight : T.bg,
                    fontFamily: 'Manrope, sans-serif',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                    {r === 'mois_gratuit' ? '1 mois gratuit' : 'Commission 15%'}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                    {r === 'mois_gratuit' ? 'Tous les 4 filleuls payants' : 'Chaque mois, 12 mois max'}
                  </div>
                </button>
              ))}
            </div>

            {affiliate.recompense === 'commission' && (
              <div style={{ background: T.greenBg, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: 'Manrope, sans-serif' }}>
                  Solde de commission : {fmtF(solde)} FCFA
                </span>
              </div>
            )}

            {affiliate.recompense === 'mois_gratuit' && (
              <div style={{ background: T.greenBg, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.green, fontFamily: 'Manrope, sans-serif' }}>
                  {progression.filleulsPayants % 4} / 4 filleuls payants vers le prochain mois gratuit
                </span>
              </div>
            )}

            <a
              href={`https://eidma.co/parrainage.html?code=${affiliate.code}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: T.accent, fontWeight: 600, fontFamily: 'Manrope, sans-serif', textDecoration: 'underline' }}
            >
              Voir le suivi complet →
            </a>
          </>
        )}
        </div>
        )}
      </div>
    </div>
  );
}
