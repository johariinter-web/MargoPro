'use client';

import { useState, useEffect, useRef } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { useConfig } from '@/lib/hooks/useConfig';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useColors } from '@/lib/hooks/useColors';
import type { Periode } from '@backend/types';
import { filtrerParPeriode } from '@backend/ventes';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatHeure(ts: number) {
  return new Date(ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

const PERIODES: { value: Periode; label: string }[] = [
  { value: 'jour', label: "Aujourd'hui" },
  { value: 'semaine', label: 'Cette semaine' },
  { value: 'mois', label: 'Ce mois' },
  { value: 'tout', label: 'Tout' },
];


export default function VentesPage() {
  const T = useColors();
  const { config } = useConfig();
  const { produits, deduireStock } = useStock();
  const [periode, setPeriode] = useState<Periode>('jour');
  const { ventes, ventesSupprimees, stats, enregistrerVente, supprimerVente, restaurerVente } = useVentes(periode);
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [produitId, setProduitId] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [erreur, setErreur] = useState('');
  const [prixGros, setPrixGros] = useState('');
  const [venteSelectionnee, setVenteSelectionnee] = useState<typeof ventes[number] | null>(null);
  const [venteSupprimee, setVenteSupprimee] = useState<typeof ventes[number] | null>(null);
  const [showHistorique, setShowHistorique] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  function confirmerSuppressionVente() {
    if (!venteSelectionnee) return;
    const v = venteSelectionnee;
    setVenteSelectionnee(null);
    supprimerVente(v.id);
    setVenteSupprimee(v);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setVenteSupprimee(null), 6000);
  }

  function annulerSuppressionVente() {
    if (!venteSupprimee) return;
    restaurerVente(venteSupprimee.id);
    setVenteSupprimee(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }

  const symbole = config?.symboleDevise ?? 'FCFA';

  useEffect(() => {
    if (produits.length === 0) return;
    const barcode = sessionStorage.getItem('margopro_scan_barcode');
    if (barcode) {
      sessionStorage.removeItem('margopro_scan_barcode');
      handleScan(barcode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produits]);

  function handleScan(barcode: string) {
    setShowScanner(false);
    const found = produits.find(p => p.codeBarres === barcode);
    if (found) {
      setProduitId(found.id);
      setShowForm(true);
    } else {
      setErreur(`Produit avec code "${barcode}" introuvable dans le stock.`);
      setShowForm(true);
    }
  }

  async function handleVente() {
    setErreur('');
    const produit = produits.find(p => p.id === produitId);
    if (!produit) { setErreur('Choisissez un produit'); return; }
    const qte = Number(quantite);
    if (!qte || qte <= 0) { setErreur('Quantité invalide'); return; }
    if (qte > produit.quantite) { setErreur(`Stock insuffisant (${produit.quantite} disponibles)`); return; }
    const prixFinal = Number(prixGros) > 0 ? Number(prixGros) : produit.prixVente;
    await enregistrerVente(produit.id, produit.nom, qte, prixFinal, produit.prixAchat);
    await deduireStock(produit.id, qte);
    setProduitId('');
    setQuantite('1');
    setPrixGros('');
    setShowForm(false);
  }

  // Filtre la liste selon la période choisie (Jour / Semaine / Mois / Tout)
  const ventesPeriode = filtrerParPeriode(ventes, periode);

  // Group ventes by day
  const grouped = ventesPeriode.slice(0, 50).reduce((acc, v) => {
    const day = new Date(v.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(v);
    return acc;
  }, {} as Record<string, typeof ventes>);

  const selectedProduit = produits.find(p => p.id === produitId);
  const qteNum = Number(quantite) || 0;
  const prixEffectif = selectedProduit && Number(prixGros) > 0
    ? Number(prixGros)
    : selectedProduit?.prixVente ?? 0;

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 90, fontFamily: 'Manrope, sans-serif' }}>

      {/* SCANNER */}
      {showScanner && (
        <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
      )}

      {/* MENU D'UNE VENTE (toucher une vente) */}
      {venteSelectionnee && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setVenteSelectionnee(null)}
        >
          <div
            style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 36px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 4 }}>{venteSelectionnee.produitNom}</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 18 }}>
              {venteSelectionnee.quantite} unité{venteSelectionnee.quantite > 1 ? 's' : ''} · {fmtF(venteSelectionnee.total)} {symbole} · {new Date(venteSelectionnee.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </div>
            <button
              onClick={confirmerSuppressionVente}
              style={{ width: '100%', height: 48, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 11v6M14 11v6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              Supprimer cette vente
            </button>
            <button
              onClick={() => setVenteSelectionnee(null)}
              style={{ width: '100%', height: 48, marginTop: 10, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* HISTORIQUE DES SUPPRESSIONS */}
      {showHistorique && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowHistorique(false)}
        >
          <div
            style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 36px', maxHeight: '80dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>Historique des suppressions</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Toutes les ventes supprimées restent visibles ici, avec leur date.
            </div>
            {ventesSupprimees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: T.textMuted, fontSize: 14 }}>
                Aucune vente supprimée
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ventesSupprimees.map(v => (
                  <div key={v.id} style={{ background: T.bgSubtle, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.produitNom}</div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                        Vendue le {new Date(v.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {v.updatedAt ? ` · supprimée le ${new Date(v.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: T.textSub, fontFamily: '"Space Grotesk", sans-serif', flexShrink: 0 }}>
                      {fmtF(v.total)} {symbole}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* BANDEAU ANNULER (après suppression d'une vente) */}
      {venteSupprimee && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 80, zIndex: 250, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ background: T.text, borderRadius: 14, padding: '12px 14px 12px 16px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 480, width: '100%', boxShadow: T.shadow }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#F4EEE4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Vente «&nbsp;{venteSupprimee.produitNom}&nbsp;» supprimée
            </span>
            <button onClick={annulerSuppressionVente} style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 10, height: 36, padding: '0 16px', color: '#F4EEE4', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Ventes</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowScanner(true)}
            style={{
              width: 40, height: 40, borderRadius: 12, background: T.bgSubtle,
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            aria-label="Scanner un produit"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={T.textSub} strokeWidth="1.75" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="4" stroke={T.textSub} strokeWidth="1.75"/>
            </svg>
          </button>
          <button
            onClick={() => setShowForm(true)}
            style={{
              height: 40, borderRadius: 12, background: T.accent, color: 'white',
              fontSize: 13, fontWeight: 700, padding: '0 16px', border: 'none', cursor: 'pointer',
            }}
          >
            + Nouvelle
          </button>
        </div>
      </div>

      {/* FILTER PILLS */}
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {PERIODES.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriode(p.value)}
            style={{
              height: 30, borderRadius: 20, padding: '0 12px', fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', flexShrink: 0,
              background: periode === p.value ? T.accent : T.bgSubtle,
              color: periode === p.value ? 'white' : T.textSub,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* STATS CARD */}
      <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, padding: '14px 16px', boxShadow: T.shadow }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>CA</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.8px' }}>
              {fmtF(stats.chiffreAffaires)} <span style={{ fontSize: 13 }}>{symbole}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>Bénéfice</div>
            <div style={{
              fontSize: 22, fontWeight: 800, fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.8px',
              color: stats.benefice >= 0 ? T.green : T.red,
            }}>
              {stats.benefice >= 0 ? '+' : ''}{fmtF(stats.benefice)} <span style={{ fontSize: 13 }}>{symbole}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SALE FORM */}
      {showForm && (
        <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Enregistrer une vente</div>
          {erreur && (
            <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
              {erreur}
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Produit</label>
            <select
              value={produitId}
              onChange={e => setProduitId(e.target.value)}
              style={{
                width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
                fontSize: 14, color: T.text, background: T.bg, outline: 'none',
                fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', cursor: 'pointer',
              }}
            >
              <option value="">Choisir un produit...</option>
              {produits.filter(p => p.quantite > 0).map(p => (
                <option key={p.id} value={p.id}>
                  {p.nom} — {fmtF(p.prixVente)} {symbole} ({p.quantite} dispo)
                </option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Quantité</label>
            <input
              type="number"
              value={quantite}
              onChange={e => setQuantite(e.target.value)}
              min="1"
              style={{
                width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
                fontSize: 15, color: T.text, background: T.bg, outline: 'none',
                fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
              Prix unitaire gros (optionnel)
            </label>
            <input
              type="number"
              value={prixGros}
              onChange={e => setPrixGros(e.target.value)}
              placeholder={selectedProduit ? `Normal : ${fmtF(selectedProduit.prixVente)} ${symbole}` : 'Prix gros par unité'}
              min="0"
              style={{
                width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
                fontSize: 15, color: T.text, background: T.bg, outline: 'none',
                fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
              }}
            />
          </div>
          {selectedProduit && (
            <div style={{ background: T.bgSubtle, borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: T.textSub }}>
                Total : <strong style={{ color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(prixEffectif * qteNum)} {symbole}</strong>
                {'  ·  Bénéfice : '}
                <strong style={{ color: T.green, fontFamily: '"Space Grotesk", sans-serif' }}>+{fmtF((prixEffectif - selectedProduit.prixAchat) * qteNum)} {symbole}</strong>
              </span>
              {Number(prixGros) > 0 && (
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
                  Prix gros appliqué ({fmtF(Number(prixGros))} {symbole}/unité)
                </div>
              )}
              {Number(prixGros) > 0 && selectedProduit && Number(prixGros) < selectedProduit.prixAchat && (
                <div style={{ fontSize: 11, color: T.red, fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Prix gros inférieur au prix d&apos;achat — vente à perte
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setShowForm(false); setErreur(''); setPrixGros(''); }}
              style={{
                flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub,
              }}
            >
              Annuler
            </button>
            <button
              onClick={handleVente}
              style={{
                flex: 2, height: 44, borderRadius: 12, background: T.accent,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white',
              }}
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {/* LIEN HISTORIQUE DES SUPPRESSIONS */}
      <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setShowHistorique(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.textMuted, padding: '4px 0', fontFamily: 'Manrope, sans-serif' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M3 3v5h5M3.05 13a9 9 0 102.5-7.4L3 8" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 7v5l3 2" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Historique des suppressions{ventesSupprimees.length > 0 ? ` (${ventesSupprimees.length})` : ''}
        </button>
      </div>

      {/* VENTES LIST - grouped by date */}
      <div style={{ padding: '0 16px', overflowY: 'auto', scrollbarWidth: 'none' }}>
        {ventesPeriode.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M2 3h2l2.4 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L22 7H6" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="9" cy="20" r="1.5" fill={T.textMuted}/>
              <circle cx="18" cy="20" r="1.5" fill={T.textMuted}/>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucune vente pour cette période</div>
          </div>
        ) : (
          Object.entries(grouped).map(([day, dayVentes]) => {
            const dayTotal = dayVentes.reduce((s, v) => s + v.total, 0);
            return (
              <div key={day} style={{ marginBottom: 16 }}>
                {/* Date group header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: 'capitalize' }}>{day}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>
                    {fmtF(dayTotal)} {symbole}
                  </span>
                </div>
                {/* Timeline */}
                <div style={{ borderLeft: `2px dashed ${T.border}`, marginLeft: 10, paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayVentes.map(v => (
                    <div
                      key={v.id}
                      onClick={() => setVenteSelectionnee(v)}
                      style={{
                        background: T.surface, borderRadius: 12, padding: '10px 12px',
                        boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 10,
                        position: 'relative', cursor: 'pointer',
                      }}
                    >
                      {/* Timeline dot */}
                      <div style={{
                        position: 'absolute', left: -21, top: '50%', transform: 'translateY(-50%)',
                        width: 8, height: 8, borderRadius: '50%', background: T.accent,
                        border: `2px solid ${T.bg}`,
                      }} />
                      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: T.accent }}>{(v.produitNom || '?').charAt(0).toUpperCase()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.produitNom}
                        </div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                          {v.quantite} unité{v.quantite > 1 ? 's' : ''} · {formatHeure(v.date)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>
                          {fmtF(v.total)} {symbole}
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: T.green, marginTop: 1, fontFamily: '"Space Grotesk", sans-serif' }}>
                          +{fmtF(v.benefice)} {symbole}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
