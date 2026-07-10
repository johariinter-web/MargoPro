'use client';

import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { useStock } from '@/lib/hooks/useStock';
import { useVentes } from '@/lib/hooks/useVentes';
import { useConfig } from '@/lib/hooks/useConfig';
import { useColors } from '@/lib/hooks/useColors';
import { useCategories } from '@/lib/hooks/useCategories';
import BarcodeScanner from '@/components/BarcodeScanner';
import { usePlan } from '@/lib/hooks/usePlan';
import { ModalUpgrade } from '@/components/ModalUpgrade';
import type { Produit } from '@backend/types';
import { usePacks } from '@/lib/hooks/usePacks';
import { prixAchatPack, prixVenteSepares } from '@backend/packs';
import type { Pack } from '@backend/types';

function fmtF(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

// Lit un fichier image, le recadre en carré (centré) de 400x400 et le compresse en base64.
// Résultat : une miniature carrée uniforme qui s'intègre parfaitement dans tous les cadres.
function fichierVersPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const taille = 400; // miniature carrée
        const canvas = document.createElement('canvas');
        canvas.width = taille; canvas.height = taille;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('canvas')); return; }
        // Recadrage centré : on prend le plus grand carré possible au milieu de la photo.
        const cote = Math.min(img.width, img.height);
        const dx = (img.width - cote) / 2;
        const dy = (img.height - cote) / 2;
        ctx.drawImage(img, dx, dy, cote, cote, 0, 0, taille, taille);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const CHAMPS_VIDES = {
  nom: '', quantite: '', prixAchat: '', prixVente: '',
  seuilAlerte: '5', codeBarres: '', categorie: '', tailleConditionnement: '', photo: '',
};

// Champ photo : appareil photo natif du téléphone OU galerie, aperçu, retrait.
function PhotoField({ T, value, onChange }: { T: Record<string, string>; value: string; onChange: (v: string) => void }) {
  const inputCamRef = useRef<HTMLInputElement>(null);
  const inputGalRef = useRef<HTMLInputElement>(null);
  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      try { onChange(await fichierVersPhoto(file)); } catch { /* image illisible : on ignore */ }
    }
    e.target.value = '';
  }
  return (
    <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div
        style={{ width: 64, height: 64, borderRadius: 14, flexShrink: 0, background: value ? 'transparent' : T.bgSubtle, border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          // Aperçu vide : icône "image" (pas une caméra), pour ne pas faire doublon avec le bouton Photo
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke={T.textMuted} strokeWidth="1.75"/>
            <circle cx="8.5" cy="9" r="1.5" stroke={T.textMuted} strokeWidth="1.5"/>
            <path d="M21 15l-5-4-7 6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => inputCamRef.current?.click()}
            style={{ height: 34, borderRadius: 9, padding: '0 12px', background: T.accent, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="white" strokeWidth="1.75" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="4" stroke="white" strokeWidth="1.75"/>
            </svg>
            Photo
          </button>
          <button type="button" onClick={() => inputGalRef.current?.click()}
            style={{ height: 34, borderRadius: 9, padding: '0 12px', background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
            Galerie
          </button>
        </div>
        {value && (
          <button type="button" onClick={() => onChange('')}
            style={{ height: 26, borderRadius: 9, padding: '0 4px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: T.red, fontFamily: 'Manrope, sans-serif', textAlign: 'left' }}>
            Retirer la photo
          </button>
        )}
      </div>
      {/* Caméra native (téléphone) */}
      <input ref={inputCamRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
      {/* Galerie / fichiers */}
      <input ref={inputGalRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
    </div>
  );
}

export default function StockPage() {
  const T = useColors();
  const { config } = useConfig();
  const { produits, alertes, ajouterProduit, supprimerProduit, restaurerProduit, modifierProduit } = useStock();
  const { ventes } = useVentes('tout');
  const { categories, ajouterCategorie, supprimerCategorie } = useCategories();

  const [showForm, setShowForm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const [erreur, setErreur] = useState('');
  const [recherche, setRecherche] = useState('');
  const [produitEnEdition, setProduitEnEdition] = useState<Produit | null>(null);
  const [champsEdition, setChampsEdition] = useState({ ...CHAMPS_VIDES });
  const [erreurEdition, setErreurEdition] = useState('');
  const [champsReappro, setChampsReappro] = useState({ quantite: '', prixAchat: '' });
  const [reapproMode, setReapproMode] = useState<'paquets' | 'unites'>('unites');
  const [reapproMsg, setReapproMsg] = useState('');
  const [showReappro, setShowReappro] = useState(false);
  const [produitASupprimer, setProduitASupprimer] = useState<Produit | null>(null);
  const [produitSupprime, setProduitSupprime] = useState<Produit | null>(null);
  const [catsOuvertes, setCatsOuvertes] = useState<Record<string, boolean>>({});
  const [vueStock, setVueStock] = useState<'produits' | 'packs' | 'mort'>('produits');
  const [morteSeuilStr, setMorteSeuilStr] = useState('30');
  const [showGererCats, setShowGererCats] = useState(false);
  const [catASupprimer, setCatASupprimer] = useState<string | null>(null);
  const plan = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const { packs, ajouterPack, modifierPack, supprimerPack } = usePacks();
  const [packEnEdition, setPackEnEdition] = useState<Pack | null>(null);
  const [showFormPack, setShowFormPack] = useState(false);
  const [champsPack, setChampsPack] = useState({ nom: '', remise: '' });
  const [composantsPack, setComposantsPack] = useState<Array<{ produitId: string; produitNom: string; quantite: number }>>([]);
  const [erreurPack, setErreurPack] = useState('');
  const [packASupprimer, setPackASupprimer] = useState<Pack | null>(null);

  // Liste des catégories affichées : fusion des catégories enregistrées et de
  // celles réellement portées par des produits — pour n'en oublier aucune
  // (ex. une catégorie tapée à la main comme « Savon »).
  const categoriesAffichees = Array.from(new Set([
    ...categories,
    ...produits.map(p => p.categorie?.trim()).filter((c): c is string => !!c),
  ])).sort((a, b) => a.localeCompare(b));
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoie le minuteur du bandeau « Annuler » au démontage.
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  function confirmerSuppression() {
    if (!produitASupprimer) return;
    const produit = produitASupprimer;
    setProduitASupprimer(null);
    supprimerProduit(produit.id);
    setProduitSupprime(produit);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setProduitSupprime(null), 6000);
  }

  function annulerSuppression() {
    if (!produitSupprime) return;
    restaurerProduit(produitSupprime.id);
    setProduitSupprime(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  }

  function ouvrirEditerPack(pack: Pack) {
    setPackEnEdition(pack);
    const produitsMap = new Map(produits.map(p => [p.id, p]));
    const separes = prixVenteSepares(pack, produitsMap);
    const remiseCalc = separes > 0 ? Math.max(0, Math.round((1 - pack.prixVente / separes) * 100)) : 0;
    setChampsPack({ nom: pack.nom, remise: String(remiseCalc) });
    setComposantsPack([...pack.composants]);
    setErreurPack('');
  }

  function ouvrirCreerPack() {
    setPackEnEdition(null);
    setChampsPack({ nom: '', remise: '' });
    setComposantsPack([]);
    setErreurPack('');
    setShowFormPack(true);
  }

  async function handleSauvegarderPack() {
    setErreurPack('');
    const produitsMap = new Map(produits.map(p => [p.id, p]));
    const fakePack = { composants: composantsPack, prixVente: 0 } as Pack;
    const separes = prixVenteSepares(fakePack, produitsMap);
    const remiseNum = Math.min(100, Math.max(0, Number(champsPack.remise) || 0));
    const prixVente = Math.round(separes * (1 - remiseNum / 100));
    const data = {
      nom: champsPack.nom.trim(),
      composants: composantsPack,
      prixVente,
    };
    if (packEnEdition) {
      const err = await modifierPack(packEnEdition.id, data);
      if (err) { setErreurPack(err); return; }
      setPackEnEdition(null);
    } else {
      const err = await ajouterPack(data);
      if (err) { setErreurPack(err); return; }
      setShowFormPack(false);
    }
    setChampsPack({ nom: '', remise: '' });
    setComposantsPack([]);
  }

  function retirerComposant(produitId: string) {
    setComposantsPack(cs => cs.filter(c => c.produitId !== produitId));
  }

  function ajouterComposant(produit: { id: string; nom: string }) {
    setComposantsPack(cs => {
      const existe = cs.find(c => c.produitId === produit.id);
      if (existe) return cs.map(c => c.produitId === produit.id ? { ...c, quantite: c.quantite + 1 } : c);
      return [...cs, { produitId: produit.id, produitNom: produit.nom, quantite: 1 }];
    });
  }

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
      quantite: String(produit.quantite), // toujours en unités
      prixAchat: String(produit.prixAchat),
      prixVente: String(produit.prixVente),
      seuilAlerte: String(produit.seuilAlerte),
      codeBarres: produit.codeBarres ?? '',
      categorie: produit.categorie ?? '',
      tailleConditionnement: produit.tailleConditionnement ? String(produit.tailleConditionnement) : '',
      photo: produit.photo ?? '',
    });
    setErreurEdition('');
    setChampsReappro({ quantite: '', prixAchat: '' });
    setReapproMode(produit.tailleConditionnement && produit.tailleConditionnement > 0 ? 'paquets' : 'unites');
    setReapproMsg('');
    setShowReappro(false);
  }

  function handleAjouterAuStock() {
    const recu = Number(champsReappro.quantite);
    if (!recu || recu <= 0) return;
    const taille = Number(champsEdition.tailleConditionnement);
    // Conversion en unités réelles selon le mode choisi (paquets ou unités).
    const unites = reapproMode === 'paquets' && taille > 0 ? recu * taille : recu;
    // On additionne directement au stock en unités, visible dans le champ Quantité.
    const nouveauTotal = Number(champsEdition.quantite || 0) + unites;
    setChampsEdition(c => ({
      ...c,
      quantite: String(nouveauTotal),
      ...(champsReappro.prixAchat.trim() ? { prixAchat: champsReappro.prixAchat.trim() } : {}),
    }));
    setReapproMsg(`+${unites} unité${unites > 1 ? 's' : ''} → ${nouveauTotal} unités en stock`);
    setChampsReappro({ quantite: '', prixAchat: '' });
    setShowReappro(false);
  }

  async function handleEditer() {
    if (!produitEnEdition) return;
    setErreurEdition('');
    if (!champsEdition.nom.trim()) { setErreurEdition('Le nom est obligatoire'); return; }
    const taille = Number(champsEdition.tailleConditionnement);
    const data: {
      nom: string; quantite: number; prixAchat: number; prixVente: number;
      seuilAlerte: number; codeBarres?: string; categorie?: string; tailleConditionnement?: number; photo?: string; photoPath?: null;
    } = {
      nom: champsEdition.nom.trim(),
      quantite: Number(champsEdition.quantite), // déjà en unités
      prixAchat: Number(champsEdition.prixAchat),
      prixVente: Number(champsEdition.prixVente),
      seuilAlerte: Number(champsEdition.seuilAlerte) || 5,
      photo: champsEdition.photo || '', // '' = pas de photo (permet aussi de la retirer)
      // Si la photo a été remplacée (nouvelle valeur non-vide ≠ ancienne), marquer pour re-upload.
      // Si retirée (''), on garde photoPath tel quel pour que le push puisse supprimer le fichier bucket.
      ...(champsEdition.photo && champsEdition.photo !== produitEnEdition.photo
        ? { photoPath: null as null }
        : {}),
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
    if (champs.photo) data.photo = champs.photo;

    const err = await ajouterProduit(data);
    if (err) { setErreur(err); return; }
    setChamps(CHAMPS_VIDES);
    setShowForm(false);
  }

  const stockValue = produits.reduce((sum, p) => sum + p.prixAchat * p.quantite, 0);

  // Carte d'un produit (réutilisée en liste plate et en liste groupée)
  function carteProduit(produit: Produit) {
    const stockBas = produit.quantite <= produit.seuilAlerte;
    const marge = produit.prixVente > 0 ? Math.round((produit.prixVente - produit.prixAchat) / produit.prixVente * 100) : 0;
    const margeOk = marge >= 25;
    return (
      <div key={produit.id} onClick={() => openEditer(produit)} style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: produit.quantite === 0 ? T.redBg : T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {produit.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={produit.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 18, fontWeight: 800, color: produit.quantite === 0 ? T.red : T.accent }}>
              {produit.nom.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {produit.nom}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: stockBas ? T.red : T.textMuted }}>
              {produit.quantite === 0 ? 'Rupture' : `${produit.quantite} unités`}
            </span>
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
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M9 6l6 6-6 6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  }

  // Regroupement par catégorie (un seul niveau) — utilisé quand on ne recherche pas
  const groupesStock = (() => {
    const m = new Map<string, Produit[]>();
    for (const p of produitsFiltres) {
      const cle = p.categorie?.trim() || 'Sans catégorie';
      if (!m.has(cle)) m.set(cle, []);
      m.get(cle)!.push(p);
    }
    return Array.from(m.entries()).sort((a, b) => {
      if (a[0] === 'Sans catégorie') return 1;
      if (b[0] === 'Sans catégorie') return -1;
      return a[0].localeCompare(b[0]);
    });
  })();

  // Répartition par catégorie pour le popup Détail.
  // On regroupe à partir des produits eux-mêmes (et non de la liste des
  // catégories enregistrées) pour n'oublier aucun produit, même si sa
  // catégorie n'existe pas/plus dans la liste.
  const parCategorie = (() => {
    const map = new Map<string, { count: number; valeur: number }>();
    for (const p of produits) {
      const cat = p.categorie || 'Sans catégorie';
      const cur = map.get(cat) ?? { count: 0, valeur: 0 };
      cur.count += 1;
      cur.valeur += p.prixAchat * p.quantite;
      map.set(cat, cur);
    }
    return Array.from(map, ([cat, v]) => ({ cat, count: v.count, valeur: v.valeur }));
  })();

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, paddingBottom: 90, fontFamily: 'Manrope, sans-serif' }}>

      {/* SCANNER */}
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}

      {/* CONFIRMATION DE SUPPRESSION */}
      {produitASupprimer && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setProduitASupprimer(null)}
        >
          <div
            style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 340, padding: 22 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 48, height: 48, borderRadius: 14, background: T.redBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 11v6M14 11v6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, textAlign: 'center', marginBottom: 6 }}>
              Supprimer ce produit ?
            </div>
            <div style={{ fontSize: 14, color: T.textSub, textAlign: 'center', marginBottom: 20 }}>
              «&nbsp;<strong style={{ color: T.text }}>{produitASupprimer.nom}</strong>&nbsp;» sera retiré de ton stock.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setProduitASupprimer(null)} style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
                Annuler
              </button>
              <button onClick={confirmerSuppression} style={{ flex: 1, height: 46, borderRadius: 12, background: T.red, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANDEAU ANNULER (après suppression) */}
      {produitSupprime && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 80, zIndex: 250, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
          <div style={{ background: T.text, borderRadius: 14, padding: '12px 14px 12px 16px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 480, width: '100%', boxShadow: T.shadow }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#F4EEE4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              «&nbsp;{produitSupprime.nom}&nbsp;» supprimé
            </span>
            <button onClick={annulerSuppression} style={{ background: 'rgba(255,255,255,0.16)', borderRadius: 10, height: 36, padding: '0 16px', color: '#F4EEE4', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
              Annuler
            </button>
          </div>
        </div>
      )}

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

            {/* Photo */}
            <PhotoField T={T as unknown as Record<string, string>} value={champsEdition.photo} onChange={v => setChampsEdition(c => ({ ...c, photo: v }))} />

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

            {/* Quantité — toujours en unités */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
                Quantité en stock (unités)
              </label>
              <input type="number" value={champsEdition.quantite} onChange={e => setChampsEdition(c => ({ ...c, quantite: e.target.value }))} placeholder="0" min="0" step="any"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              {Number(champsEdition.tailleConditionnement) > 0 && Number(champsEdition.quantite) > 0 && (
                <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>
                  soit ~{Math.floor(Number(champsEdition.quantite) / Number(champsEdition.tailleConditionnement))} paquet{Math.floor(Number(champsEdition.quantite) / Number(champsEdition.tailleConditionnement)) > 1 ? 's' : ''} de {champsEdition.tailleConditionnement}
                  {Number(champsEdition.quantite) % Number(champsEdition.tailleConditionnement) > 0 ? ` + ${Number(champsEdition.quantite) % Number(champsEdition.tailleConditionnement)} unité${Number(champsEdition.quantite) % Number(champsEdition.tailleConditionnement) > 1 ? 's' : ''}` : ''}
                </div>
              )}
            </div>

            {/* RÉAPPRO — bouton qui ouvre une fenêtre */}
            <button
              onClick={() => { setChampsReappro({ quantite: '', prixAchat: '' }); setShowReappro(true); }}
              style={{ width: '100%', marginBottom: reapproMsg ? 6 : 14, height: 46, borderRadius: 12, border: `1.5px solid ${T.accent}`, background: T.accentLight, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.accent, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.accent} strokeWidth="1.75" strokeLinejoin="round"/>
                <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              J&apos;ai reçu de la marchandise
            </button>
            {reapproMsg && (
              <div style={{ fontSize: 12, color: T.accent, fontWeight: 700, marginBottom: 14, textAlign: 'center' }}>{reapproMsg}</div>
            )}

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>Catégorie</label>
                {categoriesAffichees.length > 0 && (
                  <button type="button" onClick={() => setShowGererCats(true)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: T.accent, fontFamily: 'Manrope, sans-serif', padding: 0 }}>
                    Gérer
                  </button>
                )}
              </div>
              <input type="text" value={champsEdition.categorie} onChange={e => setChampsEdition(c => ({ ...c, categorie: e.target.value }))} placeholder="Taper ou choisir..."
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', marginBottom: categoriesAffichees.length > 0 ? 8 : 0 }} />
              {categoriesAffichees.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {categoriesAffichees.map(cat => (
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

            {/* Supprimer ce produit */}
            <button
              onClick={() => { const p = produitEnEdition; setProduitEnEdition(null); setProduitASupprimer(p); }}
              style={{ width: '100%', height: 44, marginTop: 10, borderRadius: 12, background: 'transparent', border: `1.5px solid ${T.redBg}`, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 11v6M14 11v6" stroke={T.red} strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              Supprimer ce produit
            </button>
          </div>
        </div>
      )}

      {/* FENÊTRE RÉAPPRO */}
      {showReappro && produitEnEdition && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 280, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowReappro(false)}
        >
          <div
            style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 360, padding: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.accent} strokeWidth="1.75" strokeLinejoin="round"/>
                <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              J&apos;ai reçu de la marchandise
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>{produitEnEdition.nom}</div>

            {/* Choix Paquets / Unités — seulement si le produit est conditionné en paquets */}
            {Number(champsEdition.tailleConditionnement) > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                {([
                  { mode: 'paquets' as const, label: 'En paquets' },
                  { mode: 'unites' as const, label: 'En unités' },
                ]).map(({ mode, label }) => (
                  <button key={mode} onClick={() => setReapproMode(mode)}
                    style={{ flex: 1, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      border: `1.5px solid ${reapproMode === mode ? T.accent : T.border}`,
                      background: reapproMode === mode ? T.accent : T.surface,
                      color: reapproMode === mode ? 'white' : T.textSub }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Quantité reçue */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>
                {Number(champsEdition.tailleConditionnement) > 0 && reapproMode === 'paquets' ? 'Paquets reçus' : 'Unités reçues'}
              </label>
              <input type="number" autoFocus value={champsReappro.quantite} onChange={e => setChampsReappro(c => ({ ...c, quantite: e.target.value }))} placeholder="0" min="0"
                step={Number(champsEdition.tailleConditionnement) > 0 && reapproMode === 'paquets' ? '1' : 'any'}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 18, fontWeight: 700, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              {Number(champsEdition.tailleConditionnement) > 0 && reapproMode === 'paquets' && Number(champsReappro.quantite) > 0 && (
                <div style={{ fontSize: 12, color: T.accent, fontWeight: 600, marginTop: 4 }}>
                  → +{Number(champsReappro.quantite) * Number(champsEdition.tailleConditionnement)} unités
                </div>
              )}
            </div>

            {/* Nouveau prix d'achat optionnel */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nouveau prix d&apos;achat (optionnel)</label>
              <input type="number" value={champsReappro.prixAchat} onChange={e => setChampsReappro(c => ({ ...c, prixAchat: e.target.value }))} placeholder={`Inchangé : ${champsEdition.prixAchat || '0'}`} min="0"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowReappro(false)} style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
                Annuler
              </button>
              <button onClick={handleAjouterAuStock} disabled={!(Number(champsReappro.quantite) > 0)}
                style={{ flex: 2, height: 46, borderRadius: 12, background: T.accent, border: 'none', cursor: Number(champsReappro.quantite) > 0 ? 'pointer' : 'default', fontSize: 14, fontWeight: 700, color: 'white', opacity: Number(champsReappro.quantite) > 0 ? 1 : 0.5, fontFamily: 'Manrope, sans-serif' }}>
                Ajouter au stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DÉTAIL MODAL */}
      {/* POPUP — Gérer les catégories */}
      {showGererCats && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowGererCats(false)}
        >
          <div
            style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 420, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', padding: '22px 20px 24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 4 }}>Gérer les catégories</div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
              Tu peux supprimer les catégories vides. Une catégorie utilisée par des produits reste tant que des produits l&apos;utilisent.
            </div>
            {categoriesAffichees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: T.textMuted, fontSize: 14 }}>Aucune catégorie</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {categoriesAffichees.map(cat => {
                  const nb = produits.filter(p => (p.categorie || '').trim() === cat).length;
                  return (
                    <div key={cat} style={{ background: T.bgSubtle, borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{nb} produit{nb > 1 ? 's' : ''}</div>
                      </div>
                      {nb === 0 ? (
                        <button type="button" onClick={() => setCatASupprimer(cat)}
                          style={{ flexShrink: 0, height: 32, borderRadius: 9, padding: '0 12px', background: 'transparent', border: `1.5px solid ${T.border}`, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif' }}>
                          Supprimer
                        </button>
                      ) : (
                        <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: T.textMuted }}>utilisée</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <button type="button" onClick={() => setShowGererCats(false)}
              style={{ width: '100%', height: 44, marginTop: 16, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* POPUP — Confirmation suppression catégorie */}
      {catASupprimer && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 260, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setCatASupprimer(null)}
        >
          <div
            style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 360, padding: '22px 20px 20px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 8 }}>Supprimer «&nbsp;{catASupprimer}&nbsp;» ?</div>
            <div style={{ fontSize: 13, color: T.textSub, marginBottom: 18 }}>
              La catégorie sera retirée de la liste. Tes produits ne sont pas supprimés.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setCatASupprimer(null)}
                style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>
                Annuler
              </button>
              <button type="button" onClick={() => { supprimerCategorie(catASupprimer); setCatASupprimer(null); }}
                style={{ flex: 1, height: 46, borderRadius: 12, background: T.red, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetail && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setShowDetail(false)}
        >
          <div
            style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', padding: '22px 20px 24px' }}
            onClick={e => e.stopPropagation()}
          >
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

      {/* BOTTOM SHEET ÉDITION PACK */}
      {packEnEdition && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'flex-end' }}
          onClick={() => setPackEnEdition(null)}>
          <div style={{ background: T.surface, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, margin: '0 auto', padding: '20px 20px 40px', maxHeight: '90dvh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 16 }}>Modifier le pack</div>
            {erreurPack && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>{erreurPack}</div>}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du pack</label>
              <input type="text" value={champsPack.nom} onChange={e => setChampsPack(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Pack Duo Propre"
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Produits du pack</label>
              {composantsPack.map(c => (
                <div key={c.produitId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: T.bgSubtle, borderRadius: 10, padding: '8px 10px' }}>
                  <span style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: 600 }}>{c.produitNom}</span>
                  <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 15, fontWeight: 700, color: T.text, minWidth: 20, textAlign: 'center', fontFamily: '"Space Grotesk", sans-serif' }}>{c.quantite}</span>
                  <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: x.quantite + 1 } : x))}
                    style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <button type="button" onClick={() => retirerComposant(c.produitId)}
                    style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: T.redBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={T.red} strokeWidth="2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              ))}
              <select
                value=""
                onChange={e => { if (e.target.value) ajouterComposant({ id: e.target.value, nom: produits.find(p => p.id === e.target.value)?.nom ?? '' }); }}
                style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', cursor: 'pointer' }}
              >
                <option value="">+ Ajouter un produit...</option>
                {produits.filter(p => !composantsPack.find(c => c.produitId === p.id)).map(p => (
                  <option key={p.id} value={p.id}>{p.nom} — {Math.round(p.prixVente).toLocaleString()} {symbole} ({p.quantite} dispo)</option>
                ))}
              </select>
            </div>
            {(() => {
              const produitsMap = new Map(produits.map(p => [p.id, p]));
              const fakePack = { composants: composantsPack, prixVente: 0 } as Pack;
              const separes = prixVenteSepares(fakePack, produitsMap);
              const achat = prixAchatPack(fakePack, produitsMap);
              const remiseNum = Math.min(100, Math.max(0, Number(champsPack.remise) || 0));
              const prixCalc = Math.round(separes * (1 - remiseNum / 100));
              const beneficeNet = prixCalc - achat;
              const hasData = composantsPack.length > 0 && separes > 0 && champsPack.remise !== '';
              return (
                <>
                  <div style={{ marginBottom: hasData ? 4 : 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Remise (%)</label>
                    <input type="number" value={champsPack.remise} onChange={e => setChampsPack(c => ({ ...c, remise: e.target.value }))} placeholder="Ex : 10" min="0" max="100"
                      style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
                  </div>
                  {hasData && (
                    <div style={{ marginBottom: 14, padding: '10px 12px', background: T.bgSubtle, borderRadius: 10, fontSize: 12, color: T.textSub }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span>Prix séparés</span><span style={{ fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: T.text }}>{Math.round(separes).toLocaleString()} {symbole}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span>Prix du pack</span><span style={{ fontSize: 14, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{prixCalc.toLocaleString()} {symbole}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Bénéfice net</span><span style={{ fontWeight: 700, color: beneficeNet >= 0 ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif' }}>{beneficeNet >= 0 ? '+' : ''}{Math.round(beneficeNet).toLocaleString()} {symbole}</span>
                      </div>
                      {remiseNum === 0 && <div style={{ marginTop: 6, fontSize: 11, color: '#F97316', fontWeight: 600 }}>Le client ne voit pas de bonne affaire — mets une remise</div>}
                    </div>
                  )}
                </>
              );
            })()}
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <button onClick={() => setPackEnEdition(null)} style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>Annuler</button>
              <button onClick={handleSauvegarderPack} style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>Enregistrer</button>
            </div>
            <button onClick={() => { const p = packEnEdition; setPackEnEdition(null); setPackASupprimer(p); }}
              style={{ width: '100%', height: 44, borderRadius: 12, background: 'transparent', border: `1.5px solid ${T.redBg}`, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.red, fontFamily: 'Manrope, sans-serif' }}>
              Supprimer ce pack
            </button>
          </div>
        </div>
      )}


      {/* CONFIRMATION SUPPRESSION PACK */}
      {packASupprimer && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(28,24,17,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setPackASupprimer(null)}>
          <div style={{ background: T.surface, borderRadius: 20, width: '100%', maxWidth: 340, padding: 22 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, textAlign: 'center', marginBottom: 6 }}>Supprimer ce pack ?</div>
            <div style={{ fontSize: 14, color: T.textSub, textAlign: 'center', marginBottom: 20 }}>«&nbsp;<strong>{packASupprimer.nom}</strong>&nbsp;» sera supprimé. Les produits ne sont pas affectés.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPackASupprimer(null)} style={{ flex: 1, height: 46, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>Annuler</button>
              <button onClick={() => { supprimerPack(packASupprimer.id); setPackASupprimer(null); }} style={{ flex: 1, height: 46, borderRadius: 12, background: T.red, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>Supprimer</button>
            </div>
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
          <button
            onClick={() => {
              if (!plan.canAddProduct) { setShowUpgradeModal(true); return; }
              setShowForm(true);
            }}
            style={{
              height: 44, borderRadius: 12,
              background: plan.canAddProduct ? T.accent : '#D1D5DB',
              color: 'white', fontSize: 13, fontWeight: 700, padding: '0 14px',
              border: 'none', cursor: plan.canAddProduct ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            Ajouter
          </button>
        </div>
      </div>

      {/* SÉLECTEUR Mes produits / Packs / Stock mort */}
      <div style={{ padding: '0 16px 10px' }}>
        <div style={{ display: 'flex', background: T.bgSubtle, borderRadius: 12, padding: 3, gap: 2 }}>
          {([
            { v: 'produits' as const, label: 'Mes produits' },
            { v: 'packs' as const, label: 'Packs' },
            { v: 'mort' as const, label: 'Stock mort' },
          ]).map(({ v, label }) => (
            <button key={v} onClick={() => setVueStock(v)}
              style={{ flex: 1, height: 36, border: 'none', cursor: 'pointer', borderRadius: 10, fontSize: 12,
                fontWeight: vueStock === v ? 700 : 500,
                color: vueStock === v ? T.text : T.textMuted,
                background: vueStock === v ? T.surface : 'transparent',
                boxShadow: vueStock === v ? T.shadow : 'none', fontFamily: 'Manrope, sans-serif' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {vueStock === 'produits' && (
      <>
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
          <button
            onClick={() => { setShowForm(false); setErreur(''); setChamps(CHAMPS_VIDES); }}
            aria-label="Retour à mes produits"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12, fontFamily: 'Manrope, sans-serif' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 18l-6-6 6-6" stroke={T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 700, color: T.textSub }}>Retour à mes produits</span>
          </button>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 14 }}>Nouveau produit</div>
          {erreur && (
            <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>
              {erreur}
            </div>
          )}

          {/* Photo */}
          <PhotoField T={T as unknown as Record<string, string>} value={champs.photo} onChange={v => setChamps(c => ({ ...c, photo: v }))} />

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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub }}>Catégorie</label>
              {categoriesAffichees.length > 0 && (
                <button type="button" onClick={() => setShowGererCats(true)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: T.accent, fontFamily: 'Manrope, sans-serif', padding: 0 }}>
                  Gérer
                </button>
              )}
            </div>
            <input
              type="text"
              value={champs.categorie}
              onChange={e => setChamps(c => ({ ...c, categorie: e.target.value }))}
              placeholder="Taper ou choisir une catégorie..."
              style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', marginBottom: categoriesAffichees.length > 0 ? 8 : 0 }}
            />
            {categoriesAffichees.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {categoriesAffichees.map(cat => (
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
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.textMuted} strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>
              {recherche ? 'Aucun produit trouvé' : "Aucun produit pour l'instant"}
            </div>
          </div>
        ) : recherche.trim() ? (
          // Recherche active : liste plate
          produitsFiltres.map(carteProduit)
        ) : (
          // Pas de recherche : groupes repliables par catégorie
          groupesStock.map(([cat, items]) => {
            const ouvert = catsOuvertes[cat] ?? false;
            const valeurCat = items.reduce((s, p) => s + p.prixAchat * p.quantite, 0);
            const alertesCat = items.filter(p => p.quantite <= p.seuilAlerte).length;
            return (
              <div key={cat} style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>
                <button onClick={() => setCatsOuvertes(o => ({ ...o, [cat]: !ouvert }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'Manrope, sans-serif' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: ouvert ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M9 6l6 6-6 6" stroke={T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
                  {alertesCat > 0 && (
                    <span style={{ background: T.redBg, color: T.red, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 7px', flexShrink: 0 }}>
                      {alertesCat} stock bas
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: T.textMuted, flexShrink: 0 }}>{items.length} produit{items.length > 1 ? 's' : ''}</span>
                </button>
                {ouvert && (
                  <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {items.map(carteProduit)}
                  </div>
                )}
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
      </>
      )}

      {/* VUE PACKS */}
      {vueStock === 'packs' && (
        <div style={{ padding: '0 16px' }}>

          {/* Bouton Créer un pack */}
          <div style={{ marginBottom: 12 }}>
            <button
              onClick={ouvrirCreerPack}
              style={{ width: '100%', height: 48, borderRadius: 14, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              + Créer un pack
            </button>
          </div>

          {/* Formulaire création */}
          {showFormPack && (
            <div style={{ background: T.surface, borderRadius: 16, padding: 16, boxShadow: T.shadow, marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 14 }}>Nouveau pack</div>
              {erreurPack && <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 10, padding: '8px 12px', background: T.redBg, borderRadius: 8 }}>{erreurPack}</div>}
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Nom du pack</label>
                <input type="text" value={champsPack.nom} onChange={e => setChampsPack(c => ({ ...c, nom: e.target.value }))} placeholder="Ex: Pack Duo Propre"
                  style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Produits du pack</label>
                {composantsPack.map(c => (
                  <div key={c.produitId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, background: T.bgSubtle, borderRadius: 10, padding: '8px 10px' }}>
                    <span style={{ flex: 1, fontSize: 14, color: T.text, fontWeight: 600 }}>{c.produitNom}</span>
                    <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: Math.max(1, x.quantite - 1) } : x))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: T.text, minWidth: 20, textAlign: 'center', fontFamily: '"Space Grotesk", sans-serif' }}>{c.quantite}</span>
                    <button type="button" onClick={() => setComposantsPack(cs => cs.map(x => x.produitId === c.produitId ? { ...x, quantite: x.quantite + 1 } : x))}
                      style={{ width: 36, height: 36, borderRadius: 8, border: `1.5px solid ${T.border}`, background: 'transparent', cursor: 'pointer', fontSize: 16, color: T.text, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    <button type="button" onClick={() => retirerComposant(c.produitId)}
                      style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: T.redBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke={T.red} strokeWidth="2" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
                <select
                  value=""
                  onChange={e => { if (e.target.value) ajouterComposant({ id: e.target.value, nom: produits.find(p => p.id === e.target.value)?.nom ?? '' }); }}
                  style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 14, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box', cursor: 'pointer' }}
                >
                  <option value="">+ Ajouter un produit...</option>
                  {produits.filter(p => !composantsPack.find(c => c.produitId === p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.nom} — {Math.round(p.prixVente).toLocaleString()} {symbole} ({p.quantite} dispo)</option>
                  ))}
                </select>
              </div>
              {(() => {
                const produitsMap = new Map(produits.map(p => [p.id, p]));
                const fakePack = { composants: composantsPack, prixVente: 0 } as Pack;
                const separes = prixVenteSepares(fakePack, produitsMap);
                const achat = prixAchatPack(fakePack, produitsMap);
                const remiseNum = Math.min(100, Math.max(0, Number(champsPack.remise) || 0));
                const prixCalc = Math.round(separes * (1 - remiseNum / 100));
                const beneficeNet = prixCalc - achat;
                const hasData = composantsPack.length > 0 && separes > 0 && champsPack.remise !== '';
                return (
                  <>
                    <div style={{ marginBottom: hasData ? 4 : 14 }}>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5 }}>Remise (%)</label>
                      <input type="number" value={champsPack.remise} onChange={e => setChampsPack(c => ({ ...c, remise: e.target.value }))} placeholder="Ex : 10" min="0" max="100"
                        style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 15, color: T.text, background: T.bg, outline: 'none', fontFamily: 'Manrope, sans-serif', boxSizing: 'border-box' }} />
                    </div>
                    {hasData && (
                      <div style={{ marginBottom: 14, padding: '10px 12px', background: T.bgSubtle, borderRadius: 10, fontSize: 12, color: T.textSub }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span>Prix séparés</span><span style={{ fontWeight: 700, fontFamily: '"Space Grotesk", sans-serif', color: T.text }}>{Math.round(separes).toLocaleString()} {symbole}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span>Prix du pack</span><span style={{ fontSize: 14, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{prixCalc.toLocaleString()} {symbole}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Bénéfice net</span><span style={{ fontWeight: 700, color: beneficeNet >= 0 ? T.green : T.red, fontFamily: '"Space Grotesk", sans-serif' }}>{beneficeNet >= 0 ? '+' : ''}{Math.round(beneficeNet).toLocaleString()} {symbole}</span>
                        </div>
                        {remiseNum === 0 && <div style={{ marginTop: 6, fontSize: 11, color: '#F97316', fontWeight: 600 }}>Le client ne voit pas de bonne affaire — mets une remise</div>}
                      </div>
                    )}
                  </>
                );
              })()}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => { setShowFormPack(false); setErreurPack(''); }} style={{ flex: 1, height: 44, borderRadius: 12, background: T.bgSubtle, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: T.textSub, fontFamily: 'Manrope, sans-serif' }}>Annuler</button>
                <button onClick={handleSauvegarderPack} style={{ flex: 2, height: 44, borderRadius: 12, background: T.accent, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: 'white', fontFamily: 'Manrope, sans-serif' }}>Créer le pack</button>
              </div>
            </div>
          )}

          {/* Liste des packs */}
          {packs.length === 0 && !showFormPack ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: T.textMuted }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.textMuted} strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 8v4M12 16h.01" stroke={T.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>Aucun pack pour l&apos;instant</div>
              <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4 }}>Crée un pack pour liquider ton stock mort</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {packs.map(pack => {
                const produitsMap = new Map(produits.map(p => [p.id, p]));
                const achat = prixAchatPack(pack, produitsMap);
                const beneficeNet = pack.prixVente - achat;
                return (
                  <div key={pack.id} onClick={() => ouvrirEditerPack(pack)} style={{ background: T.surface, borderRadius: 14, padding: '12px 14px', boxShadow: T.shadow, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: T.accentLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" stroke={T.accent} strokeWidth="1.75" strokeLinejoin="round"/>
                        <path d="M3.3 7l8.7 5 8.7-5M12 22V12" stroke={T.accent} strokeWidth="1.75" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pack.nom}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{pack.composants.length} produit{pack.composants.length > 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif' }}>{Math.round(pack.prixVente).toLocaleString()} {symbole}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: beneficeNet >= 0 ? T.green : T.red }}>{beneficeNet >= 0 ? '+' : ''}{Math.round(beneficeNet).toLocaleString()} {symbole}</span>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><path d="M9 6l6 6-6 6" stroke={T.textMuted} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VUE STOCK MORT */}
      {vueStock === 'mort' && (() => {
        const now = Date.now();
        const JOUR = 86_400_000;
        const derniereVente = new Map<string, number>();
        for (const v of ventes) {
          const prev = derniereVente.get(v.produitId) ?? 0;
          if (v.date > prev) derniereVente.set(v.produitId, v.date);
        }
        const seuil = Math.max(1, Number(morteSeuilStr) || 0);
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
                  <input type="number" min={1} max={365} value={morteSeuilStr}
                    onChange={e => setMorteSeuilStr(e.target.value)}
                    style={{ width: 46, border: 'none', background: 'transparent', fontSize: 16, fontWeight: 800, color: T.accent, fontFamily: '"Space Grotesk", sans-serif', outline: 'none', textAlign: 'right' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>jours</span>
                </div>
              </div>
              <input type="range" min={7} max={180}
                value={Math.min(180, Math.max(7, seuil))}
                onChange={e => setMorteSeuilStr(e.target.value)}
                style={{ width: '100%', accentColor: T.accent }} />
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
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" style={{ margin: '0 auto 12px', display: 'block' }}>
                  <circle cx="12" cy="12" r="9" stroke={T.green} strokeWidth="1.75"/>
                  <path d="M8 12l2.5 2.5L16 9" stroke={T.green} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.textSub }}>Aucun stock mort</div>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6 }}>
                  Tous tes produits en stock se sont vendus dans les {seuil} derniers jours
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {morts.map(p => (
                  <div key={p.id} onClick={() => openEditer(p)} style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
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

      {alertes.length > 0 && <div style={{ display: 'none' }} aria-hidden="true" />}
      {showUpgradeModal && <ModalUpgrade onClose={() => setShowUpgradeModal(false)} />}
    </div>
  );
}
