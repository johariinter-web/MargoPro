'use client';

import { useEffect, useState } from 'react';

const KEY = 'margopro-categories';

export const DEFAULT_CATEGORIES = [
  'Alimentation', 'Boissons', 'Hygiène', 'Cosmétiques',
  'Électronique', 'Textile', 'Autre',
];

function load(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  try {
    const v = localStorage.getItem(KEY);
    return v ? JSON.parse(v) : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function save(cats: string[]) {
  localStorage.setItem(KEY, JSON.stringify(cats));
  window.dispatchEvent(new Event('margopro-categories-change'));
}

export function useCategories() {
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    setCategories(load());
    const handler = () => setCategories(load());
    window.addEventListener('margopro-categories-change', handler);
    return () => window.removeEventListener('margopro-categories-change', handler);
  }, []);

  function ajouterCategorie(nom: string) {
    const trimmed = nom.trim();
    if (!trimmed || categories.includes(trimmed)) return;
    const next = [...categories, trimmed];
    setCategories(next);
    save(next);
  }

  function supprimerCategorie(nom: string) {
    const next = categories.filter(c => c !== nom);
    setCategories(next);
    save(next);
  }

  return { categories, ajouterCategorie, supprimerCategorie };
}
