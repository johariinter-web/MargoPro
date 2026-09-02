'use client';

import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { depensesDuMois, totalDepenses, margePlancher } from '@backend/depenses';
import { AccesPremiumRequis } from './AccesPremiumRequis';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const PLANCHER_DEFAUT = 25;

export function MargeTab() {
  const T = useColors();
  const { produits } = useStock();
  const { config } = useConfig();
  const { depenses } = useDepenses();
  const { stats } = useVentes('mois');
  const { accesFonctionnalitesPremium } = usePlan();
  const [catsOuvertes, setCatsOuvertes] = useState<Record<string, boolean>>({});

  const symbole = config?.symboleDevise ?? 'FCFA';

  if (!accesFonctionnalitesPremium) {
    return (
      <div style={{ padding: '0 16px' }}>
        <AccesPremiumRequis titre="Marge" description="Connais ta vraie marge, celle qui couvre aussi les charges de ta boutique." />
      </div>
    );
  }

  const chargesDuMois = totalDepenses(depensesDuMois(depenses));
  const plancherPct = margePlancher(chargesDuMois, stats.chiffreAffaires);
  const seuilAffichage = plancherPct ?? PLANCHER_DEFAUT;

  const produitsAvecMarges = produits.map(p => ({
    ...p,
    pct: p.prixVente > 0 ? Math.round((p.prixVente - p.prixAchat) / p.prixVente * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  const avgPct = produitsAvecMarges.length > 0
    ? Math.round(produitsAvecMarges.reduce((s, p) => s + p.pct, 0) / produitsAvecMarges.length)
    : 0;

  return (
    <div style={{ padding: '0 16px' }}>
      {/* MARGE PLANCHER */}
      <div style={{ background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
          Marge plancher
        </div>
        {plancherPct === null ? (
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Pas encore assez de ventes ce mois pour calculer ta marge plancher.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.red, fontFamily: '"Space Grotesk", sans-serif', marginBottom: 6 }}>
              {plancherPct}%
            </div>
            <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.5 }}>
              En dessous de {plancherPct}%, tu ne gagnes rien une fois tes charges payées.
            </div>
          </>
        )}
        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, lineHeight: 1.5 }}>
          💡 Repère : produits courants x1,3 à x2 le prix d&apos;achat, produits à forte valeur (cosmétique, habillement...) x3 à x5.
        </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {listeGroupes.map(([cat, items]) => {
              const ouvert = catsOuvertes[cat] ?? false;
              const moyenneCat = Math.round(items.reduce((s, p) => s + p.pct, 0) / items.length);
              const catOk = moyenneCat >= seuilAffichage;
              return (
                <div key={cat} style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
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
                  {ouvert && (
                    <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {items.map(p => {
                        const isGood = p.pct >= seuilAffichage;
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
    </div>
  );
}
