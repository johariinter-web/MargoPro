'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const JEUX = [
  {
    href: '/cerveau/calcul',
    titre: 'Calcul Mental',
    emoji: '🔢',
    description: 'Addition, soustraction, multiplication',
    couleur: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    scoreKey: 'calcul',
    scoreLabel: 'Meilleur score',
    scoreSuffix: '/10',
  },
  {
    href: '/cerveau/memoire',
    titre: 'Mémoire',
    emoji: '🧠',
    description: 'Retiens la séquence de couleurs',
    couleur: 'from-orange-500 to-orange-700',
    bg: 'bg-orange-50 dark:bg-orange-950',
    border: 'border-orange-200 dark:border-orange-800',
    scoreKey: 'memoire',
    scoreLabel: 'Meilleur niveau',
    scoreSuffix: '',
  },
  {
    href: '/cerveau/logique',
    titre: 'Logique',
    emoji: '🔍',
    description: 'Trouve la suite du motif',
    couleur: 'from-pink-500 to-pink-700',
    bg: 'bg-pink-50 dark:bg-pink-950',
    border: 'border-pink-200 dark:border-pink-800',
    scoreKey: 'logique',
    scoreLabel: 'Meilleur score',
    scoreSuffix: '/10',
  },
  {
    href: '/cerveau/mots',
    titre: 'Mots Mélangés',
    emoji: '📝',
    description: 'Anagrammes et intrus',
    couleur: 'from-amber-500 to-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    scoreKey: 'mots',
    scoreLabel: 'Meilleur score',
    scoreSuffix: '/10',
  },
];

export default function CerveauPage() {
  const [scores, setScores] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cerveau-scores');
      if (stored) setScores(JSON.parse(stored));
    } catch {}
  }, []);

  return (
    <div className="min-h-screen bg-violet-50 dark:bg-stone-900">
      <div className="bg-gradient-to-br from-violet-600 to-purple-800 text-white px-5 pt-14 pb-10">
        <div className="text-6xl mb-3">🧠✨</div>
        <h1 className="text-4xl font-black leading-tight">Gym du Cerveau</h1>
        <p className="text-violet-200 mt-2 text-lg">Entraîne ton intelligence !</p>
      </div>

      <div className="px-4 mt-6 space-y-3 pb-8">
        {JEUX.map((jeu) => {
          const score = scores[jeu.scoreKey];
          return (
            <Link
              key={jeu.href}
              href={jeu.href}
              className={`flex items-center gap-4 rounded-2xl p-4 border-2 ${jeu.bg} ${jeu.border} shadow-sm active:scale-95 transition-transform`}
            >
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${jeu.couleur} flex items-center justify-center text-3xl shadow-md flex-shrink-0`}
              >
                {jeu.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-stone-800 dark:text-white">{jeu.titre}</div>
                <div className="text-sm text-stone-500 dark:text-stone-400 mt-0.5">{jeu.description}</div>
                {score !== undefined && score > 0 && (
                  <div className="mt-1.5 text-xs font-bold text-violet-600 dark:text-violet-400">
                    ⭐ {jeu.scoreLabel} : {score}{jeu.scoreSuffix}
                  </div>
                )}
              </div>
              <span className="text-stone-300 text-2xl flex-shrink-0">›</span>
            </Link>
          );
        })}

        <div className="mt-4 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 dark:from-stone-800 dark:to-stone-700 p-5 text-center">
          <div className="text-3xl mb-2">💪</div>
          <p className="text-violet-700 dark:text-violet-300 font-bold text-lg">
            Plus tu t'entraînes, plus tu deviens fort !
          </p>
          <p className="text-violet-500 dark:text-violet-400 text-sm mt-1">
            Fais au moins un jeu par jour
          </p>
        </div>
      </div>
    </div>
  );
}
