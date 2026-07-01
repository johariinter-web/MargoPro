'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'connexion' | 'inscription';

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

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cguAccepte, setCguAccepte] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState(() => {
    if (typeof window === 'undefined') return '';
    const bloque = sessionStorage.getItem('margo_bloque');
    if (bloque) {
      sessionStorage.removeItem('margo_bloque');
      return "Cet appareil a été bloqué par le propriétaire du compte. Contactez-le pour rétablir l'accès.";
    }
    return '';
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function basculerMode() {
    setMode(mode === 'connexion' ? 'inscription' : 'connexion');
    setErreur('');
    setConfirmPassword('');
    setCguAccepte(false);
  }

  const formulaireValide =
    email.trim() !== '' &&
    password.length >= 6 &&
    cguAccepte &&
    (mode === 'connexion' || confirmPassword === password);

  async function soumettre(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formulaireValide) return;
    setLoading(true);
    setErreur('');

    const supabase = createClient();

    if (mode === 'connexion') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErreur('Email ou mot de passe incorrect.');
        setLoading(false);
        return;
      }
      router.push('/');
    } else {
      if (password !== confirmPassword) {
        setErreur('Les mots de passe ne correspondent pas.');
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErreur(error.message.includes('already registered')
          ? 'Cet email est déjà utilisé. Connectez-vous.'
          : 'Erreur lors de la création du compte. Réessayez.');
        setLoading(false);
        return;
      }
      router.push('/onboarding');
    }
  }

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

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>

      {/* HERO PHOTO */}
      <div style={{ width: '100%', height: 240, flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
        <img src="/hero1.jpg" alt="MargoPro" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.9)', fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Gérez votre commerce simplement</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: '20px 24px 32px', maxWidth: 400, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 24, boxSizing: 'border-box' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src="/logo-margopro.svg" alt="MargoPro" style={{ width: 72, height: 72, borderRadius: 18, boxShadow: '0 4px 16px rgba(212,96,26,0.18)' }} />
        </div>

        {/* Formulaire */}
        <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              autoComplete="email"
              required
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = T.accent)}
              onBlur={e => (e.target.style.borderColor = T.border)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
              Mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 caractères"
                autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
                required
                style={{ ...inputStyle, paddingRight: 48 }}
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.textMuted }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75"/></svg>
                )}
              </button>
            </div>
          </div>

          {mode === 'inscription' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                  Confirmer le mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez votre mot de passe"
                    autoComplete="new-password"
                    required
                    style={{ ...inputStyle, paddingRight: 48 }}
                    onFocus={e => (e.target.style.borderColor = T.accent)}
                    onBlur={e => (e.target.style.borderColor = T.border)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: T.textMuted }}
                  >
                    {showConfirm ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/><line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75"/></svg>
                    )}
                  </button>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: 4 }}>
                <input
                  type="checkbox"
                  checked={cguAccepte}
                  onChange={(e) => setCguAccepte(e.target.checked)}
                  style={{ marginTop: 2, width: 20, height: 20, accentColor: T.accent, flexShrink: 0 }}
                />
                <span style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, fontFamily: 'Manrope, sans-serif' }}>
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <a
                    href="/cgu"
                    style={{ color: T.accent, textDecoration: 'underline' }}
                  >
                    Conditions Générales d&apos;Utilisation
                  </a>{' '}
                  de MargoPro.
                </span>
              </label>
            </>
          )}

          {mode === 'connexion' && (
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={cguAccepte}
                onChange={(e) => setCguAccepte(e.target.checked)}
                style={{ marginTop: 2, width: 20, height: 20, accentColor: T.accent, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, fontFamily: 'Manrope, sans-serif' }}>
                J&apos;ai lu et j&apos;accepte les{' '}
                <a
                  href="/cgu"
                  style={{ color: T.accent, textDecoration: 'underline' }}
                >
                  Conditions Générales d&apos;Utilisation
                </a>{' '}
                de MargoPro.
              </span>
            </label>
          )}

          {erreur && (
            <p style={{ fontSize: 13, fontWeight: 600, color: T.red, textAlign: 'center', background: T.redBg, borderRadius: 12, padding: '12px 16px', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
              {erreur}
            </p>
          )}

          <button
            type="submit"
            disabled={!formulaireValide || loading}
            style={{
              width: '100%', height: 52, borderRadius: 14,
              background: T.accent, color: '#fff',
              fontSize: 15, fontWeight: 700,
              border: 'none', cursor: 'pointer',
              opacity: (!formulaireValide || loading) ? 0.4 : 1,
              transition: 'opacity 0.2s',
              fontFamily: 'Manrope, sans-serif',
              marginTop: 4,
            }}
          >
            {loading
              ? '...'
              : mode === 'connexion'
              ? 'Se connecter'
              : 'Créer mon compte'}
          </button>
        </form>

        {/* Basculer mode */}
        <p style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, margin: 0, fontFamily: 'Manrope, sans-serif' }}>
          {mode === 'connexion' ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
          <button
            onClick={basculerMode}
            style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
          >
            {mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>

      </div>
    </div>
  );
}

