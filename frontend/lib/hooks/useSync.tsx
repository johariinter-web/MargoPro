'use client';

import { useEffect, useState } from 'react';
import {
  type SyncState,
  getState,
  subscribe,
  startSync,
  runSync,
} from '../syncController';

// =====================================================================
// MargoPro - Hooks React pour la synchronisation
//
// <SyncStarter/> : monté dans le layout, démarre les déclencheurs auto.
// useSync()      : expose l'état de sync + un déclencheur manuel à l'UI.
// =====================================================================

/** Démarre la synchronisation automatique. À monter une fois dans le layout. */
export function SyncStarter() {
  useEffect(() => {
    startSync();
  }, []);
  return null;
}

export function useSync(): SyncState & { syncNow: () => void } {
  const [state, setStateValue] = useState<SyncState>(getState());

  useEffect(() => {
    return subscribe(setStateValue);
  }, []);

  return { ...state, syncNow: () => void runSync() };
}
