'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
    ) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Vérification périodique des mises à jour
          reg.update().catch(() => {});
        })
        .catch((err) => {
          console.warn('Erreur enregistrement Service Worker:', err);
        });
    }
  }, []);

  return null;
}
