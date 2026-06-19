'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';

const COULEURS = [
  { id: 'rouge', bg: 'bg-red-500', flash: 'bg-red-300', emoji: '🔴' },
  { id: 'bleu', bg: 'bg-blue-500', flash: 'bg-blue-300', emoji: '🔵' },
  { id: 'vert', bg: 'bg-emerald-500', flash: 'bg-emerald-300', emoji: '🟢' },
  { id: 'jaune', bg: 'bg-yellow-400', flash: 'bg-yellow-200', emoji: '🟡' },
  { id: 'violet', bg: 'bg-purple-500', flash: 'bg-purple-300', emoji: '🟣' },
  { id: 'orange', bg: 'bg-orange-500', flash: 'bg-orange-300', emoji: '🟠' },
];

type Phase = 'menu' | 'show' | 'input' | 'wrong' | 'levelup' | 'result';

function saveScore(key: string, value: number): boolean {
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
    return stored ? (JSON.parse(stored)['memoire'] ?? 0) : 0;
  } catch {
    return 0;
  }
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export default function MemoirePage() {
  const [phase, setPhase] = useState<Phase>('menu');
  const [sequence, setSequence] = useState<string[]>([]);
  const [userSeq, setUserSeq] = useState<string[]>([]);
  const [activeColor, setActiveColor] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [bestLevel, setBestLevel] = useState(0);
  const [isRecord, setIsRecord] = useState(false);
  const cancelRef = useRef(false);

  useEffect(() => {
    setBestLevel(loadScore('memoire'));
  }, []);

  const showSequence = useCallback(async (seq: string[]) => {
    cancelRef.current = false;
    setPhase('show');
    setUserSeq([]);
    await delay(800);
    for (const color of seq) {
      if (cancelRef.current) return;
      setActiveColor(color);
      await delay(550);
      if (cancelRef.current) return;
      setActiveColor(null);
      await delay(300);
    }
    if (!cancelRef.current) setPhase('input');
  }, []);

  const startGame = useCallback(() => {
    cancelRef.current = true;
    const firstSeq = [COULEURS[Math.floor(Math.random() * COULEURS.length)].id];
    setLives(3);
    setLevel(1);
    setSequence(firstSeq);
    setIsRecord(false);
    setTimeout(() => showSequence(firstSeq), 100);
  }, [showSequence]);

  const handleColorClick = useCallback(
    (colorId: string) => {
      if (phase !== 'input') return;
      const newUserSeq = [...userSeq, colorId];
      setUserSeq(newUserSeq);
      const pos = newUserSeq.length - 1;

      if (newUserSeq[pos] !== sequence[pos]) {
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives <= 0) {
          const record = saveScore('memoire', level);
          if (record) setBestLevel(level);
          setIsRecord(record);
          setPhase('result');
        } else {
          setPhase('wrong');
          setTimeout(() => showSequence(sequence), 1800);
        }
        return;
      }

      if (newUserSeq.length === sequence.length) {
        const nextLevel = level + 1;
        setLevel(nextLevel);
        setPhase('levelup');
        const nextSeq = [
          ...sequence,
          COULEURS[Math.floor(Math.random() * COULEURS.length)].id,
        ];
        setSequence(nextSeq);
        setTimeout(() => showSequence(nextSeq), 1200);
      }
    },
    [phase, userSeq, sequence, lives, level, showSequence]
  );

  const colorGrid = (
    <div className="grid grid-cols-3 gap-4 mt-8 px-4">
      {COULEURS.map((c) => (
        <button
          key={c.id}
          onClick={() => handleColorClick(c.id)}
          disabled={phase !== 'input'}
          className={`h-24 rounded-2xl text-4xl flex items-center justify-center transition-all shadow-lg
            ${activeColor === c.id ? c.flash : c.bg}
            ${phase !== 'input' ? 'opacity-50 cursor-default' : 'active:scale-90'}
          `}
        >
          {c.emoji}
        </button>
      ))}
    </div>
  );

  if (phase === 'menu') {
    return (
      <div className="min-h-screen bg-orange-50 dark:bg-stone-900">
        <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white px-5 pt-10 pb-8">
          <Link href="/cerveau" className="text-orange-200 text-sm mb-4 block">
            ← Retour
          </Link>
          <div className="text-5xl mb-2">🧠</div>
          <h1 className="text-3xl font-black">Mémoire</h1>
          <p className="text-orange-200 mt-1">Retiens la séquence de couleurs</p>
        </div>

        <div className="px-4 mt-5 pb-8">
          {bestLevel > 0 && (
            <div className="bg-orange-100 dark:bg-orange-950 rounded-xl p-3 text-center mb-4">
              <span className="text-orange-700 dark:text-orange-300 font-bold">
                ⭐ Ton record : niveau {bestLevel}
              </span>
            </div>
          )}
          <div className="bg-white dark:bg-stone-800 rounded-2xl p-5 border-2 border-orange-100 dark:border-stone-600 mb-5">
            <h2 className="font-bold text-lg mb-3 text-stone-800 dark:text-white">
              Comment jouer :
            </h2>
            <ul className="space-y-2 text-stone-600 dark:text-stone-300">
              <li>👀 Regarde la séquence de couleurs</li>
              <li>🤔 Mémorise-la dans l'ordre</li>
              <li>👆 Reproduis-la en tapant les boutons</li>
              <li>📈 Chaque niveau ajoute une couleur</li>
              <li>❤️ Tu as 3 vies</li>
            </ul>
          </div>
          <button
            onClick={startGame}
            className="w-full bg-orange-600 text-white rounded-2xl py-4 font-bold text-xl active:scale-95 transition-transform min-h-[56px]"
          >
            🚀 Commencer !
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'result') {
    return (
      <div className="min-h-screen bg-orange-50 dark:bg-stone-900 flex flex-col items-center justify-center px-4 text-center">
        <div className="text-8xl mb-4">{level > 8 ? '🏆' : level > 5 ? '🌟' : '💪'}</div>
        <div className="text-6xl font-black text-orange-600">Niveau {level}</div>
        <div className="text-2xl font-bold text-stone-700 dark:text-white mt-3">
          {level > 8
            ? 'Mémoire extraordinaire !'
            : level > 5
            ? 'Super mémoire !'
            : level > 3
            ? 'Bien joué !'
            : 'Continue à t\'entraîner !'}
        </div>
        {isRecord && level > 1 && (
          <div className="mt-3 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 font-bold rounded-xl px-5 py-2">
            🎉 Nouveau record !
          </div>
        )}
        <div className="mt-8 space-y-3 w-full max-w-xs">
          <button
            onClick={startGame}
            className="w-full bg-orange-600 text-white rounded-2xl py-4 font-bold text-lg active:scale-95 transition-transform"
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

  return (
    <div className="min-h-screen bg-orange-50 dark:bg-stone-900">
      <div className="bg-gradient-to-br from-orange-500 to-orange-700 px-5 pt-10 pb-6 text-white">
        <div className="flex justify-between items-center">
          <span className="font-black text-xl">Niveau {level}</span>
          <span className="text-xl">
            {'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}
          </span>
        </div>
        <div className="mt-3 text-center font-semibold text-lg text-orange-200 min-h-[28px]">
          {phase === 'show' && '👀 Regarde bien...'}
          {phase === 'input' && `👆 À toi ! (${userSeq.length}/${sequence.length})`}
          {phase === 'wrong' && '❌ Raté ! Regarde à nouveau...'}
          {phase === 'levelup' && '🎉 Niveau suivant !'}
        </div>
      </div>
      {colorGrid}
    </div>
  );
}
