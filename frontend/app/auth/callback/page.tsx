'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clearLocalData, estProprietaireDonneesLocales, marquerProprietaireDonneesLocales } from '@/lib/db';
import { resetSyncState } from '@/lib/syncController';

const T = {
  accent: '#D4601A',
  bg: '#FAF7F3',
  text: '#1C1811',
  textMuted: '#9E8E84',
};

// Meme principe que assurerDonneesPropresPour dans auth/page.tsx - un autre
// compte a pu rester connecte sur cet appareil (session juste expiree, jamais
// deconnecte explicitement) : sans ce controle, ses donnees locales
// resteraient affichees sous la nouvelle session tant que la synchro n'a pas
// eu la chance de les remplacer.
async function assurerDonneesPropresPour(userId: string) {
  if (!estProprietaireDonneesLocales(userId)) {
    await clearLocalData();
    resetSyncState();
  }
  marquerProprietaireDonneesLocales(userId);
}

export default function AuthCallback() {
  const router = useRouter();
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let actif = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!actif || event !== 'SIGNED_IN' || !session?.user) return;
      await assurerDonneesPropresPour(session.user.id);
      router.replace('/');
    });

    // Le client a pu echanger le code avant que ce composant ne s'abonne a
    // onAuthStateChange, auquel cas SIGNED_IN ne se redeclenche jamais - on
    // verifie donc aussi une fois directement au montage.
    supabase.auth.getUser().then(async ({ data }) => {
      if (actif && data.user) {
        await assurerDonneesPropresPour(data.user.id);
        router.replace('/');
      }
    });

    // Aucun evenement ne se declenche si le code est absent, invalide ou deja
    // utilise - apres ce delai, on abandonne l'attente plutot que de laisser
    // "Connexion en cours..." tourner indefiniment.
    const delai = setTimeout(() => {
      if (actif) setErreur(true);
    }, 10000);

    return () => { actif = false; subscription.unsubscribe(); clearTimeout(delai); };
  }, [router]);

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 24 }} />
      {!erreur ? (
        <p style={{ fontSize: 14, color: T.textMuted, fontFamily: 'Manrope, sans-serif' }}>
          Connexion en cours...
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center', maxWidth: 320 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif', margin: 0 }}>
            La connexion a échoué.
          </p>
          <button
            onClick={() => router.push('/auth')}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: T.accent, color: '#fff',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            Retour à la connexion
          </button>
        </div>
      )}
    </div>
  );
}
