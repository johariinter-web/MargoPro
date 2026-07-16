'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useConfig } from '@/lib/hooks/useConfig';
import { useFournisseurs } from '@/lib/hooks/useFournisseurs';
import { dateLivraisonPrevue, estEnRetard } from '@backend/fournisseurs';
import type { Fournisseur } from '@backend/types';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function FournisseurFiche({ fournisseur, onFermer }: { fournisseur: Fournisseur; onFermer: () => void }) {
  const T = useColors();
  const { config } = useConfig();
  const symbole = config?.symboleDevise ?? 'FCFA';
  const {
    commandesDuFournisseur,
    ajouterCommande,
    marquerCommandeRecue,
    supprimerCommande,
    modifierFournisseur,
    supprimerFournisseur,
  } = useFournisseurs();
  const commandes = commandesDuFournisseur(fournisseur.id);

  const [modeEdition, setModeEdition] = useState(false);
  const [champsEdition, setChampsEdition] = useState({
    nom: fournisseur.nom,
    contact: fournisseur.contact ?? '',
    delaiHabituel: fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '',
    montantMinimum: fournisseur.montantMinimum ? String(fournisseur.montantMinimum) : '',
    modePaiement: fournisseur.modePaiement ?? '',
  });
  const [erreurEdition, setErreurEdition] = useState('');

  const [showCommandeForm, setShowCommandeForm] = useState(false);
  const [delaiJours, setDelaiJours] = useState(fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '');
  const [montant, setMontant] = useState('');
  const [erreurCommande, setErreurCommande] = useState('');

  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [description, setDescription] = useState('');
  const [quantite, setQuantite] = useState('');
  const [commandeSelectionneeId, setCommandeSelectionneeId] = useState<string | null>(null);
  const [confirmerSuppressionCommande, setConfirmerSuppressionCommande] = useState(false);
  const [voirRecues, setVoirRecues] = useState(false);

  async function handleModifier() {
    setErreurEdition('');
    const err = await modifierFournisseur(fournisseur.id, {
      nom: champsEdition.nom.trim(),
      contact: champsEdition.contact.trim() || undefined,
      delaiHabituel: Number(champsEdition.delaiHabituel) > 0 ? Number(champsEdition.delaiHabituel) : undefined,
      montantMinimum: Number(champsEdition.montantMinimum) > 0 ? Number(champsEdition.montantMinimum) : undefined,
      modePaiement: champsEdition.modePaiement.trim() || undefined,
    });
    if (err) { setErreurEdition(err); return; }
    setModeEdition(false);
  }

  async function handleNouvelleCommande() {
    setErreurCommande('');
    const delai = Number(delaiJours);
    const mnt = Number(montant);
    if (delaiJours.trim() === '') { setErreurCommande('Délai de livraison invalide'); return; }
    if (delai < 0) { setErreurCommande('Le délai ne peut pas être négatif'); return; }
    if (!mnt || mnt <= 0) { setErreurCommande('Montant invalide'); return; }
    const err = await ajouterCommande({
      fournisseurId: fournisseur.id,
      dateCommande: Date.now(),
      delaiJours: delai,
      montant: mnt,
      description: description.trim() || undefined,
      quantite: Number(quantite) > 0 ? Number(quantite) : undefined,
    });
    if (err) { setErreurCommande(err); return; }
    setDelaiJours(fournisseur.delaiHabituel ? String(fournisseur.delaiHabituel) : '');
    setMontant('');
    setDescription('');
    setQuantite('');
    setShowCommandeForm(false);
  }

  async function handleSupprimerCommande() {
    if (!commandeSelectionneeId) return;
    await supprimerCommande(commandeSelectionneeId);
    setCommandeSelectionneeId(null);
    setConfirmerSuppressionCommande(false);
  }

  const dateApercu = Number(delaiJours) > 0
    ? new Date(Date.now() + Number(delaiJours) * 86400000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    : null;

  const inputStyle = {
    width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px',
    fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif',
    boxSizing: 'border-box' as const,
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
      onClick={onFermer}
    >
      <div
        style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 36px', maxHeight: '85dvh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />

        {!modeEdition ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: T.text }}>{fournisseur.nom}</div>
              <button
                onClick={() => setModeEdition(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.accent, fontFamily: 'Manrope, sans-serif' }}
              >
                Modifier
              </button>
            </div>

            <div style={{ background: T.bgSubtle, borderRadius: 12, padding: '12px 14px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fournisseur.contact && (
                <a href={`tel:${fournisseur.contact}`} style={{ fontSize: 13, color: T.accent, fontWeight: 600, textDecoration: 'none' }}>
                  📞 {fournisseur.contact}
                </a>
              )}
              {fournisseur.delaiHabituel !== undefined && (
                <div style={{ fontSize: 13, color: T.textSub }}>Délai habituel : {fournisseur.delaiHabituel} jours</div>
              )}
              {fournisseur.montantMinimum !== undefined && (
                <div style={{ fontSize: 13, color: T.textSub }}>Montant minimum : {fmtF(fournisseur.montantMinimum)} {symbole}</div>
              )}
              {fournisseur.modePaiement && (
                <div style={{ fontSize: 13, color: T.textSub }}>Paiement : {fournisseur.modePaiement}</div>
              )}
              {!fournisseur.contact && fournisseur.delaiHabituel === undefined && fournisseur.montantMinimum === undefined && !fournisseur.modePaiement && (
                <div style={{ fontSize: 13, color: T.textMuted }}>Aucune information complémentaire</div>
              )}
            </div>
          </>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 12 }}>Modifier le fournisseur</div>
            {erreurEdition && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreurEdition}
              </div>
            )}
            {([
              { key: 'nom' as const, label: 'Nom', numerique: false },
              { key: 'contact' as const, label: 'Contact (optionnel)', numerique: false },
              { key: 'delaiHabituel' as const, label: 'Délai habituel, en jours (optionnel)', numerique: true },
              { key: 'montantMinimum' as const, label: 'Montant minimum (optionnel)', numerique: true },
              { key: 'modePaiement' as const, label: 'Mode de paiement (optionnel)', numerique: false },
            ]).map(({ key, label, numerique }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
                <input
                  type="text" inputMode={numerique ? 'decimal' : undefined} onWheel={e => e.currentTarget.blur()}
                  value={champsEdition[key]}
                  onChange={e => setChampsEdition(c => ({ ...c, [key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={() => { setModeEdition(false); setErreurEdition(''); }}
                style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
              >
                Annuler
              </button>
              <button
                onClick={handleModifier}
                style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {!modeEdition && (
          <>
            {!showCommandeForm ? (
              <button
                onClick={() => setShowCommandeForm(true)}
                style={{ width: '100%', height: 48, borderRadius: 12, background: T.accent, color: 'white', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 20 }}
              >
                + Nouvelle commande
              </button>
            ) : (
              <div style={{ background: T.bgSubtle, borderRadius: 14, padding: 14, marginBottom: 20 }}>
                {erreurCommande && (
                  <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                    {erreurCommande}
                  </div>
                )}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Description (optionnel)</label>
                  <input
                    type="text" onWheel={e => e.currentTarget.blur()}
                    value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="Ex : Babouches"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Quantité (optionnel)</label>
                  <input
                    type="text" inputMode="decimal" onWheel={e => e.currentTarget.blur()}
                    value={quantite} onChange={e => setQuantite(e.target.value)}
                    placeholder="Ex : 50"
                    style={inputStyle}
                  />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Délai de livraison (jours)</label>
                  <input
                    type="text" inputMode="decimal" onWheel={e => e.currentTarget.blur()}
                    value={delaiJours} onChange={e => setDelaiJours(e.target.value)}
                    placeholder="Ex : 7"
                    style={inputStyle}
                  />
                  {dateApercu && (
                    <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginTop: 4 }}>Livraison prévue : {dateApercu}</div>
                  )}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Montant de la commande ({symbole})</label>
                  <input
                    type="text" inputMode="decimal" onWheel={e => e.currentTarget.blur()}
                    value={montant} onChange={e => setMontant(e.target.value)}
                    placeholder="0"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setShowCommandeForm(false); setErreurCommande(''); }}
                    style={{ flex: 1, height: 44, borderRadius: 12, background: T.surface, border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleNouvelleCommande}
                    style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: T.textMuted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Historique des commandes
            </div>
            {commandes.length === 0 ? (
              <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '20px 0' }}>Aucune commande pour l&apos;instant</div>
            ) : (() => {
              const carteCommande = (c: typeof commandes[number]) => {
                const enRetard = estEnRetard(c);
                const selectionnee = commandeSelectionneeId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => { setCommandeSelectionneeId(id => id === c.id ? null : c.id); setConfirmerSuppressionCommande(false); }}
                    style={{
                      background: selectionnee ? T.accentLight : T.bgSubtle, borderRadius: 12, padding: '10px 14px',
                      border: selectionnee ? `1.5px solid ${T.accent}` : enRetard ? '1.5px solid #EF4444' : `1px solid ${T.border}`,
                      opacity: c.recue ? 0.6 : 1, cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: T.text, textDecoration: c.recue ? 'line-through' : 'none' }}>
                        {c.description ? `${c.description} · ` : ''}{c.quantite ? `${c.quantite} unité${c.quantite > 1 ? 's' : ''} · ` : ''}{fmtF(c.montant)} {symbole}
                      </span>
                      {enRetard && <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 En retard</span>}
                      {c.recue && <span style={{ fontSize: 11, fontWeight: 700, color: T.green }}>✓ Reçue</span>}
                    </div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
                      Commandée le {new Date(c.dateCommande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' · '}Prévue le {new Date(dateLivraisonPrevue(c)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </div>
                    {!c.recue && (
                      <button
                        onClick={e => { e.stopPropagation(); if (commandeSelectionneeId === c.id) { setCommandeSelectionneeId(null); setConfirmerSuppressionCommande(false); } marquerCommandeRecue(c.id); }}
                        style={{ marginTop: 8, height: 32, padding: '0 12px', borderRadius: 8, background: T.greenBg, color: T.green, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
                      >
                        Marquer reçue
                      </button>
                    )}
                  </div>
                );
              };
              const enCours = commandes.filter(c => !c.recue);
              const recues = commandes.filter(c => c.recue);
              return (
                <>
                  {enCours.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: recues.length > 0 ? 8 : 16 }}>
                      {enCours.map(carteCommande)}
                    </div>
                  )}
                  {enCours.length === 0 && recues.length > 0 && (
                    <div style={{ fontSize: 13, color: T.textMuted, textAlign: 'center', padding: '12px 0' }}>Aucune commande en cours</div>
                  )}
                  {recues.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <button
                        onClick={() => setVoirRecues(v => !v)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.textMuted, padding: '4px 0', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}
                      >
                        {voirRecues ? 'Masquer' : `Voir les ${recues.length} commande${recues.length > 1 ? 's' : ''} reçue${recues.length > 1 ? 's' : ''}`}
                      </button>
                      {voirRecues && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {recues.map(carteCommande)}
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {commandeSelectionneeId && (
              confirmerSuppressionCommande ? (
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <button
                    onClick={() => setConfirmerSuppressionCommande(false)}
                    style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSupprimerCommande}
                    style={{ flex: 2, height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red }}
                  >
                    Confirmer la suppression
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmerSuppressionCommande(true)}
                  style={{ width: '100%', height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: T.red, marginBottom: 20 }}
                >
                  Supprimer cette commande
                </button>
              )
            )}

            {confirmerSuppression ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setConfirmerSuppression(false)}
                  style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
                >
                  Annuler
                </button>
                <button
                  onClick={() => { supprimerFournisseur(fournisseur.id); onFermer(); }}
                  style={{ flex: 2, height: 44, borderRadius: 12, background: T.redBg, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red }}
                >
                  Confirmer la suppression
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmerSuppression(true)}
                style={{ width: '100%', height: 44, borderRadius: 12, background: 'none', border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.textMuted }}
              >
                Supprimer ce fournisseur
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
