'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clearLocalData } from '@/lib/db';

type Mode = 'connexion' | 'inscription' | 'oubli';

// Coupe-circuit temporaire : le bouton "Téléphone" reste visible (les gens
// savent que ça arrive) mais indique "bientôt disponible" au lieu du
// formulaire, tant qu'on n'a pas confirmé un vrai envoi de SMS de bout en
// bout avec un solde Africa's Talking suffisant. Repasser à true une fois
// confirmé.
const TELEPHONE_DISPONIBLE = false;

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
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === 'undefined') return 'connexion';
    const params = new URLSearchParams(window.location.search);
    return params.get('oubli') ? 'oubli' : 'connexion';
  });
  const [email, setEmail] = useState('');
  const [identifiant, setIdentifiant] = useState<'email' | 'telephone'>('email');
  const [telephone, setTelephone] = useState('');
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
  const [oubliEnvoye, setOubliEnvoye] = useState(false);
  const [oubliLoading, setOubliLoading] = useState(false);
  const [confirmationEmailRequise, setConfirmationEmailRequise] = useState(false);
  const [confirmationTelephoneRequise, setConfirmationTelephoneRequise] = useState(false);
  const [codeSms, setCodeSms] = useState('');
  const [erreurCode, setErreurCode] = useState('');
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [renvoiEnCours, setRenvoiEnCours] = useState(false);
  const [renvoiMessage, setRenvoiMessage] = useState('');
  const [sessionActiveEmail, setSessionActiveEmail] = useState<string | null | undefined>(undefined);
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setSessionActiveEmail(data.user?.email ?? null);
    });
  }, []);

  async function seDeconnecterEtContinuer() {
    setDeconnexionEnCours(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearLocalData();
    setSessionActiveEmail(null);
    setDeconnexionEnCours(false);
  }

  function basculerMode() {
    setMode(mode === 'connexion' ? 'inscription' : 'connexion');
    setErreur('');
    setConfirmPassword('');
    setCguAccepte(false);
    setConfirmationEmailRequise(false);
    setTelephone('');
    setConfirmationTelephoneRequise(false);
  }

  function voirOubli() {
    setMode('oubli');
    setErreur('');
    setOubliEnvoye(false);
  }

  function retourConnexion() {
    setMode('connexion');
    setErreur('');
    setOubliEnvoye(false);
    setConfirmationEmailRequise(false);
    setConfirmationTelephoneRequise(false);
    setCodeSms('');
    setErreurCode('');
    setRenvoiMessage('');
  }

  async function envoyerReinitialisation(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setOubliLoading(true);
    const supabase = createClient();
    // Le résultat n'est jamais branché dans l'UI (succès, email inexistant, ou
    // échec réseau affichent tous le même message) pour ne jamais révéler si
    // un compte existe.
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/nouveau-mot-de-passe`,
      });
    } catch {
      // Ignoré volontairement : même comportement qu'un succès, voir commentaire ci-dessus.
    }
    setOubliLoading(false);
    setOubliEnvoye(true);
  }

  const identifiantValide = identifiant === 'email'
    ? email.trim() !== ''
    : TELEPHONE_DISPONIBLE && /^\+[1-9]\d{6,14}$/.test(telephone.trim());
  const formulaireValide =
    identifiantValide &&
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
      const { error } = identifiant === 'email'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signInWithPassword({ phone: telephone.trim(), password });
      if (error) {
        setErreur(identifiant === 'email' ? 'Email ou mot de passe incorrect.' : 'Numéro ou mot de passe incorrect.');
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
      if (identifiant === 'email') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) {
          setErreur(error.message.includes('already registered')
            ? 'Cet email est déjà utilisé. Connectez-vous.'
            : 'Erreur lors de la création du compte. Réessayez.');
          setLoading(false);
          return;
        }
        if (!data.session) {
          // Confirmation email activée côté Supabase : aucune session tant que le lien
          // n'a pas été cliqué. /onboarding est protégé par le middleware, donc on ne
          // redirige pas : on informe l'utilisateur à la place.
          setConfirmationEmailRequise(true);
          setLoading(false);
          return;
        }
        router.push('/onboarding');
      } else {
        const { data, error } = await supabase.auth.signUp({ phone: telephone.trim(), password });
        if (error) {
          setErreur(error.message.includes('already registered') || error.message.includes('already exists')
            ? 'Ce numéro est déjà utilisé. Connectez-vous.'
            : 'Erreur lors de la création du compte. Réessayez.');
          setLoading(false);
          return;
        }
        if (!data.session) {
          // Meme principe que l'email : aucune session tant que le code SMS
          // n'a pas ete verifie. Task 4 branche cet ecran.
          setConfirmationTelephoneRequise(true);
          setLoading(false);
          return;
        }
        router.push('/onboarding');
      }
    }
  }

  async function verifierCodeSms(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (codeSms.trim().length !== 6) return;
    setVerificationEnCours(true);
    setErreurCode('');
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: telephone.trim(),
      token: codeSms.trim(),
      type: 'sms',
    });
    if (error) {
      setErreurCode('Code incorrect ou expiré. Réessaie ou demande un nouveau code.');
      setVerificationEnCours(false);
      return;
    }
    router.push('/onboarding');
  }

  async function renvoyerCodeSms() {
    setRenvoiEnCours(true);
    setRenvoiMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: 'sms', phone: telephone.trim() });
    setRenvoiEnCours(false);
    if (error) {
      // Supabase applique deja sa propre limite de frequence (~60s) et
      // renvoie une erreur explicite si on redemande trop vite - on
      // l'affiche telle quelle plutot que de reimplementer une limite.
      setRenvoiMessage(error.message.includes('security purposes')
        ? 'Merci de patienter avant de redemander un code.'
        : "Échec de l'envoi. Réessaie dans un instant.");
      return;
    }
    setRenvoiMessage('Nouveau code envoyé.');
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

        {/* Déjà connectée : bloque le formulaire pour éviter de continuer sur l'ancienne session */}
        {typeof sessionActiveEmail === 'string' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6, margin: 0 }}>
              Tu es déjà connectée avec <strong>{sessionActiveEmail}</strong>. Déconnecte-toi d&apos;abord pour te connecter à un autre compte.
            </p>
            <button
              onClick={seDeconnecterEtContinuer}
              disabled={deconnexionEnCours}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: T.accent, color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                opacity: deconnexionEnCours ? 0.4 : 1,
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {deconnexionEnCours ? '...' : 'Se déconnecter'}
            </button>
          </div>
        )}

        {/* Formulaire */}
        {typeof sessionActiveEmail !== 'string' && mode !== 'oubli' && !confirmationEmailRequise && !confirmationTelephoneRequise && (
        <form onSubmit={soumettre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div style={{ display: 'flex', gap: 8, background: T.bg, borderRadius: 12, padding: 4 }}>
            {(['email', 'telephone'] as const).map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { setIdentifiant(opt); setErreur(''); }}
                style={{
                  flex: 1, height: 40, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: identifiant === opt ? T.accent : 'transparent',
                  color: identifiant === opt ? '#fff' : T.textSub,
                  fontSize: 14, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                }}
              >
                {opt === 'email' ? 'Email' : 'Téléphone'}
              </button>
            ))}
          </div>

          {identifiant === 'email' ? (
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
          ) : !TELEPHONE_DISPONIBLE ? (
            <div style={{ background: T.accentLight, borderRadius: 14, padding: '14px 16px' }}>
              <p style={{ fontSize: 13, color: T.text, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6, margin: 0 }}>
                La connexion par téléphone arrive bientôt ! Utilise ton email pour l&apos;instant.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Numéro de téléphone
              </label>
              <input
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+2250123456789"
                autoComplete="tel"
                required
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
              <span style={{ fontSize: 12, color: T.textMuted }}>Avec l&apos;indicatif du pays, ex: +225 pour la Côte d&apos;Ivoire.</span>
            </div>
          )}

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

          {mode === 'connexion' && (
            <button
              type="button"
              onClick={voirOubli}
              style={{ alignSelf: 'flex-end', marginTop: -8, color: T.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
            >
              Mot de passe oublié ?
            </button>
          )}

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
        )}

        {/* Basculer mode */}
        {typeof sessionActiveEmail !== 'string' && mode !== 'oubli' && !confirmationEmailRequise && !confirmationTelephoneRequise && (
        <p style={{ textAlign: 'center', fontSize: 13, color: T.textMuted, margin: 0, fontFamily: 'Manrope, sans-serif' }}>
          {mode === 'connexion' ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
          <button
            onClick={basculerMode}
            style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
          >
            {mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>
        )}

        {/* Confirmation email requise après inscription */}
        {typeof sessionActiveEmail !== 'string' && mode === 'inscription' && confirmationEmailRequise && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6, margin: 0 }}>
              Compte créé ! Vérifie ta boîte de réception (et les spams) pour confirmer ton email, puis connecte-toi.
            </p>
            <button
              onClick={retourConnexion}
              style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
            >
              Retour à la connexion
            </button>
          </div>
        )}

        {/* Confirmation téléphone requise après inscription */}
        {typeof sessionActiveEmail !== 'string' && mode === 'inscription' && confirmationTelephoneRequise && (
          <form onSubmit={verifierCodeSms} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
              Un code à 6 chiffres a été envoyé par SMS au {telephone}. Entre-le ci-dessous.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                Code reçu par SMS
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={codeSms}
                onChange={(e) => setCodeSms(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                required
                style={{ ...inputStyle, textAlign: 'center', fontSize: 24, letterSpacing: 8, fontFamily: '"Space Grotesk", sans-serif' }}
                onFocus={e => (e.target.style.borderColor = T.accent)}
                onBlur={e => (e.target.style.borderColor = T.border)}
              />
            </div>
            {erreurCode && (
              <p style={{ fontSize: 13, fontWeight: 600, color: T.red, textAlign: 'center', background: T.redBg, borderRadius: 12, padding: '12px 16px', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
                {erreurCode}
              </p>
            )}
            <button
              type="submit"
              disabled={codeSms.trim().length !== 6 || verificationEnCours}
              style={{
                width: '100%', height: 52, borderRadius: 14,
                background: T.accent, color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                opacity: (codeSms.trim().length !== 6 || verificationEnCours) ? 0.4 : 1,
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {verificationEnCours ? '...' : 'Vérifier'}
            </button>
            <button
              type="button"
              onClick={renvoyerCodeSms}
              disabled={renvoiEnCours}
              style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}
            >
              {renvoiEnCours ? '...' : "Je n'ai pas reçu le code, renvoyer"}
            </button>
            {renvoiMessage && (
              <p style={{ fontSize: 12, color: T.textMuted, textAlign: 'center', margin: 0, fontFamily: 'Manrope, sans-serif' }}>
                {renvoiMessage}
              </p>
            )}
            <button
              type="button"
              onClick={retourConnexion}
              style={{ color: T.textMuted, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}
            >
              Retour à la connexion
            </button>
          </form>
        )}

        {typeof sessionActiveEmail !== 'string' && mode === 'oubli' && (
          oubliEnvoye ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', lineHeight: 1.6, margin: 0 }}>
                Si un compte existe avec cet email, un lien de réinitialisation a été envoyé. Vérifie ta boîte de réception (et les spams).
              </p>
              <button
                onClick={retourConnexion}
                style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif' }}
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={envoyerReinitialisation} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ fontSize: 13, color: T.textSub, fontFamily: 'Manrope, sans-serif', margin: 0, textAlign: 'center' }}>
                Entre ton email, on t&apos;envoie un lien pour choisir un nouveau mot de passe.
              </p>
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
              <button
                type="submit"
                disabled={!email.trim() || oubliLoading}
                style={{
                  width: '100%', height: 52, borderRadius: 14,
                  background: T.accent, color: '#fff',
                  fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                  opacity: (!email.trim() || oubliLoading) ? 0.4 : 1,
                  fontFamily: 'Manrope, sans-serif',
                }}
              >
                {oubliLoading ? '...' : 'Envoyer le lien'}
              </button>
              <button
                type="button"
                onClick={retourConnexion}
                style={{ color: T.accent, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 13, fontFamily: 'Manrope, sans-serif', textAlign: 'center' }}
              >
                Retour à la connexion
              </button>
            </form>
          )
        )}

      </div>
    </div>
  );
}

