'use client';

import { useState } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { useFournisseurs } from '@/lib/hooks/useFournisseurs';
import { FournisseurFiche } from './FournisseurFiche';

const CHAMPS_VIDES = { nom: '', contact: '', delaiHabituel: '', montantMinimum: '', modePaiement: '' };

export function Fournisseurs() {
  const T = useColors();
  const { fournisseurs, ajouterFournisseur, fournisseurEnRetard } = useFournisseurs();
  const [showForm, setShowForm] = useState(false);
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const [erreur, setErreur] = useState('');
  const [fournisseurOuvertId, setFournisseurOuvertId] = useState<string | null>(null);
  const fournisseurOuvert = fournisseurs.find(f => f.id === fournisseurOuvertId) ?? null;

  async function handleAjouter() {
    setErreur('');
    const err = await ajouterFournisseur({
      nom: champs.nom.trim(),
      contact: champs.contact.trim() || undefined,
      delaiHabituel: Number(champs.delaiHabituel) > 0 ? Number(champs.delaiHabituel) : undefined,
      montantMinimum: Number(champs.montantMinimum) > 0 ? Number(champs.montantMinimum) : undefined,
      modePaiement: champs.modePaiement.trim() || undefined,
    });
    if (err) { setErreur(err); return; }
    setChamps(CHAMPS_VIDES);
    setShowForm(false);
  }

  const champsFormulaire: Array<{ key: keyof typeof CHAMPS_VIDES; label: string; placeholder: string; numerique?: boolean }> = [
    { key: 'nom', label: 'Nom', placeholder: 'Ex : Grossiste Koné' },
    { key: 'contact', label: 'Contact (optionnel)', placeholder: 'Ex : 77 123 45 67' },
    { key: 'delaiHabituel', label: 'Délai de livraison habituel, en jours (optionnel)', placeholder: 'Ex : 7', numerique: true },
    { key: 'montantMinimum', label: 'Montant minimum de commande (optionnel)', placeholder: '0', numerique: true },
    { key: 'modePaiement', label: 'Mode de paiement (optionnel)', placeholder: 'Ex : Mobile Money' },
  ];

  return (
    <div style={{ padding: '0 16px' }}>
      <button
        onClick={() => setShowForm(true)}
        style={{
          width: '100%', height: 48, borderRadius: 12, background: T.accent, color: 'white',
          fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        Ajouter un fournisseur
      </button>

      {showForm && (
        <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Nouveau fournisseur</div>
          {erreur && (
            <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
              {erreur}
            </div>
          )}
          {champsFormulaire.map(({ key, label, placeholder, numerique }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
              <input
                type={numerique ? 'text' : key === 'contact' ? 'tel' : 'text'}
                inputMode={numerique ? 'decimal' : undefined}
                onWheel={e => e.currentTarget.blur()}
                value={champs[key]}
                onChange={e => setChamps(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={() => { setShowForm(false); setErreur(''); setChamps(CHAMPS_VIDES); }}
              style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}
            >
              Annuler
            </button>
            <button
              onClick={handleAjouter}
              style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}
            >
              Confirmer
            </button>
          </div>
        </div>
      )}

      {fournisseurs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun fournisseur</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Ajoute ton premier fournisseur pour suivre tes commandes.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {fournisseurs.map(f => (
            <div
              key={f.id}
              onClick={() => setFournisseurOuvertId(f.id)}
              style={{
                background: T.surface, borderRadius: 14, padding: '14px 16px', boxShadow: T.shadow,
                cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{f.nom}</span>
              {fournisseurEnRetard(f.id) && (
                <span style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>🔴 Livraison en retard</span>
              )}
            </div>
          ))}
        </div>
      )}

      {fournisseurOuvert && (
        <FournisseurFiche fournisseur={fournisseurOuvert} onFermer={() => setFournisseurOuvertId(null)} />
      )}
    </div>
  );
}
