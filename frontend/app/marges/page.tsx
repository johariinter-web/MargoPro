'use client';

import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

type TabMode = '%Marge' | 'Pluriels' | 'Catalogue';

export default function MargesPage() {
  const T = useColors();
  const { produits } = useStock();
  const { config } = useConfig();
  const [tab, setTab] = useState<TabMode>('%Marge');
  const [prixAchat, setPrixAchat] = useState('');
  const [margePctStr, setMargePctStr] = useState('30');
  const margePct = Math.min(1000, Math.max(0, Number(margePctStr) || 0));
  const [simProduitId, setSimProduitId] = useState('');
  const [simQte, setSimQte] = useState('');
  const [simPrixGros, setSimPrixGros] = useState('');
  const [catsOuvertes, setCatsOuvertes] = useState<Record<string, boolean>>({});

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

  const tabs: TabMode[] = ['%Marge', 'Pluriels', 'Catalogue'];

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
          {/* CALCULATOR (en premier) */}
          <div style={{ margin: '0 16px 16px', background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow }}>
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

          {/* LISTE GROUPÉE PAR CATÉGORIE */}
          {produitsAvecMarges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
                <path d="M3 3v18h18" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M7 14l3-3 3 3 4-5" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun produit à analyser</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>Ajoutez des produits dans l&apos;onglet Stock</div>
            </div>
          ) : (() => {
            // Regroupement des produits par catégorie (un seul niveau)
            const groupes = new Map<string, typeof produitsAvecMarges>();
            for (const p of produitsAvecMarges) {
              const cle = p.categorie?.trim() || 'Sans catégorie';
              if (!groupes.has(cle)) groupes.set(cle, []);
              groupes.get(cle)!.push(p);
            }
            const listeGroupes = Array.from(groupes.entries()).sort((a, b) => {
              if (a[0] === 'Sans catégorie') return 1;
              if (b[0] === 'Sans catégorie') return -1;
              return a[0].localeCompare(b[0]);
            });
            return (
              <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {listeGroupes.map(([cat, items]) => {
                  const ouvert = catsOuvertes[cat] ?? false;
                  const moyenneCat = Math.round(items.reduce((s, p) => s + p.pct, 0) / items.length);
                  const catOk = moyenneCat >= 25;
                  return (
                    <div key={cat} style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
                      {/* En-tête repliable */}
                      <button onClick={() => setCatsOuvertes(o => ({ ...o, [cat]: !ouvert }))}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                          <path d="M9 6l6 6-6 6" stroke={T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
                        <span style={{ fontSize: 12, color: T.textMuted }}>{items.length} produit{items.length > 1 ? 's' : ''}</span>
                        <span style={{ background: catOk ? T.greenBg : T.redBg, color: catOk ? T.green : T.red, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '3px 8px', fontFamily: '"Space Grotesk", sans-serif', flexShrink: 0 }}>
                          {moyenneCat}%
                        </span>
                      </button>

                      {/* Produits de la catégorie */}
                      {ouvert && (
                        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {items.map(p => {
                            const isGood = p.pct >= 25;
                            const delta = p.pct - avgPct;
                            return (
                              <div key={p.id} style={{ background: T.bgSubtle, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ width: 46, height: 46, borderRadius: 12, flexShrink: 0, background: isGood ? T.greenBg : T.redBg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ fontSize: 18, fontWeight: 800, color: isGood ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif', lineHeight: 1 }}>{p.pct}</span>
                                  <span style={{ fontSize: 9, fontWeight: 700, color: isGood ? T.green : T.red }}>%</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nom}</div>
                                  <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: '"Space Grotesk", sans-serif' }}>
                                    {fmtF(p.prixVente)} {symbole} · {p.quantite} unités
                                  </div>
                                </div>
                                {delta !== 0 && (
                                  <span style={{ fontSize: 12, fontWeight: 700, color: delta > 0 ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif', flexShrink: 0 }}>
                                    {delta > 0 ? '+' : ''}{delta}%
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
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
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <path d="M2 3h2l2.4 12.4a2 2 0 002 1.6h8.8a2 2 0 002-1.6L22 7H6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="9" cy="20" r="1.4" fill={T.textMuted}/>
                  <circle cx="18" cy="20" r="1.4" fill={T.textMuted}/>
                </svg>
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
                          <div style={{ fontSize: 11, color: T.red, fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                              <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            Prix gros inférieur au prix d&apos;achat — vente à perte
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

      {tab === 'Catalogue' && (
        <div style={{ textAlign: 'center', padding: '60px 16px', color: T.textMuted }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 2v6h6M8 13h8M8 17h5" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>Catalogue</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Bientôt disponible</div>
        </div>
      )}


    </div>
  );
}
