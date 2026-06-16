'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useColors } from '@/lib/hooks/useColors';

const FAQ = [
  {
    q: 'Comment ajouter un produit ?',
    r: "Allez dans l'onglet \"Stock\", appuyez sur \"+ Ajouter\" et remplissez les informations du produit (nom, quantité, prix d'achat et de vente).",
  },
  {
    q: 'Comment enregistrer une vente ?',
    r: 'Dans l\'onglet "Ventes", appuyez sur "+ Nouvelle" et choisissez le produit vendu avec la quantité. Le stock se met à jour automatiquement.',
  },
  {
    q: 'Comment scanner un code-barres ?',
    r: 'Appuyez sur l\'icône appareil photo dans Stock ou Ventes. Accordez l\'accès à la caméra et pointez vers le code-barres. Fonctionnel sur Chrome Android et Samsung Internet.',
  },
  {
    q: 'Comment supprimer une vente faite par erreur ?',
    r: 'Dans la liste des ventes, appuyez sur le × à droite de la vente concernée. Le stock est automatiquement restauré.',
  },
  {
    q: 'Comment ajouter une catégorie de produit ?',
    r: "Dans le formulaire d'ajout de produit, tapez directement le nom de la catégorie dans le champ prévu, ou cliquez sur une catégorie existante parmi les suggestions.",
  },
  {
    q: 'Mes données sont-elles sauvegardées ?',
    r: 'Vos données sont stockées localement sur votre appareil. Téléchargez régulièrement le rapport CSV depuis Réglages > Sauvegarde pour conserver une copie externe.',
  },
  {
    q: 'Comment changer de devise ?',
    r: 'Allez dans Réglages > Devise et sélectionnez votre devise. Le changement s\'applique immédiatement à toutes les pages.',
  },
  {
    q: 'Comment activer le mode sombre ?',
    r: 'Allez dans Réglages > Apparence et activez le toggle. L\'interface bascule instantanément en thème sombre.',
  },
];

export default function AidePage() {
  const T = useColors();
  const router = useRouter();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 40, fontFamily: 'Manrope, sans-serif' }}>

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
        <span style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Aide & support</span>
      </div>

      <div style={{ padding: '8px 16px 0' }}>

        {/* Intro banner */}
        <div style={{
          background: T.accentLight, borderRadius: 14, padding: '12px 14px', marginBottom: 20,
          display: 'flex', gap: 10, alignItems: 'flex-start',
          border: `1px solid ${T.accent}22`,
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" stroke={T.accent} strokeWidth="1.75"/>
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round"/>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke={T.accent} strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, marginBottom: 3 }}>
              Comment pouvons-nous vous aider ?
            </div>
            <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.5 }}>
              Retrouvez les réponses aux questions fréquentes ci-dessous, ou contactez-nous directement.
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 10 }}>
          Questions fréquentes
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 26 }}>
          {FAQ.map((item, i) => (
            <div
              key={i}
              style={{ background: T.surface, borderRadius: 14, overflow: 'hidden', boxShadow: T.shadow }}
            >
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', gap: 12,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: T.text, textAlign: 'left', flex: 1, lineHeight: 1.4 }}>
                  {item.q}
                </span>
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  style={{ flexShrink: 0, transform: openIdx === i ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <path d="M6 9l6 6 6-6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {openIdx === i && (
                <div style={{
                  padding: '12px 16px 14px', fontSize: 13, color: T.textSub, lineHeight: 1.6,
                  borderTop: `1px solid ${T.border}`,
                }}>
                  {item.r}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Contact */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 10 }}>
          Nous contacter
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <a
            href="mailto:support@margopro.app"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: T.surface, borderRadius: 14, padding: '14px 16px',
              boxShadow: T.shadow, textDecoration: 'none',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 11, background: T.blueBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke={T.blue} strokeWidth="1.75" strokeLinejoin="round"/>
                <polyline points="22 6 12 13 2 6" stroke={T.blue} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Email</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>support@margopro.app</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>

          <a
            href="https://wa.me/?text=Bonjour%20MargoPro%2C%20j%27ai%20besoin%20d%27aide"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: T.surface, borderRadius: 14, padding: '14px 16px',
              boxShadow: T.shadow, textDecoration: 'none',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 11, background: '#E8F8EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.656 1.438 5.168L2 22l4.985-1.308A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#25D366" strokeWidth="1.5"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>WhatsApp</div>
              <div style={{ fontSize: 12, color: T.textMuted, marginTop: 1 }}>Réponse sous 24h</div>
            </div>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 18l6-6-6-6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12, color: T.textMuted }}>
          MargoPro — Version bêta 0.1
        </div>

      </div>
    </div>
  );
}
