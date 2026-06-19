'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

type QType = 'anagramme' | 'intrus';
type Question = {
  type: QType;
  consigne: string;
  display: string;
  answer: string;
  options: string[];
  explication: string;
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function scramble(word: string): string {
  const letters = word.split('');
  let result: string;
  let tries = 0;
  do {
    result = shuffle(letters).join('');
    tries++;
  } while (result === word && tries < 20);
  return result.toUpperCase();
}

const MOTS = [
  'MAISON', 'JARDIN', 'SOLEIL', 'ENFANT', 'CLASSE',
  'CAHIER', 'CRAYON', 'ECOLE', 'ARBRE', 'NUAGE',
  'LIVRE', 'TABLE', 'CHAISE', 'PORTE', 'ROUGE',
  'CHIEN', 'LAPIN', 'FLEUR', 'BLANC', 'MANGER',
];

const INTRUS_SETS = [
  {
    mots: ['chien', 'chat', 'lapin', 'voiture'],
    intrus: 'voiture',
    categorie: 'animaux',
  },
  {
    mots: ['rouge', 'bleu', 'vert', 'grand'],
    intrus: 'grand',
    categorie: 'couleurs',
  },
  {
    mots: ['lundi', 'mardi', 'mars', 'jeudi'],
    intrus: 'mars',
    categorie: 'jours',
  },
  {
    mots: ['fraise', 'pomme', 'carotte', 'mangue'],
    intrus: 'carotte',
    categorie: 'fruits',
  },
  {
    mots: ['triangle', 'cercle', 'carre', 'rouge'],
    intrus: 'rouge',
    categorie: 'formes',
  },
  {
    mots: ['soleil', 'lune', 'etoile', 'riviere'],
    intrus: 'riviere',
    categorie: 'astres',
  },
  {
    mots: ['stylo', 'crayon', 'regle', 'ballon'],
    intrus: 'ballon',
    categorie: 'fournitures',
  },
  {
    mots: ['printemps', 'ete', 'automne', 'dimanche'],
    intrus: 'dimanche',
    categorie: 'saisons',
  },
  {
    mots: ['addition', 'soustraction', 'multiplication', 'couleur'],
    intrus: 'couleur',
    categorie: 'operations',
  },
  {
    mots: ['piano', 'guitare', 'flute', 'marteau'],
    intrus: 'marteau',
    categorie: 'instruments',
  },
];

function buildQuestions(): Question[] {
  const anagrammeMots = shuffle(MOTS).slice(0, 5);
  const intrusSets = shuffle(INTRUS_SETS).slice(0, 5);

  const anagrammes: Question[] = anagrammeMots.map((mot) => ({
    type: 'anagramme',
    consigne: 'Les lettres sont mélangées. Retrouve le vrai mot !',
    display: scramble(mot),
    answer: mot,
    options: [],
    explication: `Le mot caché était : ${mot}`,
  }));

  const intrus: Question[] = intrusSets.map(({ mots, intrus: ans, categorie }) => ({
    type: 'intrus',
    consigne: `Quel mot n'est PAS un ${categorie} ?`,
    display: mots.join(' · '),
    answer: ans,
    options: shuffle(mots),
    explication: `"${ans}" n'est pas un ${categorie}`,
  }));

  return shuffle([...anagrammes, ...intrus]);
}

function saveScore(value: number): boolean {
  try {
    const stored = localStorage.getItem('cerveau-scores');
    const scores = stored ? JSON.parse(stored) : {};
    if (value > (scores['mots'] ?? 0)) {
      scores['mots'] = value;
      localStorage.setItem('cerveau-scores', JSON.stringify(scores));
      return true;
    }
  } catch {}
  return false;
}

const TOTAL = 10;

export default function MotsPage() {
  const [phase, setPhase] = useState<'menu' | 'playing' | 'result'>('menu');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isRecord, setIsRecord] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cerveau-scores');
      if (stored) setBestScore(JSON.parse(stored)['mots'] ?? 0);
    } catch {}
  }, []);

  const startGame = () => {
    setQuestions(buildQuestions());
    setIdx(0);
    setInput('');
    setSelected(null);
    setFeedback(null);
    setScore(0);
    setIsRecord(false);
    setPhase('playing');
  };

  const submitAnswer = (answer: string) => {
    if (feedback) return;
    const q = questions[idx];
    const correct = answer.toUpperCase() === q.answer.toUpperCase();
    const newScore = score + (correct ? 1 : 0);
    setScore(newScore);
    setSelected(answer);
    setFeedback(correct ? 'correct' : 'wrong');

    setTimeout(() => {
      if (idx + 1 >= TOTAL) {
        const record = saveScore(newScore);
        if (record) setBestScore(newScore);
        setIsRecord(record);
        setFinalScore(newScore);
        setPhase('result');
      } else {
        setIdx((i) => i + 1);
        setInput('');
        setSelected(null);
        setFeedback(null);
      }
    }, 1200);
  };

  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-amber-50 dark:bg-stone-900">
        <div className="bg-gradient-to-br from-amber-500 to-amber-700 text-white px-5 pt-10 pb-8">
          <Link href="/cerveau" className="text-amber-200 text-sm mb-4 block">
            ← Retour
          </Link>
          <div className="text-5xl mb-2">📝</div>
          <h1 className="text-3xl font-black">Mots Mélangés</h1>
          <p className="text-amber-200 mt-1">10 questions · Anagrammes & intrus</p>
        </div>

        <div className="px-4 mt-5 pb-8">
          {bestScore > 0 && (
            <div className="bg-amber-100 dark:bg-amber-950 rounded-xl p-3 text-center mb-4">
              <span className="text-amber-700 dark:text-amber-300 font-bold">
                ⭐ Ton meilleur : {bestScore}/10
              </span>
            </div>
          )}
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 border-2 border-amber-100 dark:border-stone-600 mb-5">
            <h2 className="font-bold text-lg mb-3 text-stone-800 dark:text-white">
              Deux types d'exercices :
            </h2>
            <ul className="space-y-3 text-stone-600 dark:text-stone-300">
              <li>
                <span className="font-bold">🔤 Anagramme</span>
                <br />
                <span className="text-sm">Les lettres sont mélangées. Retrouve le vrai mot !</span>
              </li>
              <li>
                <span className="font-bold">🚫 Trouve l'intrus</span>
                <br />
                <span className="text-sm">Un mot ne va pas avec les autres. Lequel ?</span>
              </li>
            </ul>
          </div>
          <button
            onClick={startGame}
            className="w-full bg-amber-600 text-white rounded-2xl py-4 font-bold text-xl active:scale-95 transition-transform min-h-[56px]"
          >
            🚀 Commencer !
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    const pct = Math.round((finalScore / TOTAL) * 100);
    const emoji = pct === 100 ? '🏆' : pct >= 70 ? '🌟' : pct >= 40 ? '💪' : '📚';
    return (
      <div className="min-h-screen bg-amber-50 dark:bg-stone-900 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-8xl mb-4">{emoji}</div>
        <div className="text-7xl font-black text-amber-600">
          {finalScore}/{TOTAL}
        </div>
        <div className="text-2xl font-bold text-stone-700 dark:text-white mt-3">
          {pct >= 80
            ? 'Vocabulaire excellent !'
            : pct >= 50
            ? 'Bon travail !'
            : 'Entraîne-toi encore !'}
        </div>
        {isRecord && (
          <div className="mt-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 font-bold rounded-xl px-5 py-2">
            🎉 Nouveau record !
          </div>
        )}
        <div className="mt-8 space-y-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="w-full bg-amber-600 text-white rounded-2xl py-4 font-bold text-lg active:scale-95 transition-transform"
          >
            🔄 Rejouer
          </button>
          <Link
            href="/cerveau"
            className="block text-center bg-white dark:bg-stone-800 text-stone-700 dark:text-white rounded-2xl py-4 font-bold border-2 border-stone-200 dark:border-stone-600"
          >
            🏠 Menu principal
          </Link>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div
      className={`min-h-screen transition-colors ${
        feedback === 'correct'
          ? 'bg-green-50 dark:bg-green-950'
          : feedback === 'wrong'
          ? 'bg-red-50 dark:bg-red-950'
          : 'bg-amber-50 dark:bg-stone-900'
      }`}
    >
      <div className="bg-gradient-to-br from-amber-500 to-amber-700 px-5 pt-10 pb-6 text-white">
        <div className="flex justify-between items-center mb-3">
          <span className="text-amber-200 text-sm font-medium">
            Question {idx + 1}/{TOTAL}
          </span>
          <span className="text-amber-200 text-sm font-medium">Score : {score} ✓</span>
        </div>
        <div className="w-full bg-amber-800 rounded-full h-2.5">
          <div
            className="bg-white rounded-full h-2.5 transition-all duration-300"
            style={{ width: `${(idx / TOTAL) * 100}%` }}
          />
        </div>
        <div className="mt-2 text-amber-200 text-sm font-semibold">
          {q.type === 'anagramme' ? '🔤 Anagramme' : '🚫 Trouve l\'intrus'}
        </div>
      </div>

      <div className="px-4 mt-6 pb-8">
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 border-2 border-amber-100 dark:border-stone-600">
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-3">{q.consigne}</p>
          {q.type === 'anagramme' ? (
            <div className="text-5xl font-black text-center text-amber-600 tracking-widest py-2">
              {q.display}
            </div>
          ) : (
            <div className="text-lg font-semibold text-center text-stone-700 dark:text-white leading-relaxed">
              {q.display}
            </div>
          )}
        </div>

        {q.type === 'anagramme' ? (
          <>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && input.trim() && submitAnswer(input.trim())}
              className="mt-4 text-2xl text-center font-bold w-full rounded-2xl border-2 border-amber-300 dark:border-stone-500 py-4 px-4 bg-white dark:bg-stone-800 dark:text-white focus:outline-none focus:border-amber-500 uppercase tracking-widest"
              placeholder="Tape le mot..."
              disabled={!!feedback}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
            />
            {!feedback && (
              <button
                onClick={() => input.trim() && submitAnswer(input.trim())}
                disabled={!input.trim()}
                className="mt-3 w-full bg-amber-600 text-white rounded-2xl py-4 font-bold text-xl disabled:opacity-40 active:scale-95 transition-transform min-h-[56px]"
              >
                Valider ✓
              </button>
            )}
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {q.options.map((opt) => {
              let style =
                'bg-white dark:bg-stone-800 border-2 border-amber-100 dark:border-stone-600 text-stone-800 dark:text-white';
              if (feedback) {
                if (opt === q.answer)
                  style = 'bg-green-100 dark:bg-green-900 border-2 border-green-500 text-green-800 dark:text-green-200';
                else if (opt === selected)
                  style = 'bg-red-100 dark:bg-red-900 border-2 border-red-400 text-red-800 dark:text-red-200';
                else style = 'bg-white dark:bg-stone-800 border-2 border-amber-100 dark:border-stone-600 text-stone-400 opacity-50';
              }
              return (
                <button
                  key={opt}
                  onClick={() => submitAnswer(opt)}
                  disabled={!!feedback}
                  className={`${style} rounded-2xl py-5 text-base font-bold transition-all active:scale-95`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        )}

        {feedback && (
          <div
            className={`mt-4 rounded-xl p-4 text-center ${
              feedback === 'correct'
                ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
            }`}
          >
            <span className="font-bold text-lg">
              {feedback === 'correct' ? '✓ Bravo !' : `✗ La réponse était : ${q.answer}`}
            </span>
            <div className="text-sm mt-1 opacity-80">{q.explication}</div>
          </div>
        )}
      </div>
    </div>
  );
}
