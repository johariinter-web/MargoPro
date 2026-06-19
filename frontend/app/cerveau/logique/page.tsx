'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

type Question = {
  enonce: string;
  sequence: string[];
  answer: string;
  options: string[];
  explication: string;
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function makeOptions(answer: string, wrongs: string[]): string[] {
  const unique = Array.from(new Set(wrongs.filter((w) => w !== answer))).slice(0, 3);
  return shuffle([answer, ...unique]);
}

function genArithmetic(): Question {
  const start = Math.floor(Math.random() * 8) + 1;
  const step = Math.floor(Math.random() * 6) + 1;
  const seq = Array.from({ length: 5 }, (_, i) => String(start + i * step));
  return {
    enonce: 'Quelle est la prochaine valeur ?',
    sequence: seq.slice(0, 4),
    answer: seq[4],
    options: makeOptions(seq[4], [
      String(+seq[4] + step),
      String(+seq[4] - step),
      String(+seq[4] + 1),
    ]),
    explication: `+${step} à chaque étape`,
  };
}

function genMultiple(): Question {
  const mult = [2, 3, 5][Math.floor(Math.random() * 3)];
  const start = Math.floor(Math.random() * 3) + 1;
  const seq = Array.from({ length: 5 }, (_, i) => String(start * mult ** i));
  return {
    enonce: 'Quelle est la prochaine valeur ?',
    sequence: seq.slice(0, 4),
    answer: seq[4],
    options: makeOptions(seq[4], [
      String(+seq[4] + mult),
      String(+seq[3] * 2),
      String(+seq[4] - mult),
    ]),
    explication: `×${mult} à chaque étape`,
  };
}

const EMOJI_QUESTIONS: Question[] = [
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['🌟', '⭐', '🌟', '⭐'],
    answer: '🌟',
    options: shuffle(['🌟', '⭐', '💫', '✨']),
    explication: 'Alternance : 🌟 ⭐ 🌟 ⭐ 🌟...',
  },
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['🔴', '🔵', '🟡', '🔴'],
    answer: '🔵',
    options: shuffle(['🔵', '🟡', '🟢', '🔴']),
    explication: 'Répétition : 🔴 🔵 🟡 — 🔴 🔵...',
  },
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['🐶', '🐱', '🐶', '🐱'],
    answer: '🐶',
    options: shuffle(['🐶', '🐱', '🐭', '🐹']),
    explication: 'Alternance : 🐶 🐱 🐶 🐱 🐶...',
  },
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['🍎', '🍊', '🍋', '🍎'],
    answer: '🍊',
    options: shuffle(['🍊', '🍋', '🍎', '🍇']),
    explication: 'Répétition : 🍎 🍊 🍋 — 🍎 🍊...',
  },
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['🌙', '🌙', '☀️', '🌙'],
    answer: '🌙',
    options: shuffle(['🌙', '☀️', '⭐', '🌟']),
    explication: 'Schéma : 🌙 🌙 ☀️ — 🌙 🌙...',
  },
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['➡️', '⬇️', '⬅️', '⬆️'],
    answer: '➡️',
    options: shuffle(['➡️', '⬇️', '⬅️', '⬆️']),
    explication: 'Rotation des 4 directions',
  },
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['🌱', '🌿', '🌳', '🌱'],
    answer: '🌿',
    options: shuffle(['🌿', '🌳', '🌱', '🍀']),
    explication: 'Répétition : 🌱 🌿 🌳 — 🌱 🌿...',
  },
  {
    enonce: 'Quel emoji vient après ?',
    sequence: ['😀', '😐', '😢', '😀'],
    answer: '😐',
    options: shuffle(['😐', '😢', '😀', '😡']),
    explication: 'Répétition : 😀 😐 😢 — 😀 😐...',
  },
];

function buildQuestions(): Question[] {
  const emojis = shuffle(EMOJI_QUESTIONS).slice(0, 5);
  const numbers: Question[] = [];
  for (let i = 0; i < 3; i++) numbers.push(genArithmetic());
  for (let i = 0; i < 2; i++) numbers.push(genMultiple());
  return shuffle([...emojis, ...numbers]);
}

function saveScore(value: number): boolean {
  try {
    const stored = localStorage.getItem('cerveau-scores');
    const scores = stored ? JSON.parse(stored) : {};
    if (value > (scores['logique'] ?? 0)) {
      scores['logique'] = value;
      localStorage.setItem('cerveau-scores', JSON.stringify(scores));
      return true;
    }
  } catch {}
  return false;
}

const TOTAL = 10;

export default function LogiquePage() {
  const [phase, setPhase] = useState<'menu' | 'playing' | 'result'>('menu');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [isRecord, setIsRecord] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('cerveau-scores');
      if (stored) setBestScore(JSON.parse(stored)['logique'] ?? 0);
    } catch {}
  }, []);

  const startGame = () => {
    setQuestions(buildQuestions());
    setIdx(0);
    setScore(0);
    setSelected(null);
    setIsRecord(false);
    setPhase('playing');
  };

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    const correct = opt === questions[idx].answer;
    const newScore = score + (correct ? 1 : 0);
    setScore(newScore);

    setTimeout(() => {
      if (idx + 1 >= TOTAL) {
        const record = saveScore(newScore);
        if (record) setBestScore(newScore);
        setIsRecord(record);
        setFinalScore(newScore);
        setPhase('result');
      } else {
        setIdx((i) => i + 1);
        setSelected(null);
      }
    }, 1100);
  };

  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-pink-50 dark:bg-stone-900">
        <div className="bg-gradient-to-br from-pink-500 to-pink-700 text-white px-5 pt-10 pb-8">
          <Link href="/cerveau" className="text-pink-200 text-sm mb-4 block">
            ← Retour
          </Link>
          <div className="text-5xl mb-2">🔍</div>
          <h1 className="text-3xl font-black">Logique</h1>
          <p className="text-pink-200 mt-1">10 questions · Trouve la suite</p>
        </div>

        <div className="px-4 mt-5 pb-8">
          {bestScore > 0 && (
            <div className="bg-pink-100 dark:bg-pink-950 rounded-xl p-3 text-center mb-4">
              <span className="text-pink-700 dark:text-pink-300 font-bold">
                ⭐ Ton meilleur : {bestScore}/10
              </span>
            </div>
          )}
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 border-2 border-pink-100 dark:border-stone-600 mb-5">
            <h2 className="font-bold text-lg mb-3 text-stone-800 dark:text-white">
              Comment jouer :
            </h2>
            <ul className="space-y-2 text-stone-600 dark:text-stone-300">
              <li>👀 Observe la séquence de symboles ou de chiffres</li>
              <li>🧠 Trouve la logique cachée</li>
              <li>👆 Choisis la bonne réponse parmi 4</li>
            </ul>
          </div>
          <button
            onClick={startGame}
            className="w-full bg-pink-600 text-white rounded-2xl py-4 font-bold text-xl active:scale-95 transition-transform min-h-[56px]"
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
      <div className="min-h-screen bg-pink-50 dark:bg-stone-900 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-8xl mb-4">{emoji}</div>
        <div className="text-7xl font-black text-pink-600">
          {finalScore}/{TOTAL}
        </div>
        <div className="text-2xl font-bold text-stone-700 dark:text-white mt-3">
          {pct >= 80
            ? 'Esprit logique parfait !'
            : pct >= 50
            ? 'Belle réflexion !'
            : 'Observe bien les motifs !'}
        </div>
        {isRecord && (
          <div className="mt-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 font-bold rounded-xl px-5 py-2">
            🎉 Nouveau record !
          </div>
        )}
        <div className="mt-8 space-y-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="w-full bg-pink-600 text-white rounded-2xl py-4 font-bold text-lg active:scale-95 transition-transform"
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
    <div className="min-h-screen bg-pink-50 dark:bg-stone-900">
      <div className="bg-gradient-to-br from-pink-500 to-pink-700 px-5 pt-10 pb-6 text-white">
        <div className="flex justify-between items-center mb-3">
          <span className="text-pink-200 text-sm font-medium">
            Question {idx + 1}/{TOTAL}
          </span>
          <span className="text-pink-200 text-sm font-medium">Score : {score} ✓</span>
        </div>
        <div className="w-full bg-pink-800 rounded-full h-2.5">
          <div
            className="bg-white rounded-full h-2.5 transition-all duration-300"
            style={{ width: `${(idx / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 mt-6">
        <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 border-2 border-pink-100 dark:border-stone-600 text-center">
          <p className="text-sm text-stone-500 dark:text-stone-400 mb-3 font-semibold">
            {q.enonce}
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {q.sequence.map((item, i) => (
              <span key={i} className="text-4xl">
                {item}
              </span>
            ))}
            <span className="text-4xl font-black text-pink-500">?</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          {q.options.map((opt) => {
            let style =
              'bg-white dark:bg-stone-800 border-2 border-pink-100 dark:border-stone-600 text-stone-800 dark:text-white';
            if (selected) {
              if (opt === q.answer)
                style = 'bg-green-100 dark:bg-green-900 border-2 border-green-500 text-green-800 dark:text-green-200';
              else if (opt === selected)
                style = 'bg-red-100 dark:bg-red-900 border-2 border-red-400 text-red-800 dark:text-red-200';
              else
                style = 'bg-white dark:bg-stone-800 border-2 border-pink-100 dark:border-stone-600 text-stone-400 opacity-60';
            }
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`${style} rounded-2xl py-5 text-3xl font-bold transition-all active:scale-95`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selected && (
          <div
            className={`mt-4 rounded-xl p-4 text-center ${
              selected === q.answer
                ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
            }`}
          >
            <span className="font-bold text-lg">
              {selected === q.answer ? '✓ Bravo !' : `✗ Réponse : ${q.answer}`}
            </span>
            <div className="text-sm mt-1 opacity-80">{q.explication}</div>
          </div>
        )}
      </div>
    </div>
  );
}
