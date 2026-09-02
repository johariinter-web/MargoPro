'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import { useDepenses } from '@/lib/hooks/useDepenses';
import { useVentes } from '@/lib/hooks/useVentes';
import { usePlan } from '@/lib/hooks/usePlan';
import { depensesDuMois, totalDepenses, objectifVenteParJour } from '@backend/depenses';
import { AccesPremiumRequis } from './AccesPremiumRequis';
import type { Depense } from '@backend/types';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function dateInputValue(timestamp: number): string {
  const d = new Date(timestamp);
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function parseDateLocale(iso: string): number {
  const [annee, mois, jour] = iso.split('-').map(Number);
  return new Date(annee, mois - 1, jour).getTime();
}

const champsVides = () => ({ nom: '', montant: '', date: dateInputValue(Date.now()) });

export function SeuilRentabilite() {
  const T = useColors();
  const { config } = useConfig();
  const { depenses, ajouterDepense, modifierDepense, supprimerDepense } = useDepenses();
  const { stats } = useVentes('mois');
  const { accesFonctionnalitesPremium } = usePlan();
  const symbole = config?.symboleDevise ?? 'FCFA';

  const [showForm, setShowForm] = useState(false);
  const [champs, setChamps] = useState(champsVides());
  const [erreur, setErreur] = useState('');
  const [depenseEnEdition, setDepenseEnEdition] = useState<Depense | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  if (!accesFonctionnalitesPremium) {
    return (
      <div style={{ padding: '0 16px' }}>
        <AccesPremiumRequis titre="Seuil de rentabilité" description="Sais combien vendre par jour pour couvrir tes charges et être vraiment rentable." />
      </div>
    );
  }

  const depensesMois = depensesDuMois(depenses);
  const chargesDuMois = totalDepenses(depensesMois);
  const objectif = objectifVenteParJour(chargesDuMois, stats.benefice, stats.nombreVentes);
  const progression = chargesDuMois > 0 ? Math.min(100, Math.round((stats.benefice / chargesDuMois) * 100)) : 0;

  async function handleAjouter() {
    setErreur('');
    const err = await ajouterDepense({
      nom: champs.nom.trim(),
      montant: Number(champs.montant),
      date: parseDateLocale(champs.date),
    });
    if (err) { setErreur(err); return; }
    setChamps(champsVides());
    setShowForm(false);
  }

  function ouvrirEdition(d: Depense) {
    setShowForm(false);
    setErreur('');
    setDepenseEnEdition(d);
    setChamps({ nom: d.nom, montant: String(d.montant), date: dateInputValue(d.date) });
    setConfirmerSuppression(false);
  }

  async function handleModifier() {
    if (!depenseEnEdition) return;
    setErreur('');
    const err = await modifierDepense(depenseEnEdition.id, {
      nom: champs.nom.trim(),
      montant: Number(champs.montant),
      date: parseDateLocale(champs.date),
    });
    if (err) { setErreur(err); return; }
    setDepenseEnEdition(null);
    setChamps(champsVides());
    setConfirmerSuppression(false);
  }

  const inputStyle = {
    width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
    fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif',
    boxSizing: 'border-box' as const,
  };

  return (
    <div style={{ padding: '0 16px' }}>
      {/* CHARGES DU MOIS */}
      <div style={{ background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Charges du mois
          </div>
          <button
            onClick={() => { setDepenseEnEdition(null); setChamps(champsVides()); setShowForm(true); setConfirmerSuppression(false); }}
            style={{ height: 32, padding: '0 12px', borderRadius: 8, background: T.accentLight, color: T.accent, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}
          >
            + Dépense
          </button>
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif', marginBottom: 4 }}>
          {fmtF(chargesDuMois)} <span style={{ fontSize: 15 }}>{symbole}</span>
        </div>

        {(showForm || depenseEnEdition) && (
          <div style={{ background: T.bgSubtle, borderRadius: 14, padding: 14, marginTop: 12 }}>
            {erreur && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreur}
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom (ex : Loyer, Transport)</label>
              <input type="text" value={champs.nom} onChange={e => setChamps(c => ({ ...c, nom: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Montant ({symbole})</label>
              <input type="number" onWheel={e => e.currentTarget.blur()} onFocus={e => e.target.select()} value={champs.montant} onChange={e => setChamps(c => ({ ...c, montant: e.target.value }))} placeholder="0" min="0" style={inputStyle} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Date</label>
              <input type="date" value={champs.date} onChange={e => setChamps(c => ({ ...c, date: e.target.value }))} max={dateInputValue(Date.now())} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { setShowForm(false); setDepenseEnEdition(null); setErreur(''); setConfirmerSuppression(false); }}
                style={{ flex: 1, height: 44, borderRadius: 12, background: T.surface, border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}
              >
                Annuler
              </button>
              <button
                onClick={depenseEnEdition ? handleModifier : handleAjouter}
                style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}
              >
                {depenseEnEdition ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
            {depenseEnEdition && (
              confirmerSuppression ? (
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button
                    onClick={() => setConfirmerSuppression(false)}
                    style={{ flex: 1, height: 40, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => { supprimerDepense(depenseEnEdition.id); setDepenseEnEdition(null); setChamps(champsVides()); setConfirmerSuppression(false); }}
                    style={{ flex: 2, height: 40, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif' }}
                  >
                    Confirmer la suppression
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmerSuppression(true)}
                  style={{ width: '100%', height: 40, marginTop: 8, borderRadius: 12, background: 'none', border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textMuted, fontFamily: 'Manrope, sans-serif' }}
                >
                  Supprimer cette dépense
                </button>
              )
            )}
          </div>
        )}

        {depensesMois.length > 0 && !showForm && !depenseEnEdition && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {depensesMois.map(d => (
              <button
                key={d.id}
                onClick={() => ouvrirEdition(d)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: T.bgSubtle, borderRadius: 10, padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'Manrope, sans-serif' }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{d.nom}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.textSub, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(d.montant)} {symbole}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* PROGRESSION ET OBJECTIF */}
      <div style={{ background: T.surface, borderRadius: 20, padding: 16, boxShadow: T.shadow }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
          Progression ce mois
        </div>

        {chargesDuMois === 0 ? (
          <div style={{ fontSize: 13, color: T.textMuted }}>
            Ajoute tes charges pour voir ta progression vers la rentabilité.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: T.textSub, marginBottom: 6 }}>
              <span>{fmtF(stats.benefice)} {symbole} générés</span>
              <span>{fmtF(chargesDuMois)} {symbole} à couvrir</span>
            </div>
            <div style={{ width: '100%', height: 10, borderRadius: 6, background: T.bgSubtle, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{ width: `${progression}%`, height: '100%', background: progression >= 100 ? T.green : T.accent, borderRadius: 6 }} />
            </div>

            {objectif.seuilAtteint ? (
              <div style={{ background: T.greenBg, borderRadius: 12, padding: '12px 14px', fontSize: 13, fontWeight: 600, color: T.green }}>
                Tu as couvert tes charges ce mois, tout bénéfice supplémentaire est net pour toi.
              </div>
            ) : objectif.ventesParJour === null ? (
              <div style={{ fontSize: 13, color: T.textMuted }}>
                Pas encore assez de ventes ce mois pour calculer ton objectif.
              </div>
            ) : (
              <div style={{ background: T.accentLight, borderRadius: 12, padding: '12px 14px' }}>
                <div style={{ fontSize: 13, color: T.textSub, marginBottom: 4 }}>Objectif</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                  ≈ {objectif.ventesParJour} vente{objectif.ventesParJour > 1 ? 's' : ''}/jour
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>jusqu&apos;à la fin du mois</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
