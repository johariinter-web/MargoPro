'use client';

import { useState } from 'react';
import { useColors, Colors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import {
  calculerRentabiliteExport,
  simulerMargeAuPrixMarche,
  comparerAuMarche,
  PRESETS_PLATEFORME,
  SEUILS_RENTABILITE,
  type PlateformeVente,
  type RentabiliteExportInput,
} from '@backend/rentabiliteExport';

function fmtF(n: number) {
  if (!isFinite(n)) return '—';
  return (Math.round(n * 100) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
}

function num(v: string): number {
  return Number(v.replace(',', '.')) || 0;
}

function Champ({ T, label, value, onChange, placeholder, unite }: {
  T: Colors; label: string; value: string; onChange: (v: string) => void; placeholder?: string; unite?: string;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          type="text" inputMode="decimal" onFocus={e => e.target.select()}
          value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? '0'}
          style={{
            width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10,
            padding: unite ? '10px 44px 10px 12px' : '10px 12px', fontSize: 15, color: T.text,
            background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box',
          }}
        />
        {unite && (
          <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, fontWeight: 700, color: T.textMuted }}>{unite}</span>
        )}
      </div>
    </div>
  );
}

function Badge({ T, ok, texte, niveau }: { T: Colors; ok: boolean; texte: string; niveau?: 'alerte' | 'limite' | 'ok' }) {
  const n = niveau ?? (ok ? 'ok' : 'alerte');
  const couleurs = { ok: [T.green, T.greenBg], limite: [T.amber, T.amberBg], alerte: [T.red, T.redBg] }[n];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: couleurs[0], background: couleurs[1], borderRadius: 20, padding: '3px 9px', whiteSpace: 'nowrap' }}>
      {texte}
    </span>
  );
}

export function RentabiliteExportTab() {
  const T = useColors();
  const { config } = useConfig();
  const symbole = config?.symboleDevise ?? 'FCFA';

  const [avanceOuvert, setAvanceOuvert] = useState(false);
  const [marcheOuvert, setMarcheOuvert] = useState(false);

  const [coutProduit, setCoutProduit] = useState('');
  const [deviseAchat, setDeviseAchat] = useState('USD');
  const [tauxChange, setTauxChange] = useState('1');
  const [margeSecuriteChange, setMargeSecuriteChange] = useState('3');
  const [fraisTransport, setFraisTransport] = useState('');

  const [droitsDouane, setDroitsDouane] = useState('0');
  const [tvaAchat, setTvaAchat] = useState('0');
  const [fraisCaches, setFraisCaches] = useState('0');
  const [tvaVente, setTvaVente] = useState('0');

  const [plateforme, setPlateforme] = useState<PlateformeVente>('site-propre');
  const [commissionPct, setCommissionPct] = useState(String(PRESETS_PLATEFORME['site-propre'].commissionPct));
  const [fraisFixePlateforme, setFraisFixePlateforme] = useState(String(PRESETS_PLATEFORME['site-propre'].fraisFixe));
  const [fraisTraitementPct, setFraisTraitementPct] = useState(String(PRESETS_PLATEFORME['site-propre'].fraisTraitementPct));

  const [tauxRetour, setTauxRetour] = useState('5');
  const [budgetPub, setBudgetPub] = useState('10');
  const [margeCibleAvantPub, setMargeCibleAvantPub] = useState(String(SEUILS_RENTABILITE.margeAvantPubDefaut));

  const [prixMarcheMin, setPrixMarcheMin] = useState('');
  const [prixMarcheMax, setPrixMarcheMax] = useState('');

  function changerPlateforme(p: PlateformeVente) {
    setPlateforme(p);
    const preset = PRESETS_PLATEFORME[p];
    setCommissionPct(String(preset.commissionPct));
    setFraisFixePlateforme(String(preset.fraisFixe));
    setFraisTraitementPct(String(preset.fraisTraitementPct));
  }

  const input: RentabiliteExportInput = {
    coutProduit: num(coutProduit),
    tauxChange: num(tauxChange) || 1,
    margeSecuriteChangePct: num(margeSecuriteChange),
    fraisTransportUnitaire: num(fraisTransport),
    droitsDouanePct: num(droitsDouane),
    tvaAchatPct: num(tvaAchat),
    fraisCachesFixe: num(fraisCaches),
    tauxRetourPct: num(tauxRetour),
    commissionPlateformePct: num(commissionPct),
    fraisFixePlateforme: num(fraisFixePlateforme),
    fraisTraitementPaiementPct: num(fraisTraitementPct),
    margeCibleAvantPubPct: num(margeCibleAvantPub),
    budgetPubPct: num(budgetPub),
    tvaVentePct: num(tvaVente),
  };

  const aDesDonnees = input.coutProduit > 0;
  const resultat = aDesDonnees ? calculerRentabiliteExport(input) : null;

  const marcheMinNum = num(prixMarcheMin);
  const marcheMaxNum = num(prixMarcheMax);
  const marcheRenseigne = marcheMinNum > 0 && marcheMaxNum > 0;
  const positionMarche = marcheRenseigne && resultat?.possible ? comparerAuMarche(resultat.prixVenteTTC, marcheMinNum, marcheMaxNum) : null;
  const simMarche = marcheRenseigne && aDesDonnees ? simulerMargeAuPrixMarche(input, (marcheMinNum + marcheMaxNum) / 2) : null;

  return (
    <div style={{ padding: '0 16px', fontFamily: 'Manrope, sans-serif' }}>
      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.5, marginBottom: 14 }}>
        Calcule ton vrai prix de vente en incluant transport, douane, change, plateforme et retours — puis compare-le au marché.
      </div>

      {/* COUTS DE BASE */}
      <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>Coûts de base</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 2 }}>
            <Champ T={T} label="Prix d'achat (devise achat)" value={coutProduit} onChange={setCoutProduit} />
          </div>
          <div style={{ flex: 1 }}>
            <Champ T={T} label="Devise achat" value={deviseAchat} onChange={setDeviseAchat} placeholder="USD" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Champ T={T} label={`Taux de change (1 ${deviseAchat || 'devise'} = ? ${symbole})`} value={tauxChange} onChange={setTauxChange} />
          </div>
          <div style={{ flex: 1 }}>
            <Champ T={T} label="Marge sécurité change" value={margeSecuriteChange} onChange={setMargeSecuriteChange} unite="%" />
          </div>
        </div>
        <Champ T={T} label={`Transport par unité (${symbole})`} value={fraisTransport} onChange={setFraisTransport} />
      </div>

      {/* OPTIONS AVANCEES : import + plateforme */}
      <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, marginBottom: 12, overflow: 'hidden' }}>
        <button onClick={() => setAvanceOuvert(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: avanceOuvert ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M9 6l6 6-6 6" stroke={T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 700, color: T.text }}>Douane, TVA, plateforme, retours (optionnel)</span>
        </button>
        {avanceOuvert && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><Champ T={T} label="Droits de douane" value={droitsDouane} onChange={setDroitsDouane} unite="%" /></div>
              <div style={{ flex: 1 }}><Champ T={T} label="TVA à l'achat" value={tvaAchat} onChange={setTvaAchat} unite="%" /></div>
            </div>
            <Champ T={T} label={`Autres frais cachés par unité (${symbole})`} value={fraisCaches} onChange={setFraisCaches} placeholder="banque, emballage, stockage..." />

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Plateforme de vente</label>
              <select value={plateforme} onChange={e => changerPlateforme(e.target.value as PlateformeVente)}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', cursor: 'pointer' }}>
                {(Object.entries(PRESETS_PLATEFORME) as [PlateformeVente, typeof PRESETS_PLATEFORME[PlateformeVente]][]).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><Champ T={T} label="Commission" value={commissionPct} onChange={setCommissionPct} unite="%" /></div>
              <div style={{ flex: 1 }}><Champ T={T} label="Traitement paiement" value={fraisTraitementPct} onChange={setFraisTraitementPct} unite="%" /></div>
            </div>
            <Champ T={T} label={`Frais fixe par commande (${symbole})`} value={fraisFixePlateforme} onChange={setFraisFixePlateforme} />
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><Champ T={T} label="Taux de retour attendu" value={tauxRetour} onChange={setTauxRetour} unite="%" /></div>
              <div style={{ flex: 1 }}><Champ T={T} label="TVA à la vente" value={tvaVente} onChange={setTvaVente} unite="%" /></div>
            </div>
          </div>
        )}
      </div>

      {/* OBJECTIFS */}
      <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>Objectifs de rentabilité</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}><Champ T={T} label="Marge cible avant pub" value={margeCibleAvantPub} onChange={setMargeCibleAvantPub} unite="%" /></div>
          <div style={{ flex: 1 }}><Champ T={T} label="Budget pub par vente" value={budgetPub} onChange={setBudgetPub} unite="%" /></div>
        </div>
        <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
          Repères : marge après pub {SEUILS_RENTABILITE.margeApresPubMin}-{SEUILS_RENTABILITE.margeApresPubCible}%, ROI {SEUILS_RENTABILITE.roiAcceptable}% acceptable / {SEUILS_RENTABILITE.roiCible}% cible.
        </div>
      </div>

      {/* RESULTAT */}
      {resultat && aDesDonnees && (
        resultat.possible ? (
          <div style={{ background: T.accentLight, borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Prix de vente conseillé (HT)</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(resultat.prixVenteHT)} {symbole}</span>
            </div>
            {input.tvaVentePct > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: T.textSub }}>Prix TTC</span>
                <span style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(resultat.prixVenteTTC)} {symbole}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <span style={{ fontSize: 13, color: T.textSub }}>Coût de revient réel (retours inclus)</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(resultat.coutRevientAjusteRetours)} {symbole}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: T.textSub }}>Marge avant pub</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 15, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(resultat.margeAvantPubPct)}%</strong>
                <Badge T={T} ok={resultat.margeAvantPubPct >= input.margeCibleAvantPubPct} texte={resultat.margeAvantPubPct >= input.margeCibleAvantPubPct ? 'OK' : 'Faible'} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: T.textSub }}>Marge après pub</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 15, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(resultat.margeApresPubPct)}%</strong>
                <Badge T={T}
                  ok={resultat.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubCible}
                  niveau={resultat.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubCible ? 'ok' : resultat.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubMin ? 'limite' : 'alerte'}
                  texte={resultat.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubCible ? 'OK' : resultat.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubMin ? 'Limite' : 'Faible'}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: T.textSub }}>ROI</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 15, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(resultat.roiPct)}%</strong>
                <Badge T={T}
                  ok={resultat.roiPct >= SEUILS_RENTABILITE.roiCible}
                  niveau={resultat.roiPct >= SEUILS_RENTABILITE.roiCible ? 'ok' : resultat.roiPct >= SEUILS_RENTABILITE.roiAcceptable ? 'limite' : 'alerte'}
                  texte={resultat.roiPct >= SEUILS_RENTABILITE.roiCible ? 'Cible atteinte' : resultat.roiPct >= SEUILS_RENTABILITE.roiAcceptable ? 'Acceptable' : 'Insuffisant'}
                />
              </div>
            </div>
          </div>
        ) : (
          <div style={{ background: T.redBg, borderRadius: 16, padding: 16, marginBottom: 12, fontSize: 13, color: T.red, fontWeight: 600, lineHeight: 1.5 }}>
            Impossible d&apos;atteindre cette marge : la somme de la marge cible et des frais plateforme dépasse 100% du prix de vente. Réduis la marge cible ou les frais.
          </div>
        )
      )}

      {/* MARCHE */}
      <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, marginBottom: 12, overflow: 'hidden' }}>
        <button onClick={() => setMarcheOuvert(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: marcheOuvert ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
            <path d="M9 6l6 6-6 6" stroke={T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ flex: 1, textAlign: 'left', fontSize: 13, fontWeight: 700, color: T.text }}>Comparer au marché (optionnel)</span>
        </button>
        {marcheOuvert && (
          <div style={{ padding: '0 16px 16px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}><Champ T={T} label={`Prix marché bas (${symbole})`} value={prixMarcheMin} onChange={setPrixMarcheMin} /></div>
              <div style={{ flex: 1 }}><Champ T={T} label={`Prix marché haut (${symbole})`} value={prixMarcheMax} onChange={setPrixMarcheMax} /></div>
            </div>

            {marcheRenseigne && resultat?.possible && positionMarche && simMarche && (
              <div style={{ background: T.bgSubtle, borderRadius: 12, padding: 14, marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.textSub }}>Ton prix vs le marché</span>
                  <Badge T={T}
                    ok={positionMarche.position === 'aligne'}
                    niveau={positionMarche.position === 'aligne' ? 'ok' : positionMarche.position === 'sous_le_marche' ? 'limite' : 'alerte'}
                    texte={positionMarche.position === 'aligne' ? 'Aligné' : positionMarche.position === 'sous_le_marche' ? 'Sous le marché' : 'Au-dessus du marché'}
                  />
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 10 }}>
                  {positionMarche.ecartPctVsMoyenne > 0 ? '+' : ''}{fmtF(positionMarche.ecartPctVsMoyenne)}% vs la moyenne du marché
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  Si tu vends au prix moyen du marché ({fmtF((marcheMinNum + marcheMaxNum) / 2)} {symbole})
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: T.textSub }}>Marge réelle après pub</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(simMarche.margeApresPubPct)}%</strong>
                    <Badge T={T}
                      ok={simMarche.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubCible}
                      niveau={simMarche.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubCible ? 'ok' : simMarche.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubMin ? 'limite' : 'alerte'}
                      texte={simMarche.margeApresPubPct >= SEUILS_RENTABILITE.margeApresPubMin ? 'Viable' : 'Trop faible'}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: T.textSub }}>ROI réel</span>
                  <strong style={{ fontSize: 14, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(simMarche.roiPct)}%</strong>
                </div>
                {simMarche.margeApresPubPct < SEUILS_RENTABILITE.margeApresPubMin && (
                  <div style={{ fontSize: 12, color: T.red, fontWeight: 600, marginTop: 10, lineHeight: 1.5 }}>
                    Au prix du marché, ta marge après pub est en dessous du minimum viable ({SEUILS_RENTABILITE.margeApresPubMin}%). Réduis tes coûts ou vise un positionnement différent.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
