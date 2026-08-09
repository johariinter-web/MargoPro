'use client';

const PLAN_STORAGE_KEY = 'margo_plan_promis';

/** Lit `?plan=pro` dans l'URL courante (lien "Pro" d'eidma.co) et le garde en
 *  mémoire jusqu'à l'inscription. */
export function storePlanPromis(): void {
  const params = new URLSearchParams(window.location.search);
  if (params.get('plan') === 'pro') localStorage.setItem(PLAN_STORAGE_KEY, 'pro');
}

/** Consomme le plan promis stocké (à appeler une seule fois, à la fin de
 *  l'onboarding) : true si le compte doit avoir l'essai étendu de 30 jours. */
export function consumePlanPromis(): boolean {
  const plan = localStorage.getItem(PLAN_STORAGE_KEY);
  localStorage.removeItem(PLAN_STORAGE_KEY);
  return plan === 'pro';
}
