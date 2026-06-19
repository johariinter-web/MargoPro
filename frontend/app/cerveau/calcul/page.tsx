'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

type Op = '+' | '-' | '×' | '÷';
type Phase = 'menu' | 'playing' | 'result';
type Question = { a: number; b: number; op: Op; answer: number };

function genQuestion(level: number): Question {
  if (level === 1) {
    const op: Op = Math.random() > 0.5 ? '+' : '-';
    let a = Math.floor(Math.random() * 19) + 2;
    let b = Math.floor(Math.random() * 19) + 1;
    if (op === '-' && a < b) [a, b] = [b, a];
    return { a, b, op, answer: op === '+' ? a + b : a - b };
  }
  if (level === 2) {
    const ops: Op[] = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * 3)];
    if (op === '×') {
      const a = Math.floor(Math.random() * 9) + 2;
      const b = Math.floor(Math.random() * 9) + 2;
      return { a, b, op, answer: a * b };
    }
    let a = Math.floor(Math.random() * 80) + 20;
    let b = Math.floor(Math.random() * 50) + 5;
    if (op === '-' && a < b) [a, b] = [b, a];
    return { a, b, op, answer: op === '+' ? a + b : a - b };
  }
  const ops: Op[] = ['+', '-', '×', '÷'];
  const op = ops[Math.floor(Math.random() * 4)];
  if (op === '÷') {
    const b = Math.floor(Math.random() * 9) + 2;
    const answer = Math.floor(Math.random() * 11) + 2;
    return { a: b * answer, b, op, answer };
  }
  if (op === '×') {
    const a = Math.floor(Math.random() * 11) + 3;
    const b = Math.floor(Math.random() * 11) + 3;
    return { a, b, op, answer: a * b };
  }
  let a = Math.floor(Math.random() * 400) + 100;
  let b = Math.floor(Math.random() * 200) + 50;
  if (op === '-' && a < b) [a, b] = [b, a];
  return { a, b, op, answer: op === '+' ? a + b : a - b };
}

const TOTAL = 10;
const LEVELS = [
  { l: 1, label: '🟢 Facile', desc: "Addition et soustraction jusqu'à 20" },
  { l: 2, label: '🟡 Moyen', desc: 'Tables de ×, nombres jusqu\'à 100' },
  { l: 3, label: '🔴 Expert', desc: 'Toutes les opérations, grands nombres' },
];

function saveScore(key: string, value: number) {
  try {
    const stored = localStorage.getItem('cerveau-scores');
    const scores = stored ? JSON.parse(stored) : {};
    if (value > (scores[key] ?? 0)) {
      scores[key] = value;
      localStorage.setItem('cerveau-scores', JSON.stringify(scores));
      return true;
    }
  } catch {}
  return false;
}

function loadScore(key: string): number {
  try {
    const stored = localStorage.getItem('cerveau-scores');
    return stored ? (JSON.parse(stored)[key] ?? 0) : 0;
  } catch {
    return 0;
  }
}

export default function CalculPage() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [level, setLevel] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const [isRecord, setIsRecord] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    setBestScore(loadScore('calcul'));
  }, []);

  const startGame = (l: number) => {
    setLevel(l);
    setQuestions(Array.from({ length: TOTAL }, () => genQuestion(l)));
    setIdx(0);
    setInput('');
    setScore(0);
    setFeedback(null);
    setIsRecord(false);
    setPhase('playing');
  };

  const submit = useCallback(() => {
    if (!input.trim() || feedback) return;
    const q = questions[idx];
    const correct = parseInt(input.trim()) === q.answer;
    const newScore = score + (correct ? 1 : 0);
    setScore(newScore);
    setFeedback(correct ? 'correct' : 'wrong');

    setTimeout(() => {
      setFeedback(null);
      setInput('');
      if (idx + 1 >= TOTAL) {
        const record = saveScore('calcul', newScore);
        if (record) setBestScore(newScore);
        setIsRecord(record);
        setFinalScore(newScore);
        setPhase('result');
      } else {
        setIdx(idx + 1);
      }
    }, 700);
  }, [input, feedback, questions, idx, score]);

  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-stone-900">
        <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white px-5 pt-10 pb-8">
          <Link href="/cerveau" className="text-blue-200 text-sm mb-4 block">
            ← Retour
          </Link>
          <div className="text-5xl mb-2">🔢</div>
          <h1 className="text-3xl font-black">Calcul Mental</h1>
          <p className="text-blue-200 mt-1">10 questions · Choisis ton niveau</p>
        </div>

        <div className="px-4 mt-5 space-y-3 pb-8">
          {bestScore > 0 && (
            <div className="bg-blue-100 dark:bg-blue-950 rounded-xl p-3 text-center">
              <span className="text-blue-700 dark:text-blue-300 font-bold">
                ⭐ Ton meilleur : {bestScore}/10
              </span>
            </div>
          )}
          {LEVELS.map(({ l, label, desc }) => (
            <button
              key={l}
              onClick={() => startGame(l)}
              className="w-full text-left bg-white dark:bg-stone-800 rounded-2xl p-5 border-2 border-blue-100 dark:border-stone-600 shadow-sm active:scale-95 transition-transform"
            >
              <div className="text-xl font-bold text-stone-800 dark:text-white">{label}</div>
              <div className="text-sm text-stone-500 dark:text-stone-400 mt-1">{desc}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    const pct = Math.round((finalScore / TOTAL) * 100);
    const emoji = pct === 100 ? '🏆' : pct >= 70 ? '🌟' : pct >= 40 ? '💪' : '📚';
    const msg =
      pct === 100
        ? 'Parfait ! Tu es un génie !'
        : pct >= 70
        ? 'Excellent travail !'
        : pct >= 40
        ? 'Continue, tu progresses !'
        : 'Ne lâche pas, réessaie !';
    return (
      <div className="min-h-screen bg-blue-50 dark:bg-stone-900 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-8xl mb-4">{emoji}</div>
        <div className="text-7xl font-black text-blue-600">
          {finalScore}/{TOTAL}
        </div>
        <div className="text-2xl font-bold text-stone-700 dark:text-white mt-3">{msg}</div>
        {isRecord && (
          <div className="mt-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 font-bold rounded-xl px-5 py-2">
            🎉 Nouveau record !
          </div>
        )}
        <div className="mt-8 space-y-3 w-full max-w-xs">
          <button
            onClick={() => startGame(level)}
            className="w-full bg-blue-600 text-white rounded-2xl py-4 font-bold text-lg active:scale-95 transition-transform"
          >
            🔄 Rejouer (niveau {level})
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
          : 'bg-blue-50 dark:bg-stone-900'
      }`}
    >
      <div className="bg-gradient-to-br from-blue-500 to-blue-700 px-5 pt-10 pb-6 text-white">
        <div className="flex justify-between items-center mb-3">
          <span className="text-blue-200 text-sm font-medium">
            Question {idx + 1}/{TOTAL}
          </span>
          <span className="text-blue-200 text-sm font-medium">Score : {score} ✓</span>
        </div>
        <div className="w-full bg-blue-800 rounded-full h-2.5">
          <div
            className="bg-white rounded-full h-2.5 transition-all duration-300"
            style={{ width: `${(idx / TOTAL) * 100}%` }}
          />
        </div>
      </div>

      <div className="px-4 mt-8 flex flex-col items-center">
        <div className="bg-white dark:bg-stone-800 rounded-3xl shadow-md p-8 w-full text-center border-2 border-blue-100 dark:border-stone-600">
          <div className="text-5xl font-black text-stone-800 dark:text-white tracking-tight">
            {q.a} {q.op} {q.b} = ?
          </div>
          {feedback === 'correct' && (
            <div className="mt-4 text-green-500 text-3xl font-bold animate-pulse">
              ✓ Bravo !
            </div>
          )}
          {feedback === 'wrong' && (
            <div className="mt-4 text-red-500 text-2xl font-bold">
              ✗ Réponse : {q.answer}
            </div>
          )}
        </div>

        {!feedback && (
          <>
            <input
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="mt-6 text-4xl text-center font-bold w-full rounded-2xl border-2 border-blue-300 dark:border-stone-500 py-4 px-4 bg-white dark:bg-stone-800 dark:text-white focus:outline-none focus:border-blue-500"
              placeholder="?"
              autoFocus
              inputMode="numeric"
            />
            <button
              onClick={submit}
              disabled={!input.trim()}
              className="mt-4 w-full bg-blue-600 text-white rounded-2xl py-4 font-bold text-xl disabled:opacity-40 active:scale-95 transition-transform min-h-[56px]"
            >
              Valider ✓
            </button>
          </>
        )}
      </div>
    </div>
  );
}
