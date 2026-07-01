'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Produit } from '@backend/types';

const BUCKET = 'product-photos';

export function cheminPhoto(userId: string, produitId: string, version: number): string {
  return `${userId}/${produitId}/${version}.jpg`;
}

// Bêta : synchro active pour tous. Plus tard : conditionner à config.dateAbonnement.
export function peutSyncerPhotos(): boolean {
  return true;
}

// Upload une photo vers le bucket. Supprime les versions précédentes du même produit
// avant d'envoyer la nouvelle (évite les fichiers orphelins en cas de remplacement).
export async function uploadPhoto(
  supabase: SupabaseClient,
  userId: string,
  produit: Produit,
): Promise<string> {
  if (!produit.photo) throw new Error('Aucune photo à uploader');

  // Nettoyer les anciennes versions du produit dans le bucket
  const prefixe = `${userId}/${produit.id}`;
  const { data: anciens } = await supabase.storage.from(BUCKET).list(prefixe);
  if (anciens && anciens.length > 0) {
    const chemins = anciens.map((f) => `${prefixe}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(chemins);
  }

  // Upload
  const chemin = cheminPhoto(userId, produit.id, Date.now());
  const blob = base64ToBlob(produit.photo);
  const { error } = await supabase.storage.from(BUCKET).upload(chemin, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return chemin;
}

// Télécharge une photo depuis le bucket et retourne son data URL (base64).
export async function downloadPhoto(
  supabase: SupabaseClient,
  chemin: string,
): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(chemin);
  if (error) throw error;
  return blobToBase64(data);
}

// Supprime un fichier du bucket (utilisé quand photo retirée ou produit supprimé).
export async function supprimerPhoto(
  supabase: SupabaseClient,
  chemin: string,
): Promise<void> {
  await supabase.storage.from(BUCKET).remove([chemin]);
}

// --- Helpers de conversion (privés) ---

function base64ToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
