'use client';

import { useState, useEffect, useRef } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { useConfig } from '@/lib/hooks/useConfig';
import BarcodeScanner from '@/components/BarcodeScanner';
import { useColors } from '@/lib/hooks/useColors';
import type { Periode } from '@backend/types';
import { filtrerParPeriode, urgenceCredit, resteADoit } from '@backend/ventes';

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
  const { ventes, ventesSupprimees, stats, credits, soldes, totalDu, enregistrerVente, enregistrerPaiementCredit, supprimerVente, restaurerVente } = useVentes(periode);
  const [voirSoldes, setVoirSoldes] = useState(false);
  const [onglet, setOnglet] = useState<'ventes' | 'carnet'>('ventes');
  const [joursOuverts, setJoursOuverts] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [produitId, setProduitId] = useState('');
  const [quantite, setQuantite] = useState('1');
  const [erreur, setErreur] = useState('');
  const [prixGros, setPrixGros] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [clientNomCredit, setClientNomCredit] = useState('');
  const [clientTelCredit, setClientTelCredit] = useState('');
  const [acompteCredit, setAcompteCredit] = useState('0');
  const [venteSelectionnee, setVenteSelectionnee] = useState<typeof ventes[number] | null>(null);
  const [venteSupprimee, setVenteSupprimee] = useState<typeof ventes[number] | null>(null);
  const [showHistorique, setShowHistorique] = useState(false);
  const [ventePaiement, setVentePaiement] = useState<typeof ventes[number] | null>(null);
  const [montantPaiement, setMontantPaiement] = useState('');
  const [erreurPaiement, setErreurPaiement] = useState('');
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
    if (isCredit && !clientNomCredit.trim()) { setErreur('Nom du client requis pour un crédit'); return; }
    const prixFinal = Number(prixGros) > 0 ? Number(prixGros) : produit.prixVente;
    const creditParams = isCredit
      ? { clientNom: clientNomCredit.trim(), clientTel: clientTelCredit.trim() || undefined, montantRecu: Math.max(0, Number(acompteCredit) || 0) }
      : undefined;
    await enregistrerVente(produit.id, produit.nom, qte, prixFinal, produit.prixAchat, creditParams);
    await deduireStock(produit.id, qte);
    setProduitId('');
    setQuantite('1');
    setPrixGros('');
    setIsCredit(false);
    setClientNomCredit('');
    setClientTelCredit('');
    setAcompteCredit('0');
    setShowForm(false);
    if (isCredit) setOnglet('carnet');
  }

  async function handlePaiementCredit() {
    if (!ventePaiement) return;
    setErreurPaiement('');
    const err = await enregistrerPaiementCredit(ventePaiement.id, Number(montantPaiement));
    if (err) { setErreurPaiement(err); return; }
    setVentePaiement(null);
    setMontantPaiement('');
  }

  // Filtre la liste selon la période choisie (Jour / Semaine / Mois / Tout)
  const ventesPeriode = filtrerParPeriode(ventes, periode);

  // Group ventes by day
  const grouped = ventesPeriode.slice(0, 100).reduce((acc, v) => {
    const day = new Date(v.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(v);
    return acc;
  }, {} as Record<string, typeof ventes>);

  const joursKeys = Object.keys(grouped);
  function isJourOuvert(day: string, index: number) {
    if (day in joursOuverts) return joursOuverts[day];
    return index === 0;
  }
  function toggleJour(day: string, index: number) {
    setJoursOuverts(prev => ({ ...prev, [day]: !isJourOuvert(day, index) }));
  }

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

      {/* MODAL PAIEMENT CRÉDIT */}
      {ventePaiement && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => { setVentePaiement(null); setErreurPaiement(''); setMontantPaiement(''); }}
        >
          <div
            style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 36px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 4 }}>
              Paiement — {ventePaiement.clientNom}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 16 }}>
              Reste dû : <strong style={{ color: '#F97316' }}>{fmtF(resteADoit(ventePaiement))} {symbole}</strong>
            </div>
            {erreurPaiement && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreurPaiement}
              </div>
            )}
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Montant reçu ({symbole})</label>
            <input
              type="number"
              value={montantPaiement}
              onChange={e => setMontantPaiement(e.target.value)}
              placeholder={String(resteADoit(ventePaiement))}
              style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', marginBottom: 14 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setVentePaiement(null); setErreurPaiement(''); setMontantPaiement(''); }}
                style={{ flex: 1, height: 48, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
              >
                Annuler
              </button>
              <button
                onClick={handlePaiementCredit}
                style={{ flex: 2, height: 48, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
              >
                ✅ Confirmer
              </button>
            </div>
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

      {/* ONGLETS VENTES / CRÉDITS */}
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
        <button
          onClick={() => setOnglet('ventes')}
          style={{ flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: onglet === 'ventes' ? T.accent : T.bgSubtle, color: onglet === 'ventes' ? 'white' : T.textSub }}
        >
          Ventes
        </button>
        <button
          onClick={() => setOnglet('carnet')}
          style={{ flex: 1, height: 36, borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: onglet === 'carnet' ? '#F97316' : T.bgSubtle, color: onglet === 'carnet' ? 'white' : T.textSub, position: 'relative' }}
        >
          Carnet
          {credits.length > 0 && (
            <span style={{ position: 'absolute', top: -6, right: -6, background: '#EF4444', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {credits.length}
            </span>
          )}
        </button>
      </div>

      {/* FILTER PILLS — visible uniquement sur l'onglet Ventes */}
      {onglet === 'ventes' && <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
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
      </div>}

      {/* STATS CARD — onglet Ventes uniquement */}
      {onglet === 'ventes' && <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, padding: '14px 16px', boxShadow: T.shadow }}>
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
      </div>}

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
          {/* TOGGLE CRÉDIT */}
          <div
            onClick={() => { setIsCredit(v => !v); setClientNomCredit(''); setClientTelCredit(''); setAcompteCredit('0'); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, cursor: 'pointer', padding: '10px 12px', background: isCredit ? '#FFF7ED' : T.bgSubtle, borderRadius: 10, border: isCredit ? '1.5px solid #F97316' : `1.5px solid ${T.border}` }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: isCredit ? '#C2410C' : T.textSub }}>Vente à crédit</span>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: isCredit ? '#F97316' : T.border, position: 'relative', transition: 'background .2s' }}>
              <div style={{ position: 'absolute', top: 2, left: isCredit ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }} />
            </div>
          </div>
          {isCredit && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du client *</label>
                <input
                  type="text"
                  value={clientNomCredit}
                  onChange={e => setClientNomCredit(e.target.value)}
                  placeholder="Ex : Aminata Koné"
                  style={{ width: '100%', border: `1.5px solid #F97316`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Téléphone du client (optionnel)</label>
                <input
                  type="tel"
                  value={clientTelCredit}
                  onChange={e => setClientTelCredit(e.target.value)}
                  placeholder="Ex : 77 123 45 67"
                  style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Acompte reçu maintenant ({symbole})</label>
                <input
                  type="number"
                  value={acompteCredit}
                  onChange={e => setAcompteCredit(e.target.value)}
                  placeholder="0"
                  min="0"
                  style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
                />
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setShowForm(false); setErreur(''); setPrixGros(''); setIsCredit(false); setClientNomCredit(''); setClientTelCredit(''); setAcompteCredit('0'); }}
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
                flex: 2, height: 44, borderRadius: 12, background: isCredit ? '#F97316' : T.accent,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white',
              }}
            >
              {isCredit ? '📒 Crédit' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}

      {/* LIEN HISTORIQUE DES SUPPRESSIONS — onglet Ventes uniquement */}
      {onglet === 'ventes' && <div style={{ padding: '0 16px 8px', display: 'flex', justifyContent: 'flex-end' }}>
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
      </div>}

      {/* VENTES LIST - grouped by date */}
      {onglet === 'ventes' && <div style={{ padding: '0 16px', overflowY: 'auto', scrollbarWidth: 'none' }}>
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
          Object.entries(grouped).map(([day, dayVentes], index) => {
            const dayTotal = dayVentes.reduce((s, v) => s + v.total, 0);
            const ouvert = isJourOuvert(day, index);
            return (
              <div key={day} style={{ marginBottom: 12 }}>
                {/* Date group header — tappable pour replier/déplier */}
                <button
                  onClick={() => toggleJour(day, index)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '4px 0', marginBottom: ouvert ? 8 : 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <svg
                      width="12" height="12" viewBox="0 0 24 24" fill="none"
                      style={{ transform: ouvert ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }}
                    >
                      <path d="M6 9l6 6 6-6" stroke={T.textMuted} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, textTransform: 'capitalize' }}>{day}</span>
                    <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>· {dayVentes.length} vente{dayVentes.length > 1 ? 's' : ''}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>
                    {fmtF(dayTotal)} {symbole}
                  </span>
                </button>
                {/* Liste des ventes du jour — visible seulement si ouvert */}
                {ouvert && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayVentes.map(v => {
                    const photoVente = produits.find(p => p.id === v.produitId)?.photo;
                    return (
                    <div
                      key={v.id}
                      onClick={() => setVenteSelectionnee(v)}
                      style={{
                        background: T.surface, borderRadius: 12, padding: '10px 12px',
                        boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 10,
                        position: 'relative', cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {photoVente ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photoVente} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 15, fontWeight: 800, color: T.accent }}>{(v.produitNom || '?').charAt(0).toUpperCase()}</span>
                        )}
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
                    );
                  })}
                </div>}
              </div>
            );
          })
        )}
      </div>}

      {/* VUE CARNET */}
      {onglet === 'carnet' && (
        <div style={{ padding: '0 16px' }}>
          {credits.length === 0 && soldes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📒</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun crédit en cours</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Tout le monde est à jour !</div>
            </div>
          ) : (
            <>
              {/* Bandeau total dû */}
              {credits.length > 0 && (
                <div style={{ background: '#FFF7ED', border: '2px solid #F97316', borderRadius: 14, padding: '14px 16px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#C2410C', marginBottom: 4 }}>Total qu&apos;on te doit</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: '#C2410C', fontFamily: '"Space Grotesk", sans-serif' }}>
                    {fmtF(totalDu)} {symbole}
                  </div>
                  <div style={{ fontSize: 12, color: '#9A3412', marginTop: 2 }}>
                    {credits.length} client{credits.length > 1 ? 's' : ''} — tape un nom pour enregistrer un paiement
                  </div>
                </div>
              )}

              {/* Liste des créanciers — tap pour ouvrir la fiche paiement */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {credits.map(v => {
                  const urgence = urgenceCredit(v);
                  const reste = resteADoit(v);
                  const borderColor = urgence === 'urgent' ? '#EF4444' : urgence === 'moyen' ? '#F97316' : T.border;
                  return (
                    <div
                      key={v.id}
                      onClick={() => { setVentePaiement(v); setMontantPaiement(''); setErreurPaiement(''); }}
                      style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', border: `2px solid ${borderColor}`, boxShadow: T.shadow, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{v.clientNom}</span>
                          {urgence === 'urgent' && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 +15j</span>}
                          {urgence === 'moyen' && <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316' }}>⚠ +7j</span>}
                        </div>
                        {v.clientTel && (
                          <a href={`tel:${v.clientTel}`} onClick={e => e.stopPropagation()} style={{ fontSize: 12, color: T.accent, fontWeight: 600, textDecoration: 'none', display: 'block', marginBottom: 2 }}>
                            📞 {v.clientTel}
                          </a>
                        )}
                        <div style={{ fontSize: 11, color: T.textMuted }}>
                          {v.produitNom} · {new Date(v.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 17, fontWeight: 800, color: '#F97316', fontFamily: '"Space Grotesk", sans-serif' }}>
                          {fmtF(reste)} {symbole}
                        </div>
                        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                          sur {fmtF(v.total)} {symbole}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Crédits soldés — collapsibles avec bouton Supprimer */}
              {soldes.length > 0 && (
                <div>
                  <button
                    onClick={() => setVoirSoldes(s => !s)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.textMuted, padding: '4px 0', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}
                  >
                    {voirSoldes ? 'Masquer' : `Voir les ${soldes.length} crédit${soldes.length > 1 ? 's' : ''} soldé${soldes.length > 1 ? 's' : ''}`}
                  </button>
                  {voirSoldes && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {soldes.map(v => (
                        <div key={v.id} style={{ background: T.surface, borderRadius: 12, padding: '10px 14px', border: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: T.textSub, textDecoration: 'line-through' }}>{v.clientNom}</div>
                            <div style={{ fontSize: 11, color: T.textMuted }}>{fmtF(v.total)} {symbole} · {new Date(v.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</div>
                          </div>
                          <button
                            onClick={() => supprimerVente(v.id)}
                            style={{ height: 36, padding: '0 12px', borderRadius: 10, background: T.redBg, color: T.red, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                          >
                            Supprimer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
