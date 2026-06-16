'use client';

import { useState } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';
import { useCategories } from '@/lib/hooks/useCategories';
import BarcodeScanner from '@/components/BarcodeScanner';
import type { Produit } from '@backend/types';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

const CHAMPS_VIDES = {
  nom: '', quantite: '', prixAchat: '', prixVente: '',
  seuilAlerte: '5', codeBarres: '', categorie: '', tailleConditionnement: '',
};

export default function StockPage() {
  const T = useColors();
  const { config } = useConfig();
  const { produits, alertes, ajouterProduit, supprimerProduit, modifierProduit } = useStock();
  const { categories, ajouterCategorie } = useCategories();

  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [produitEnEdition, setProduitEnEdition] = useState<Produit | null>(null);
  const [champsEdition, setChampsEdition] = useState({ ...CHAMPS_VIDES });
  const [erreurEdition, setErreurEdition] = useState('');

  const symbole = config?.symboleDevise ?? 'FCFA';

  const produitsFiltres = produits.filter(p =>
    p.nom.toLowerCase().includes(recherche.toLowerCase())
  );

  function handleScan(barcode: string) {
    setShowScanner(false);
    const found = produits.find(p => p.codeBarres === barcode);
    if (found) setRecherche(found.nom);
    else { setChamps(c => ({ ...c, codeBarres: barcode })); setShowForm(true); }
  }

  function openEditer(produit: Produit) {
    setProduitEnEdition(produit);
    setChampsEdition({
      nom: produit.nom,
      quantite: produit.tailleConditionnement && produit.tailleConditionnement > 0
        ? String(Math.round(produit.quantite / produit.tailleConditionnement))
        : String(produit.quantite),
      prixAchat: String(produit.prixAchat),
      prixVente: String(produit.prixVente),
      seuilAlerte: String(produit.seuilAlerte),
      codeBarres: produit.codeBarres ?? '',
      categorie: produit.categorie ?? '',
      tailleConditionnement: produit.tailleConditionnement ? String(produit.tailleConditionnement) : '',
    });
    setErreurEdition('');
  }

  async function handleEditer() {
    if (!produitEnEdition) return;
    setErreurEdition('');
    if (!champsEdition.nom.trim()) { setErreurEdition('Le nom est obligatoire'); return; }
    const taille = Number(champsEdition.tailleConditionnement);
    const data: {
      nom: string; quantite: number; prixAchat: number; prixVente: number;
      seuilAlerte: number; codeBarres?: string; categorie?: string; tailleConditionnement?: number;
    } = {
      nom: champsEdition.nom.trim(),
      quantite: taille > 0 ? Number(champsEdition.quantite) * taille : Number(champsEdition.quantite),
      prixAchat: Number(champsEdition.prixAchat),
      prixVente: Number(champsEdition.prixVente),
      seuilAlerte: Number(champsEdition.seuilAlerte) || 5,
    };
    if (champsEdition.codeBarres.trim()) data.codeBarres = champsEdition.codeBarres.trim();
    if (champsEdition.categorie.trim()) {
      data.categorie = champsEdition.categorie.trim();
      if (!categories.includes(champsEdition.categorie.trim())) {
        ajouterCategorie(champsEdition.categorie.trim());
      }
    }
    if (taille > 0) data.tailleConditionnement = taille;
    const err = await modifierProduit(produitEnEdition.id, data);
    if (err) { setErreurEdition(err); return; }
    setChampsEdition({ ...CHAMPS_VIDES });
    setProduitEnEdition(null);
  }

  async function handleAjouter() {
    setErreur('');
    const taille = Number(champs.tailleConditionnement);
    const quantiteCalculee = taille > 0
      ? Number(champs.quantite) * taille
      : Number(champs.quantite);

    const data: Parameters<typeof ajouterProduit>[0] = {
      nom: champs.nom.trim(),
      quantite: quantiteCalculee,
      prixAchat: Number(champs.prixAchat),
      prixVente: Number(champs.prixVente),
      seuilAlerte: Number(champs.seuilAlerte) || 5,
    };
    if (champs.codeBarres.trim()) data.codeBarres = champs.codeBarres.trim();
    if (champs.categorie.trim()) {
      data.categorie = champs.categorie.trim();
      if (!categories.includes(champs.categorie.trim())) {
        ajouterCategorie(champs.categorie.trim());
      }
    }
    if (taille > 0) data.tailleConditionnement = taille;

    const err = await ajouterProduit(data);
    if (err) { setErreur(err); return; }
    setChamps(CHAMPS_VIDES);
    setShowForm(false);
  }

  const stockValue = produits.reduce((sum, p) => sum + p.prixAchat * p.quantite, 0);

  // Category breakdown for Détail modal
  const parCategorie = categories.map(cat => {
    const ps = produits.filter(p => p.categorie === cat);
    const valeur = ps.reduce((s, p) => s + p.prixAchat * p.quantite, 0);
    return { cat, count: ps.length, valeur };
  }).filter(g => g.count > 0);

  const sansCat = produits.filter(p => !p.categorie);
  if (sansCat.length > 0) {
    parCategorie.push({
      cat: 'Sans catégorie',
      count: sansCat.length,
      valeur: sansCat.reduce((s, p) => s + p.prixAchat * p.quantite, 0),
    });
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 90, fontFamily: 'Manrope, sans-serif' }}>

      {/* SCANNER */}
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* BOTTOM SHEET ÉDITION */}
      {produitEnEdition && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setProduitEnEdition(null)}
        >
          <div
            style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px', maxHeight: '90dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 16 }}>Modifier le produit</div>

            {erreurEdition && (
              <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
                {erreurEdition}
              </div>
            )}

            {/* Nom */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du produit</label>
              <input type="text" value={champsEdition.nom} onChange={e => setChampsEdition(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Savon Protex"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>

            {/* Unités par paquet */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Unités par paquet (optionnel)</label>
              <input type="number" value={champsEdition.tailleConditionnement} onChange={e => setChampsEdition(c => ({ ...c, tailleConditionnement: e.target.value }))} placeholder="Ex: 12" min="1"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>

            {/* Quantité */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
                {Number(champsEdition.tailleConditionnement) > 0 ? 'Nombre de paquets' : 'Quantité en stock'}
              </label>
              <input type="number" value={champsEdition.quantite} onChange={e => setChampsEdition(c => ({ ...c, quantite: e.target.value }))} placeholder="0" min="0"
                step={Number(champsEdition.tailleConditionnement) > 0 ? '1' : 'any'}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              {Number(champsEdition.tailleConditionnement) > 0 && Number(champsEdition.quantite) > 0 && (
                <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginTop: 4 }}>
                  {champsEdition.quantite} paquet{Number(champsEdition.quantite) > 1 ? 's' : ''} × {champsEdition.tailleConditionnement} = {Number(champsEdition.quantite) * Number(champsEdition.tailleConditionnement)} unités
                </div>
              )}
            </div>

            {/* Autres champs numériques */}
            {[
              { key: 'prixAchat', label: `Prix d'achat (${symbole})`, placeholder: '0' },
              { key: 'prixVente', label: `Prix de vente (${symbole})`, placeholder: '0' },
              { key: 'seuilAlerte', label: "Seuil d'alerte", placeholder: '5' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
                <input type="number" value={champsEdition[key as keyof typeof champsEdition]} onChange={e => setChampsEdition(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} min="0"
                  style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              </div>
            ))}

            {/* Code-barres */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Code-barres (optionnel)</label>
              <input type="text" value={champsEdition.codeBarres} onChange={e => setChampsEdition(c => ({ ...c, codeBarres: e.target.value }))} placeholder="Ex: 3017620422003"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>

            {/* Catégorie */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 6 }}>Catégorie</label>
              <input type="text" value={champsEdition.categorie} onChange={e => setChampsEdition(c => ({ ...c, categorie: e.target.value }))} placeholder="Taper ou choisir..."
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', marginBottom: categories.length > 0 ? 8 : 0 }} />
              {categories.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setChampsEdition(c => ({ ...c, categorie: c.categorie === cat ? '' : cat }))}
                      style={{ height: 28, borderRadius: 20, padding: '0 10px', fontSize: 12, fontWeight: 600, border: `1.5px solid ${champsEdition.categorie === cat ? T.accent : T.border}`, cursor: 'pointer', background: champsEdition.categorie === cat ? T.accentLight : 'transparent', color: champsEdition.categorie === cat ? T.accent : T.textSub }}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setProduitEnEdition(null)} style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}>
                Annuler
              </button>
              <button onClick={handleEditer} style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}>
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DÉTAIL MODAL */}
      {showDetail && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setShowDetail(false)}
        >
          <div
            style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>Valeur par catégorie</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Total : <strong style={{ color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{fmtF(stockValue)} {symbole}</strong>
            </div>
            {parCategorie.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.textMuted, fontSize: 14 }}>
                Aucun produit avec catégorie
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parCategorie.sort((a, b) => b.valeur - a.valeur).map(g => {
                  const pct = stockValue > 0 ? Math.round(g.valeur / stockValue * 100) : 0;
                  return (
                    <div key={g.cat} style={{ background: T.bgSubtle, borderRadius: 12, padding: '12px 14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{g.cat}</span>
                          <span style={{ fontSize: 12, color: T.textMuted, marginLeft: 8 }}>{g.count} produit{g.count > 1 ? 's' : ''}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: '"Space Grotesk", sans-serif' }}>
                          {fmtF(g.valeur)} {symbole}
                        </span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: T.border }}>
                        <div style={{ height: '100%', borderRadius: 2, background: T.accent, width: `${pct}%`, transition: 'width 0.4s' }} />
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, textAlign: 'right' }}>{pct}%</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: T.text }}>Stock</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowScanner(true)} style={{ width: 40, height: 40, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke={T.textSub} strokeWidth="1.75" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="4" stroke={T.textSub} strokeWidth="1.75"/>
            </svg>
          </button>
          <button onClick={() => setShowForm(true)} style={{ height: 40, borderRadius: 12, background: T.accent, color: 'white', fontSize: 13, fontWeight: 700, padding: '0 14px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div style={{ margin: '0 16px 10px', background: T.bgSubtle, borderRadius: 12, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="8" stroke={T.textMuted} strokeWidth="1.75"/>
          <path d="M21 21l-4.35-4.35" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round"/>
        </svg>
        <input
          type="search"
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher un produit..."
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: T.text, outline: 'none', fontFamily: 'Manrope, sans-serif' }}
        />
      </div>

      {/* ADD FORM */}
      {showForm && (
        <div style={{ margin: '0 16px 12px', background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Nouveau produit</div>
          {erreur && (
            <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
              {erreur}
            </div>
          )}

          {/* Nom */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du produit</label>
            <input type="text" value={champs.nom} onChange={e => setChamps(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Savon Protex"
              style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
          </div>

          {/* Unités par paquet — AVANT quantite pour que le label change en temps réel */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Unités par paquet (optionnel)</label>
            <input type="number" value={champs.tailleConditionnement} onChange={e => setChamps(c => ({ ...c, tailleConditionnement: e.target.value }))} placeholder="Ex: 12 pour un carton de 12" min="1"
              style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
          </div>

          {/* Quantité — label dynamique */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
              {Number(champs.tailleConditionnement) > 0 ? 'Nombre de paquets reçus' : 'Quantité'}
            </label>
            <input type="number" value={champs.quantite} onChange={e => setChamps(c => ({ ...c, quantite: e.target.value }))} placeholder="0" min="0" step={Number(champs.tailleConditionnement) > 0 ? '1' : 'any'}
              style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            {Number(champs.tailleConditionnement) > 0 && Number(champs.quantite) > 0 && (
              <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginTop: 4 }}>
                {champs.quantite} paquet{Number(champs.quantite) > 1 ? 's' : ''} × {champs.tailleConditionnement} = {Number(champs.quantite) * Number(champs.tailleConditionnement)} unités
              </div>
            )}
          </div>

          {/* Autres champs */}
          {[
            { key: 'prixAchat', label: `Prix d'achat (${symbole})`, placeholder: '0', type: 'number' },
            { key: 'prixVente', label: `Prix de vente (${symbole})`, placeholder: '0', type: 'number' },
            { key: 'seuilAlerte', label: "Seuil d'alerte stock bas", placeholder: '5', type: 'number' },
            { key: 'codeBarres', label: 'Code-barres (optionnel)', placeholder: 'Ex: 3017620422003', type: 'text' },
          ].map(({ key, label, placeholder, type }) => (
            <div key={key} style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>{label}</label>
              <input type={type} value={champs[key as keyof typeof champs]} onChange={e => setChamps(c => ({ ...c, [key]: e.target.value }))} placeholder={placeholder} min={type === 'number' ? '0' : undefined}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>
          ))}

          {/* Catégorie */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 6 }}>Catégorie</label>
            <input
              type="text"
              value={champs.categorie}
              onChange={e => setChamps(c => ({ ...c, categorie: e.target.value }))}
              placeholder="Taper ou choisir une catégorie..."
              style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', marginBottom: categories.length > 0 ? 8 : 0 }}
            />
            {categories.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setChamps(c => ({ ...c, categorie: c.categorie === cat ? '' : cat }))}
                    style={{
                      height: 28, borderRadius: 20, padding: '0 10px', fontSize: 12, fontWeight: 600,
                      border: `1.5px solid ${champs.categorie === cat ? T.accent : T.border}`, cursor: 'pointer',
                      background: champs.categorie === cat ? T.accentLight : 'transparent',
                      color: champs.categorie === cat ? T.accent : T.textSub,
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowForm(false); setErreur(''); setChamps(CHAMPS_VIDES); }} style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub }}>
              Annuler
            </button>
            <button onClick={handleAjouter} style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white' }}>
              Ajouter
            </button>
          </div>
        </div>
      )}

      {/* PRODUCT LIST */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {produitsFiltres.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>
              {recherche ? 'Aucun produit trouvé' : "Aucun produit pour l'instant"}
            </div>
          </div>
        ) : (
          produitsFiltres.map((produit: Produit) => {
            const stockBas = produit.quantite <= produit.seuilAlerte;
            const marge = produit.prixVente > 0 ? Math.round((produit.prixVente - produit.prixAchat) / produit.prixVente * 100) : 0;
            const margeOk = marge >= 25;
            return (
              <div key={produit.id} onClick={() => openEditer(produit)} style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: produit.quantite === 0 ? T.redBg : T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: produit.quantite === 0 ? T.red : T.accent }}>
                    {produit.nom.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {produit.nom}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: stockBas ? T.red : T.textMuted }}>
                      {produit.quantite === 0 ? 'Rupture' : `${produit.quantite} unités`}
                    </span>
                    {produit.categorie && (
                      <span style={{ fontSize: 11, fontWeight: 600, background: T.bgSubtle, color: T.textSub, borderRadius: 20, padding: '1px 7px' }}>
                        {produit.categorie}
                      </span>
                    )}
                    {produit.tailleConditionnement && (
                      <span style={{ fontSize: 11, fontWeight: 600, background: T.bgSubtle, color: T.textSub, borderRadius: 20, padding: '1px 7px' }}>
                        Paquet de {produit.tailleConditionnement} unités
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1, fontFamily: '"Space Grotesk", sans-serif' }}>
                    Achat: {fmtF(produit.prixAchat)} · Vente: {fmtF(produit.prixVente)}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>
                    {fmtF(produit.prixVente)} {symbole}
                  </span>
                  <span style={{ background: margeOk ? T.greenBg : T.redBg, color: margeOk ? T.green : T.red, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '3px 8px', fontFamily: '"Space Grotesk", sans-serif' }}>
                    {marge}%
                  </span>
                </div>
                <button onClick={e => { e.stopPropagation(); supprimerProduit(produit.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: '4px 2px', fontSize: 16, lineHeight: 1 }} aria-label="Supprimer">×</button>
              </div>
            );
          })
        )}
      </div>

      {/* STOCK VALUE FOOTER */}
      {produits.length > 0 && (
        <div style={{ padding: '16px 16px 10px' }}>
          <div style={{ background: T.text, borderRadius: 16, padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(244,238,228,0.6)', fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: 4 }}>
                VALEUR DU STOCK
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#F4EEE4', fontFamily: '"Space Grotesk", sans-serif', letterSpacing: '-0.5px' }}>
                {fmtF(stockValue)} {symbole}
              </div>
            </div>
            <button
              onClick={() => setShowDetail(true)}
              style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, height: 34, padding: '0 14px', color: '#F4EEE4', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}
            >
              Détail
            </button>
          </div>
        </div>
      )}

      {alertes.length > 0 && <div style={{ display: 'none' }} aria-hidden="true" />}
    </div>
  );
}
