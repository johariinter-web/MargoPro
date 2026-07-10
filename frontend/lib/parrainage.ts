'use client';

const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function suffixeAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return Array.from(octets, o => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
}

export function generateAffiliateCode(nom: string): string {
  const lettres = nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const prefixe = (lettres.slice(0, 3) || 'MGP').padEnd(3, 'X');
  return `${prefixe}-${suffixeAleatoire(4)}`;
}

export interface ParrainagePaiement {
  parrainage_id: string;
  mois: string; // format 'YYYY-MM'
  montant_paye: number;
  commission_versee: boolean;
}

const TAUX_COMMISSION = 0.15;
const PLAFOND_MOIS_COMMISSION = 12;

export function computeCommissionSolde(paiements: ParrainagePaiement[]): number {
  const parFilleul = new Map<string, ParrainagePaiement[]>();
  for (const p of paiements) {
    const liste = parFilleul.get(p.parrainage_id) ?? [];
    liste.push(p);
    parFilleul.set(p.parrainage_id, liste);
  }

  let solde = 0;
  for (const liste of parFilleul.values()) {
    const douzeMoisTries = [...liste]
      .sort((a, b) => a.mois.localeCompare(b.mois))
      .slice(0, PLAFOND_MOIS_COMMISSION);
    for (const p of douzeMoisTries) {
      if (!p.commission_versee) solde += p.montant_paye * TAUX_COMMISSION;
    }
  }
  return Math.round(solde);
}

export interface ProgressionMoisGratuit {
  filleulsPayants: number;
  moisDus: number;
}

export function computeMoisGratuitProgress(
  paiements: ParrainagePaiement[],
  moisGratuitsAccordes: number,
): ProgressionMoisGratuit {
  const filleulsPayants = new Set(paiements.map(p => p.parrainage_id)).size;
  const moisDus = Math.max(0, Math.floor(filleulsPayants / 4) - moisGratuitsAccordes);
  return { filleulsPayants, moisDus };
}

import type { SupabaseClient } from '@supabase/supabase-js';

export type RecompenseType = 'mois_gratuit' | 'commission';

export interface Affiliate {
  id: string;
  code: string;
  nom: string;
  type: 'abonne' | 'non_abonne';
  recompense: RecompenseType | null;
  mois_gratuits_accordes: number;
}

export async function getOrCreateAffiliate(
  supabase: SupabaseClient,
  userId: string,
  nom: string,
): Promise<Affiliate> {
  const { data: existant } = await supabase
    .from('affiliates')
    .select('id, code, nom, type, recompense, mois_gratuits_accordes')
    .eq('user_id', userId)
    .maybeSingle();
  if (existant) return existant as Affiliate;

  for (let tentative = 0; tentative < 5; tentative++) {
    const code = generateAffiliateCode(nom);
    const { data, error } = await supabase
      .from('affiliates')
      .insert({ user_id: userId, code, nom, type: 'abonne' })
      .select('id, code, nom, type, recompense, mois_gratuits_accordes')
      .single();
    if (!error) return data as Affiliate;
    if (!error.message.includes('duplicate key')) throw error;
  }
  throw new Error("Impossible de générer un code de parrainage unique.");
}

export async function updateRecompense(
  supabase: SupabaseClient,
  affiliateId: string,
  recompense: RecompenseType,
): Promise<void> {
  const { error } = await supabase
    .from('affiliates')
    .update({ recompense })
    .eq('id', affiliateId);
  if (error) throw error;
}

interface ParrainageAvecPaiements {
  id: string;
  parrainage_paiements: ParrainagePaiement[];
}

export async function fetchAffiliatePaiements(
  supabase: SupabaseClient,
  affiliateId: string,
): Promise<ParrainagePaiement[]> {
  const { data, error } = await supabase
    .from('parrainages')
    .select('id, parrainage_paiements(parrainage_id, mois, montant_paye, commission_versee)')
    .eq('affiliate_id', affiliateId);
  if (error) throw error;
  return ((data ?? []) as ParrainageAvecPaiements[]).flatMap(p => p.parrainage_paiements ?? []);
}

const REFERRAL_STORAGE_KEY = 'margo_referral_code';

/** Lit `?ref=CODE` dans l'URL courante et le garde en mémoire jusqu'à l'inscription. */
export function storeReferralCode(): void {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('ref');
  if (code) localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase());
}

/** Rattache le nouveau compte au code de parrainage stocké, si présent. Échoue silencieusement
 *  si le code est invalide : ne doit jamais bloquer l'inscription. */
export async function consumeReferralCode(
  supabase: SupabaseClient,
  userId: string,
  filleulNom: string,
): Promise<void> {
  const code = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!code) return;

  try {
    const { data: dejaParraine } = await supabase
      .from('parrainages')
      .select('id')
      .eq('filleul_user_id', userId)
      .maybeSingle();
    if (dejaParraine) return;

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!affiliate) return;

    await supabase.from('parrainages').insert({
      affiliate_id: affiliate.id,
      filleul_nom: filleulNom,
      filleul_user_id: userId,
      code_utilise: code,
    });
  } finally {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  }
}
