'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/lib/hooks/useConfig';
import { useStock } from '@/lib/hooks/useStock';
import { useColors, setDarkMode, isDarkMode, Colors } from '@/lib/hooks/useColors';
import { useSync } from '@/lib/hooks/useSync';
import { createClient } from '@/lib/supabase/client';

function tempsRelatif(ts: number | null): string {
  if (!ts) return 'jamais';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

const DEVISES = [
  { code: 'XOF', symbole: 'FCFA', nom: 'Franc CFA (UEMOA)', pays: 'Sénégal, Côte d\'Ivoire, Mali…' },
  { code: 'XAF', symbole: 'FCFA', nom: 'Franc CFA (CEMAC)', pays: 'Cameroun, Gabon, Congo…' },
  { code: 'GNF', symbole: 'GNF', nom: 'Franc guinéen', pays: 'Guinée' },
  { code: 'CDF', symbole: 'FC', nom: 'Franc congolais', pays: 'RDC' },
  { code: 'MGA', symbole: 'Ar', nom: 'Ariary', pays: 'Madagascar' },
  { code: 'MAD', symbole: 'MAD', nom: 'Dirham', pays: 'Maroc' },
  { code: 'TND', symbole: 'TND', nom: 'Dinar', pays: 'Tunisie' },
];

type Panel = 'boutique' | 'devise' | null;

function ChevronRight({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M9 18l6-6-6-6" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

interface RowProps {
  T: Colors;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  badge?: React.ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  divider?: boolean;
  toggle?: boolean;
  toggleOn?: boolean;
  onToggle?: () => void;
}

function Row({ T, iconBg, iconColor, icon, label, subtitle, badge, onPress, showChevron = true, divider = true, toggle, toggleOn, onToggle }: RowProps) {
  return (
    <div
      onClick={toggle ? undefined : onPress}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        cursor: onPress && !toggle ? 'pointer' : 'default',
        borderBottom: divider ? `1px solid ${T.border}` : 'none',
        background: T.surface,
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ color: iconColor }}>{icon}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: 'Manrope, sans-serif' }}>{label}</div>
        {subtitle && (
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'Manrope, sans-serif' }}>
            {subtitle}
          </div>
        )}
      </div>
      {badge && <div>{badge}</div>}
      {toggle ? (
        <div
          onClick={onToggle}
          style={{
            width: 44, height: 26, borderRadius: 13, flexShrink: 0, cursor: 'pointer',
            background: toggleOn ? T.accent : T.border,
            position: 'relative', transition: 'background 0.2s',
          }}
        >
          <div style={{
            position: 'absolute', top: 3, left: toggleOn ? 21 : 3,
            width: 20, height: 20, borderRadius: '50%', background: 'white',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
          }} />
        </div>
      ) : (
        showChevron && <ChevronRight color={T.textMuted} />
      )}
    </div>
  );
}

export default function ParametresPage() {
  const T = useColors();
  const router = useRouter();
  const { config, saveConfig } = useConfig();
  const { alertes } = useStock();
  const { status: syncStatus, lastSyncAt, syncNow } = useSync();

  const syncSousTitre =
    syncStatus === 'syncing' ? 'Synchronisation en cours…'
    : syncStatus === 'offline' ? 'Hors ligne — synchro au retour du réseau'
    : syncStatus === 'error' ? 'Échec — appuyez pour réessayer'
    : `Synchronisé ${tempsRelatif(lastSyncAt)}`;

  const [openPanel, setOpenPanel] = useState<Panel>(null);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  async function seDeconnecter() {
    setDeconnexionEnCours(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  }
  const [nomCommerce, setNomCommerce] = useState(config?.nomCommerce ?? '');
  const [deviseCode, setDeviseCode] = useState(config?.devise ?? '');
  const [notifs, setNotifs] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDarkMode());
    const handler = () => setDark(isDarkMode());
    window.addEventListener('margopro-theme-change', handler);
    return () => window.removeEventListener('margopro-theme-change', handler);
  }, []);

  const nomInitial = (config?.nomCommerce ?? '?').charAt(0).toUpperCase();
  const deviseCourante = DEVISES.find(d => d.code === config?.devise);

  function togglePanel(panel: Panel) {
    setOpenPanel(p => p === panel ? null : panel);
    if (panel === 'boutique') setNomCommerce(config?.nomCommerce ?? '');
    if (panel === 'devise') setDeviseCode(config?.devise ?? '');
  }

  async function saveBoutique() {
    if (!nomCommerce.trim()) return;
    await saveConfig({
      nomCommerce: nomCommerce.trim(),
      devise: config?.devise ?? '',
      symboleDevise: config?.symboleDevise ?? '',
      onboardingComplete: true,
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpenPanel(null); }, 1200);
  }

  async function saveDevise() {
    const d = DEVISES.find(d => d.code === deviseCode);
    if (!d) return;
    await saveConfig({
      nomCommerce: config?.nomCommerce ?? '',
      devise: d.code,
      symboleDevise: d.symbole,
      onboardingComplete: true,
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpenPanel(null); }, 1200);
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 90, fontFamily: 'Manrope, sans-serif' }}>

      {/* HEADER */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: 10, background: T.bgSubtle,
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={T.text} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Réglages</span>
      </div>

      {/* PROFILE CARD */}
      <div style={{ margin: '6px 16px 14px', background: T.surface, borderRadius: 16, padding: '14px 16px', boxShadow: T.shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${T.accent}, #C47A06)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'white', fontFamily: '"Space Grotesk", sans-serif' }}>
              {nomInitial}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
                {config?.nomCommerce ?? 'Mon commerce'}
              </span>
              <span style={{
                background: T.greenBg, color: T.green,
                fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 8px', flexShrink: 0,
              }}>
                actif
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
              {deviseCourante?.nom ?? config?.symboleDevise ?? '—'} · MargoPro
            </div>
          </div>
          <ChevronRight color={T.textMuted} />
        </div>

        {alertes.length > 0 && (
          <div
            onClick={() => router.push('/alertes')}
            style={{
              marginTop: 10, padding: '10px 12px', background: T.redBg,
              borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke={T.red} strokeWidth="1.75" strokeLinejoin="round"/>
                <line x1="12" y1="9" x2="12" y2="13" stroke={T.red} strokeWidth="1.75" strokeLinecap="round"/>
                <line x1="12" y1="17" x2="12.01" y2="17" stroke={T.red} strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.red }}>
                {alertes.length} alerte{alertes.length > 1 ? 's' : ''} stock bas
              </span>
            </div>
            <ChevronRight color={T.red} />
          </div>
        )}
      </div>

      {/* GROUP 1 : Commerce */}
      <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
        <Row
          T={T}
          iconBg={T.accentLight} iconColor={T.accent}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
              <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round"/>
            </svg>
          }
          label="Profil boutique"
          subtitle={config?.nomCommerce ? `Nom : ${config.nomCommerce}` : 'Configurer votre boutique'}
          onPress={() => togglePanel('boutique')}
        />

        {openPanel === 'boutique' && (
          <div style={{ padding: '0 16px 16px', background: T.bg }}>
            <div style={{ marginBottom: 10, marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
                Nom du commerce
              </label>
              <input
                type="text"
                value={nomCommerce}
                onChange={e => setNomCommerce(e.target.value)}
                placeholder="Ex: Boutique Aminata"
                style={{
                  width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
                  fontSize: 14, color: T.text, background: T.surface, outline: 'none',
                  fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              onClick={saveBoutique}
              disabled={!nomCommerce.trim()}
              style={{
                width: '100%', height: 44, borderRadius: 12, background: saved ? T.green : T.accent,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white',
                opacity: !nomCommerce.trim() ? 0.4 : 1, transition: 'background 0.2s',
              }}
            >
              {saved ? '✓ Sauvegardé' : 'Enregistrer'}
            </button>
          </div>
        )}

        <Row
          T={T}
          iconBg={T.greenBg} iconColor={T.green}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75"/>
              <path d="M12 6v12M9 8.5C9 7.12 10.34 6 12 6s3 1.12 3 2.5S13.66 11 12 11s-3 1.12-3 2.5S10.34 17 12 17s3-1.12 3-2.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          }
          label="Devise"
          subtitle={deviseCourante ? `${deviseCourante.nom}` : 'Choisir une devise'}
          onPress={() => togglePanel('devise')}
          divider={false}
        />

        {openPanel === 'devise' && (
          <div style={{ padding: '0 16px 16px', background: T.bg }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, marginBottom: 10 }}>
              {DEVISES.map(d => (
                <button
                  key={d.code}
                  onClick={() => setDeviseCode(d.code)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1.5px solid ${deviseCode === d.code ? T.accent : T.border}`,
                    background: deviseCode === d.code ? T.accentLight : T.surface,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{d.symbole} — {d.nom}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>{d.pays}</div>
                  </div>
                  {deviseCode === d.code && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M20 6L9 17l-5-5" stroke={T.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={saveDevise}
              disabled={!deviseCode}
              style={{
                width: '100%', height: 44, borderRadius: 12, background: saved ? T.green : T.accent,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white',
                opacity: !deviseCode ? 0.4 : 1, transition: 'background 0.2s',
              }}
            >
              {saved ? '✓ Sauvegardé' : 'Enregistrer'}
            </button>
          </div>
        )}
      </div>

      {/* GROUP 2 : Préférences */}
      <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
        <Row
          T={T}
          iconBg={T.blueBg} iconColor={T.blue}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75"/>
              <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" strokeWidth="1.75"/>
            </svg>
          }
          label="Langue"
          subtitle="Français"
          showChevron={false}
        />
        <Row
          T={T}
          iconBg={T.purpleBg} iconColor={T.purple}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75"/>
              <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          }
          label="Apparence"
          subtitle={dark ? 'Thème sombre activé' : 'Thème clair'}
          toggle
          toggleOn={dark}
          onToggle={() => setDarkMode(!dark)}
          divider={false}
        />
      </div>

      {/* GROUP 3 : Système */}
      <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
        <Row
          T={T}
          iconBg={T.blueBg} iconColor={T.blue}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 16V9M9 12l3-3 3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="Synchronisation"
          subtitle={syncSousTitre}
          onPress={syncStatus === 'syncing' ? undefined : syncNow}
          badge={
            <span style={{
              width: 9, height: 9, borderRadius: '50%', display: 'block',
              background:
                syncStatus === 'syncing' ? T.amber
                : syncStatus === 'error' ? T.red
                : syncStatus === 'offline' ? T.textMuted
                : T.green,
            }} />
          }
          showChevron={false}
        />
        <Row
          T={T}
          iconBg={T.amberBg} iconColor={T.amber}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="Notifications"
          subtitle="Alertes stock bas"
          toggle
          toggleOn={notifs}
          onToggle={() => setNotifs(n => !n)}
        />
        <Row
          T={T}
          iconBg={T.blueBg} iconColor={T.blue}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <polyline points="16 16 12 12 8 16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="12" x2="12" y2="21" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          }
          label="Sauvegarde"
          subtitle="Télécharger & partager le rapport"
          onPress={() => router.push('/sauvegarde')}
          divider={false}
        />
      </div>

      {/* GROUP 4 : Abonnement & Aide */}
      <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
        <Row
          T={T}
          iconBg={T.accentLight} iconColor={T.accent}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="4" width="22" height="16" rx="2" stroke="currentColor" strokeWidth="1.75"/>
              <line x1="1" y1="10" x2="23" y2="10" stroke="currentColor" strokeWidth="1.75"/>
            </svg>
          }
          label="Abonnement"
          subtitle="Version bêta gratuite"
          onPress={() => router.push('/abonnement')}
          badge={
            <span style={{
              background: T.accent, color: 'white',
              fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '2px 8px',
              fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '0.3px',
            }}>
              BÊTA
            </span>
          }
        />
        <Row
          T={T}
          iconBg={T.greenBg} iconColor={T.green}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75"/>
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              <line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          }
          label="Aide & support"
          subtitle="FAQ, nous contacter"
          onPress={() => router.push('/aide')}
          divider={false}
        />
      </div>

      {/* DÉCONNEXION */}
      <div style={{ margin: '0 16px 12px' }}>
        <button
          onClick={seDeconnecter}
          disabled={deconnexionEnCours}
          style={{
            width: '100%', height: 50, borderRadius: 14,
            background: T.redBg, border: `1.5px solid ${T.red}`,
            color: T.red, fontSize: 15, fontWeight: 700,
            cursor: deconnexionEnCours ? 'not-allowed' : 'pointer',
            opacity: deconnexionEnCours ? 0.6 : 1,
            fontFamily: 'Manrope, sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
          {deconnexionEnCours ? 'Déconnexion…' : 'Se déconnecter'}
        </button>
      </div>

      {/* VERSION */}
      <div style={{ textAlign: 'center', padding: '8px 0 12px', fontSize: 12, color: T.textMuted }}>
        MargoPro — Version bêta 0.1
      </div>

    </div>
  );
}
