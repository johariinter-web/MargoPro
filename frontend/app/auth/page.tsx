'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'connexion' | 'inscription';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('connexion');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cguAccepte, setCguAccepte] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState('');

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

  async function soumettre(e: React.FormEvent) {
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

  return (
    <div className="min-h-screen bg-stone-bg dark:bg-stone-800 flex flex-col justify-center px-6 py-8">
      <div className="max-w-sm mx-auto w-full space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: '#059669' }}
          >
            <span className="text-white text-3xl font-black">M</span>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-stone-800 dark:text-stone-50 tracking-tight">MargoPro</p>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">Gérez votre commerce simplement</p>
          </div>
        </div>

        {/* Formulaire */}
        <form onSubmit={soumettre} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300">
              Adresse email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemple@email.com"
              autoComplete="email"
              required
              className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-4 text-base bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 caractères"
              autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
              required
              className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-4 text-base bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none transition-colors"
            />
          </div>

          {mode === 'inscription' && (
            <>
              <div className="space-y-1">
                <label className="block text-sm font-semibold text-stone-700 dark:text-stone-300">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez votre mot de passe"
                  autoComplete="new-password"
                  required
                  className="w-full border-2 border-stone-200 dark:border-stone-600 rounded-xl px-4 py-4 text-base bg-white dark:bg-stone-700 text-stone-800 dark:text-stone-100 focus:border-emerald outline-none transition-colors"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={cguAccepte}
                  onChange={(e) => setCguAccepte(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-emerald flex-shrink-0"
                />
                <span className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                  J&apos;ai lu et j&apos;accepte les{' '}
                  <a
                    href="https://eidma.co/cgu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald underline"
                  >
                    Conditions Générales d&apos;Utilisation
                  </a>{' '}
                  de MargoPro.
                </span>
              </label>
            </>
          )}

          {mode === 'connexion' && (
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cguAccepte}
                onChange={(e) => setCguAccepte(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-emerald flex-shrink-0"
              />
              <span className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                J&apos;ai lu et j&apos;accepte les{' '}
                <a
                  href="https://eidma.co/cgu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald underline"
                >
                  Conditions Générales d&apos;Utilisation
                </a>{' '}
                de MargoPro.
              </span>
            </label>
          )}

          {erreur && (
            <p className="text-red-loss text-sm font-medium text-center bg-red-50 dark:bg-red-900/20 rounded-xl px-4 py-3">
              {erreur}
            </p>
          )}

          <button
            type="submit"
            disabled={!formulaireValide || loading}
            className="w-full bg-emerald text-white rounded-xl py-4 text-lg font-bold min-h-[56px] disabled:opacity-40 transition-opacity mt-2"
          >
            {loading
              ? '...'
              : mode === 'connexion'
              ? 'Se connecter'
              : 'Créer mon compte'}
          </button>
        </form>

        {/* Basculer mode */}
        <p className="text-center text-sm text-stone-600 dark:text-stone-400">
          {mode === 'connexion' ? "Pas encore de compte ?" : "Déjà un compte ?"}{' '}
          <button
            onClick={basculerMode}
            className="text-emerald font-semibold underline"
          >
            {mode === 'connexion' ? 'Créer un compte' : 'Se connecter'}
          </button>
        </p>

      </div>
    </div>
  );
}
