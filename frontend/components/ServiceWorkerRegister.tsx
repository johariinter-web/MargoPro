'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Echec silencieux : l'appli reste utilisable en ligne, juste sans
        // le confort hors ligne. Pas la peine de bloquer ni d'alerter.
      });
    }
  }, []);

  return null;
}
