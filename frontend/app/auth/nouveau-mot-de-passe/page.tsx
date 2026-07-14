'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const T = {
  accent: '#D4601A',
  accentLight: '#FEF0E6',
  bg: '#FAF7F3',
  surface: '#FFFFFF',
  text: '#1C1811',
  textSub: '#6A5D52',
  textMuted: '#9E8E84',
  border: '#E6DDD3',
  redBg: '#FDECEA',
  red: '#C4341A',
};

const inputStyle = {
  width: '100%',
  border: `2px solid ${T.border}`,
  borderRadius: 14,
  padding: '14px 16px',
  fontSize: 16,
  color: T.text,
  background: T.surface,
  outline: 'none',
  fontFamily: 'Manrope, sans-serif',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s',
};

export default function NouveauMotDePasse() {
  const router = useRouter();
  const [verification, setVerification] = useState(true);
  const [sessionValide, setSessionValide] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [erreur, setErreur] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let actif = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (!actif) return;
      if (event === 'PASSWORD_RECOVERY') {
        setSessionValide(true);
        setVerification(false);
      }
    });

    // Aucun événement PASSWORD_RECOVERY ne se déclenche si le lien est absent,
    // invalide ou déjà utilisé — après ce délai, on abandonne l'attente plutôt
    // que de laisser "Vérification du lien..." tourner indéfiniment.
    const delai = setTimeout(() => {
      if (actif) setVerification(false);
    }, 10000);

    return () => { actif = false; subscription.unsubscribe(); clearTimeout(delai); };
  }, []);

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) { setErreur('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (password !== confirmPassword) { setErreur('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    setErreur('');
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setErreur('Erreur lors de la mise à jour. Réessayez.');
      setLoading(false);
      return;
    }
    router.push('/');
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, padding: '40px 24px 32px', maxWidth: 400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24, boxSizing: 'border-box' }}>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 72, height: 72, borderRadius: 18, boxShadow: '0 4px 16px rgba(212,96,26,0.18)' }} />
        </div>

        {verification && (
          <p style={{ textAlign: 'center', fontSize: 14, color: T.textMuted, fontFamily: 'Manrope, sans-serif' }}>
            Vérification du lien...
          </p>
        )}

        {!verification && !sessionValide && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif', margin: 0 }}>
              Ce lien n&apos;est plus valide.
            </p>
            <p style={{ fontSize: 13, color: T.textMuted, fontFamily: 'Manrope, sans-serif', margin: 0 }}>
              Il a peut-être expiré ou déjà été utilisé. Tu peux en demander un nouveau.
            </p>
            <button
              onClick={() => router.push('/auth?oubli=1')}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: T.accent, color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              Demander un nouveau lien
            </button>
          </div>
        )}

        {!verification && sessionValide && (
          <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif', margin: 0, textAlign: 'center' }}>
              Choisis ton nouveau mot de passe
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                autoComplete="new-password"
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répète ton mot de passe"
                autoComplete="new-password"
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>

            {erreur && (
              <p style={{ fontSize: 13, fontWeight: 600, color: T.red, textAlign: 'center', background: T.redBg, borderRadius: 12, padding: '12px 16px', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
                {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: T.accent, color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                opacity: loading ? 0.4 : 1,
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {loading ? '...' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
