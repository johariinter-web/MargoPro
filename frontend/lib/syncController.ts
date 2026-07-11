'use client';

import { fullSync, getUserId } from './sync';
import { createClient } from './supabase/client';

// =====================================================================
// MargoPro - Contrôleur de synchronisation (singleton, hors React)
//
// Centralise l'état de sync et les déclencheurs. Les hooks de données
// appellent requestSync() après chaque écriture ; l'UI s'abonne via
// subscribe() pour afficher le statut.
// =====================================================================

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

export interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
}

const LAST_SYNC_KEY = 'margopro_last_sync_at';
const DEBOUNCE_MS = 1500;
const INTERVAL_MS = 60_000;

let state: SyncState = {
  status: 'idle',
  lastSyncAt: readLastSync(),
};

const listeners = new Set<(s: SyncState) => void>();
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;
let rerunRequested = false;
let started = false;

function readLastSync(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LAST_SYNC_KEY);
  return raw ? Number(raw) : null;
}

function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  for (const l of listeners) l(state);
}

export function getState(): SyncState {
  return state;
}

export function subscribe(listener: (s: SyncState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

/** Lance une synchronisation immédiate (pull + push). */
export async function runSync(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setState({ status: 'offline' });
    return;
  }
  if (inFlight) {
    rerunRequested = true;
    return;
  }

  inFlight = true;
  setState({ status: 'syncing' });
  try {
    const userId = await getUserId();
    if (!userId) {
      // Pas connecté : rien à synchroniser, on reste silencieux.
      setState({ status: 'idle' });
      return;
    }
    await fullSync(userId);
    const now = Date.now();
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SYNC_KEY, String(now));
    }
    setState({ status: 'idle', lastSyncAt: now });
  } catch (err) {
    console.error('[sync] échec de la synchronisation', err);
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    setState({ status: offline ? 'offline' : 'error' });
  } finally {
    inFlight = false;
    if (rerunRequested) {
      rerunRequested = false;
      void runSync();
    }
  }
}

/** Synchronisation debouncée - appelée par les hooks après une écriture locale. */
export function requestSync(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSync();
  }, DEBOUNCE_MS);
}

/** Démarre les déclencheurs automatiques (idempotent). */
export function startSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  // Sync initiale au démarrage (peut sortir vide si la session Supabase
  // n'est pas encore restaurée - l'écouteur ci-dessous prend le relais).
  void runSync();

  // Dès que Supabase restaure la session (ex: iOS après le premier mount),
  // on relance une sync pour peupler l'IndexedDB vide.
  createClient().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') void runSync();
    // Ne pas appeler stopSync() sur SIGNED_OUT : iOS peut émettre cet événement
    // temporairement pendant la restauration de session, ce qui tuerait l'intervalle.
    // runSync() s'arrête seul quand getUserId() retourne null.
  });

  // Sync à la reconnexion réseau.
  window.addEventListener('online', () => void runSync());
  window.addEventListener('offline', () => setState({ status: 'offline' }));

  // Sync quand l'app revient au premier plan (retour depuis une autre app sur mobile).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void runSync();
  });

  // Sync périodique (récupère les changements d'un autre appareil).
  intervalTimer = setInterval(() => void runSync(), INTERVAL_MS);
}

/** Arrête les déclencheurs (ex : déconnexion). */
export function stopSync(): void {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  started = false;
}
