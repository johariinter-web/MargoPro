'use client';

import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

type TabMode = '%Marge' | 'Pluriels' | 'Fiches' | 'Stock mort';

export default function MargesPage() {
  const T = useColors();
  const { produits } = useStock();
  const { ventes } = useVentes('tout');
  const { config } = useConfig();
  const [tab, setTab] = useState<TabMode>('%Marge');
  const [morteSeuilStr, setMorteSeuilStr] = useState('30');
  const [prixAchat, setPrixAchat] = useState('');
  const [margePctStr, setMargePctStr] = useState('30');
  const margePct = Math.min(1000, Math.max(0, Number(margePctStr) || 0));
  const [simProduitId, setSimProduitId] = useState('');
  const [simQte, setSimQte] = useState('');
  const [simPrixGros, setSimPrixGros] = useState('');

  const symbole = config?.symboleDevise ?? 'FCFA';

  const produitsAvecMarges = produits.map(p => ({
    ...p,
    pct: p.prixVente > 0 ? Math.round((p.prixVente - p.prixAchat) / p.prixVente * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  const avgPct = produitsAvecMarges.length > 0
    ? Math.round(produitsAvecMarges.reduce((s, p) => s + p.pct, 0) / produitsAvecMarges.length)
    : 0;

  const prixAchatNum = parseFloat(prixAchat) || 0;
  const prixVenteCalc = prixAchatNum > 0
    ? Math.round(prixAchatNum * (1 + margePct / 100))
    : 0;

  const tabs: TabMode[] = ['%Marge', 'Pluriels', 'Fiches', 'Stock mort'];

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 90, fontFamily: 'Manrope, sans-serif' }}>

      {/* HEADER */}
      <div style={{ padding: '10px 16px 6px' }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Marges</div>
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
          {produits.length} produit{produits.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* TABS */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ display: 'flex', background: T.bgSubtle, borderRadius: 12, padding: 3, gap: 2 }}>
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', borderRadius: 10,
                fontSize: 11,
                whiteSpace: 'nowrap',
                fontWeight: tab === t ? 700 : 500,
                color: tab === t ? T.text : T.textMuted,
                background: tab === t ? T.surface : 'transparent',
                boxShadow: tab === t ? T.shadow : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === '%Marge' && (
        <>
          {/* PRODUCT LIST */}
          <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {produitsAvecMarges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun produit à analyser</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Ajoutez des produits dans l&apos;onglet Stock</div>
              </div>
            ) : (
              produitsAvecMarges.map(p => {
                const isGood = p.pct >= 25;
                const delta = p.pct - avgPct;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: T.surface, borderRadius: 16, boxShadow: T.shadow,
                      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    {/* Left % square */}
                    <div style={{
                      width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                      background: isGood ? T.greenBg : T.redBg,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{
                        fontSize: 20, fontWeight: 800,
                        color: isGood ? T.green : T.red,
                        fontFamily: '"Space Grotesk", sans-serif',
                        lineHeight: 1,
                      }}>
                        {p.pct}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: isGood ? T.green : T.red }}>%</span>
                    </div>

                    {/* Middle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.nom}
                      </div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: '"Space Grotesk", sans-serif' }}>
                        {fmtF(p.prixVente)} {symbole} · {p.quantite} unités
                      </div>
                    </div>

                    {/* Right delta vs moyenne */}
                    {delta !== 0 && (
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        color: delta > 0 ? T.green : T.red,
                        fontFamily: '"Space Grotesk", sans-serif',
                        flexShrink: 0,
                      }}>
                        {delta > 0 ? '+' : ''}{delta}%
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* CALCULATOR */}
          <div style={{ margin: '16px 16px 0', background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
              Calculateur
            </div>

            {/* Prix d'achat */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub, marginBottom: 8 }}>
                Prix d&apos;achat ({symbole})
              </div>
              <div style={{ background: T.bgSubtle, borderRadius: 12, padding: '12px 16px' }}>
                <input
                  type="number"
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
                    type="number"
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
              <div style={{ background: T.accentLight, borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Prix de vente conseillé</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                  {fmtF(prixVenteCalc)} <span style={{ fontSize: 13 }}>{symbole}</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'Pluriels' && (() => {
        const simProduit = produits.find(p => p.id === simProduitId);
        const simQteNum = Number(simQte) || 0;
        const simPrixNum = Number(simPrixGros) || 0;
        const simTotal = simProduit && simPrixNum > 0 && simQteNum > 0 ? simPrixNum * simQteNum : 0;
        const simBenefice = simProduit && simPrixNum > 0 && simQteNum > 0 ? (simPrixNum - simProduit.prixAchat) * simQteNum : 0;
        return (
          <div style={{ padding: '0 16px' }}>
            {produits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun produit</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Ajoutez des produits dans l&apos;onglet Stock</div>
              </div>
            ) : (
              <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 14 }}>
                  Simulateur gros
                </div>

                {/* Produit */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Produit</label>
                  <select value={simProduitId} onChange={e => { setSimProduitId(e.target.value); setSimQte(''); setSimPrixGros(''); }}
                    style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', cursor: 'pointer' }}>
                    <option value="">Choisir un produit...</option>
                    {produits.map(p => (
                      <option key={p.id} value={p.id}>{p.nom} — {fmtF(p.prixVente)} {symbole}/unité</option>
                    ))}
                  </select>
                </div>

                {simProduit && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Quantité</label>
                        <input type="number" value={simQte} onChange={e => setSimQte(e.target.value)} placeholder="0" min="1"
                          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
                      </div>
                      <div style={{ flex: 2 }}>
                        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Prix gros/unité ({symbole})</label>
                        <input type="number" value={simPrixGros} onChange={e => setSimPrixGros(e.target.value)} placeholder={fmtF(simProduit.prixVente)} min="0"
                          style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    {simTotal > 0 && (
                      <div style={{ background: T.accentLight, borderRadius: 12, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, color: T.textSub }}>Total</span>
                          <strong style={{ fontSize: 18, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(simTotal)} {symbole}</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: T.textSub }}>Bénéfice</span>
                          <strong style={{ fontSize: 16, fontFamily: '"Space Grotesk", sans-serif', color: simBenefice >= 0 ? T.green : T.red }}>
                            {simBenefice >= 0 ? '+' : ''}{fmtF(simBenefice)} {symbole}
                          </strong>
                        </div>
                        {simPrixNum < simProduit.prixAchat && (
                          <div style={{ fontSize: 11, color: T.red, fontWeight: 600, marginTop: 8 }}>
                            ⚠ Prix gros inférieur au prix d&apos;achat — vente à perte
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
      })()}

      {tab === 'Fiches' && (
        <div style={{ textAlign: 'center', padding: '60px 16px', color: T.textMuted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>Fiches produits</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Bientôt disponible</div>
        </div>
      )}

      {tab === 'Stock mort' && (() => {
        const now = Date.now();
        const JOUR = 86_400_000;
        // Date de la dernière vente par produit
        const derniereVente = new Map<string, number>();
        for (const v of ventes) {
          const prev = derniereVente.get(v.produitId) ?? 0;
          if (v.date > prev) derniereVente.set(v.produitId, v.date);
        }
        const seuil = Math.max(1, Number(morteSeuilStr) || 0);
        // Stock mort = produit avec du stock qui n'a pas été vendu depuis >= seuil jours
        const morts = produits
          .filter(p => p.quantite > 0)
          .map(p => {
            const last = derniereVente.get(p.id);
            const ref = last ?? p.createdAt ?? now;
            const jours = Math.floor((now - ref) / JOUR);
            return { ...p, jours, jamaisVendu: !last, valeur: p.prixAchat * p.quantite };
          })
          .filter(a => a.jours >= seuil)
          .sort((a, b) => b.jours - a.jours);
        const argentImmobilise = morts.reduce((s, a) => s + a.valeur, 0);
        return (
          <div style={{ padding: '0 16px' }}>

            {/* Réglage du seuil */}
            <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Sans vente depuis</div>
                <div style={{ background: T.bgSubtle, borderRadius: 10, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" min={1} max={365} value={morteSeuilStr}
                    onChange={e => setMorteSeuilStr(e.target.value)}
                    style={{ width: 46, border: 'none', background: 'transparent', fontSize: 16, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif', outline: 'none', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>jours</span>
                </div>
              </div>
              <input
                type="range" min={7} max={180}
                value={Math.min(180, Math.max(7, seuil))}
                onChange={e => setMorteSeuilStr(e.target.value)}
                style={{ width: '100%', accentColor: T.accent }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: T.textMuted, marginTop: 4 }}>
                <span>7j</span><span>30j</span><span>90j</span><span>180j</span>
              </div>
            </div>

            {/* Résumé argent immobilisé */}
            {morts.length > 0 && (
              <div style={{ background: T.redBg, borderRadius: 14, padding: '12px 16px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: T.textSub, fontWeight: 600 }}>Argent immobilisé</div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>
                    {morts.length} produit{morts.length > 1 ? 's' : ''} qui {morts.length > 1 ? 'dorment' : 'dort'}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.red, fontFamily: '"Space Grotesk", sans-serif' }}>
                  {fmtF(argentImmobilise)} <span style={{ fontSize: 12 }}>{symbole}</span>
                </div>
              </div>
            )}

            {/* Liste */}
            {morts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun stock mort</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
                  Tous tes produits en stock se sont vendus dans les {seuil} derniers jours
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {morts.map(p => (
                  <div key={p.id} style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, background: T.redBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: T.red, fontFamily: '"Space Grotesk", sans-serif', lineHeight: 1 }}>{p.jours}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: T.red }}>jours</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nom}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: '"Space Grotesk", sans-serif' }}>
                        {p.jamaisVendu ? 'Jamais vendu' : 'Sans vente'} · {p.quantite} u · {fmtF(p.valeur)} {symbole}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
