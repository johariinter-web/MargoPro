'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function genererCSV(
  nomCommerce: string,
  symbole: string,
  produits: ReturnType<typeof useStock>['produits'],
  ventes: ReturnType<typeof useVentes>['ventes']
): string {
  const lignes: string[] = [];

  lignes.push(`RAPPORT MARGOPRO — ${nomCommerce.toUpperCase()}`);
  lignes.push(`Généré le : ${new Date().toLocaleDateString('fr-FR')}`);
  lignes.push(`Devise : ${symbole}`);
  lignes.push('');

  lignes.push('=== STOCK ===');
  lignes.push('Produit,Quantité,Prix Achat,Prix Vente,Valeur Stock,Marge %');
  for (const p of produits) {
    const marge = p.prixVente > 0 ? Math.round((p.prixVente - p.prixAchat) / p.prixVente * 100) : 0;
    lignes.push(`"${p.nom}",${p.quantite},${p.prixAchat},${p.prixVente},${p.prixAchat * p.quantite},${marge}%`);
  }
  const stockTotal = produits.reduce((s, p) => s + p.prixAchat * p.quantite, 0);
  lignes.push(`TOTAL STOCK,,,,,${stockTotal} ${symbole}`);
  lignes.push('');

  lignes.push('=== VENTES ===');
  lignes.push('Date,Heure,Produit,Quantité,Prix Unitaire,Total,Bénéfice');
  for (const v of ventes) {
    const d = new Date(v.date);
    lignes.push(
      `${d.toLocaleDateString('fr-FR')},${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })},"${v.produitNom}",${v.quantite},${v.prixVente},${v.total},${v.benefice}`
    );
  }
  const caTotal = ventes.reduce((s, v) => s + v.total, 0);
  const benTotal = ventes.reduce((s, v) => s + v.benefice, 0);
  lignes.push(`TOTAUX,,,,, ${caTotal} ${symbole}, ${benTotal} ${symbole}`);

  return lignes.join('\n');
}

export default function SauvegardePage() {
  const T = useColors();
  const router = useRouter();
  const { config } = useConfig();
  const { produits } = useStock();
  const { ventes } = useVentes('tout');

  const [rapportPret, setRapportPret] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [taille, setTaille] = useState('');

  const nomCommerce = config?.nomCommerce ?? 'Mon Commerce';
  const symbole = config?.symboleDevise ?? 'FCFA';
  const moisLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const nomFichier = `rapport_${new Date().toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace(' ', '_').replace('.', '')}.csv`;

  useEffect(() => {
    if (produits.length === 0 && ventes.length === 0) return;
    const csv = genererCSV(nomCommerce, symbole, produits, ventes);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    setTaille(blob.size < 1024 ? `${blob.size} o` : `${Math.round(blob.size / 1024)} Ko`);
    setRapportPret(true);
    return () => URL.revokeObjectURL(url);
  }, [produits, ventes, nomCommerce, symbole]);

  function telecharger() {
    if ('share' in navigator) {
      partagerViaOS();
      return;
    }
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = nomFichier;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function partagerViaOS() {
    const csv = genererCSV(nomCommerce, symbole, produits, ventes);
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const file = new File([blob], nomFichier, { type: 'text/csv' });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: `Rapport ${nomCommerce}`, files: [file] });
    } else if (navigator.share) {
      await navigator.share({ title: `Rapport ${nomCommerce}`, text: csv });
    } else {
      telecharger();
    }
  }

  function envoyerWhatsApp() {
    const texte = encodeURIComponent(`Rapport MargoPro — ${nomCommerce}\nVentes : ${ventes.length}\nStock : ${produits.length} produits`);
    window.open(`https://wa.me/?text=${texte}`, '_blank');
  }

  function envoyerMail() {
    const sujet = encodeURIComponent(`Rapport ${nomCommerce} — ${moisLabel}`);
    const corps = encodeURIComponent(genererCSV(nomCommerce, symbole, produits, ventes));
    window.open(`mailto:?subject=${sujet}&body=${corps}`, '_blank');
  }

  function envoyerSMS() {
    const texte = encodeURIComponent(`Rapport MargoPro ${nomCommerce} — ${moisLabel}. Ventes: ${ventes.length}, Bénéfice total: ${fmtF(ventes.reduce((s, v) => s + v.benefice, 0))} ${symbole}`);
    window.open(`sms:?body=${texte}`, '_blank');
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 40, fontFamily: 'Manrope, sans-serif' }}>

      {/* HEADER */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 15, fontWeight: 600, color: T.text, padding: 0, fontFamily: 'Manrope, sans-serif',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke={T.text} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Partager
        </button>
      </div>

      <div style={{ padding: '4px 16px 0' }}>

        {/* RAPPORT CARD */}
        <div style={{
          background: rapportPret ? T.greenBg : T.bgSubtle,
          borderRadius: 16, padding: '14px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1.5px solid ${rapportPret ? '#B8DCC4' : T.border}`,
          transition: 'all 0.3s',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: rapportPret ? T.green : T.textMuted,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {rapportPret ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17l-5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="white" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
              {rapportPret ? 'Rapport prêt' : 'Préparation du rapport…'}
            </div>
            {rapportPret && (
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>
                {nomFichier} · {taille}
              </div>
            )}
          </div>
          {rapportPret && (
            <button
              onClick={telecharger}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: T.green, padding: 4,
              }}
              aria-label="Télécharger"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={T.green} strokeWidth="1.75" strokeLinecap="round"/>
                <polyline points="7 10 12 15 17 10" stroke={T.green} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke={T.green} strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* ENVOYER VIA */}
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
          Envoyer à
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 24 }}>

          {/* WhatsApp */}
          <button onClick={envoyerWhatsApp} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#E8F8EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="#25D366"/>
                <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.656 1.438 5.168L2 22l4.985-1.308A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="#25D366" strokeWidth="1.5"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>WhatsApp</span>
          </button>

          {/* Mail */}
          <button onClick={envoyerMail} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#E6F0FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="#1A6BC4" strokeWidth="1.75" strokeLinejoin="round"/>
                <polyline points="22 6 12 13 2 6" stroke="#1A6BC4" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>Mail</span>
          </button>

          {/* SMS */}
          <button onClick={envoyerSMS} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: '#E8F8EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#2E7D46" strokeWidth="1.75" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>SMS</span>
          </button>

          {/* Autre */}
          <button onClick={partagerViaOS} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: T.bgSubtle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="18" cy="5" r="3" stroke={T.textSub} strokeWidth="1.75"/>
                <circle cx="6" cy="12" r="3" stroke={T.textSub} strokeWidth="1.75"/>
                <circle cx="18" cy="19" r="3" stroke={T.textSub} strokeWidth="1.75"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke={T.textSub} strokeWidth="1.75" strokeLinecap="round"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke={T.textSub} strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 11, color: T.textSub, fontWeight: 600 }}>Autre</span>
          </button>

        </div>

        {/* Résumé données */}
        <div style={{
          marginTop: 20, padding: '12px 14px', background: T.surface,
          borderRadius: 14, boxShadow: T.shadow,
          display: 'flex', justifyContent: 'space-around',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{produits.length}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: 600 }}>Produits</div>
          </div>
          <div style={{ width: 1, background: T.border }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{ventes.length}</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: 600 }}>Ventes</div>
          </div>
          <div style={{ width: 1, background: T.border }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
              {fmtF(ventes.reduce((s, v) => s + v.benefice, 0))}
            </div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontWeight: 600 }}>Bénéfice</div>
          </div>
        </div>

      </div>
    </div>
  );
}
