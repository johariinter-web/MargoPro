'use client';

import { useEffect, useState } from 'react';

export interface Colors {
  accent: string; accentLight: string;
  green: string; greenBg: string;
  red: string; redBg: string;
  amber: string; amberBg: string;
  blue: string; blueBg: string;
  purple: string; purpleBg: string;
  bg: string; bgSubtle: string; surface: string;
  text: string; textSub: string; textMuted: string;
  border: string;
  shadow: string;
}

export const LIGHT: Colors = {
  accent: '#D4601A', accentLight: '#FEF0E6',
  green: '#2E7D46', greenBg: '#EAF5EE',
  red: '#C4341A', redBg: '#FDECEA',
  amber: '#C47A06', amberBg: '#FEF3D8',
  blue: '#1A6BC4', blueBg: '#E6F0FE',
  purple: '#7C3EC4', purpleBg: '#F2EBFD',
  bg: '#FAF7F3', bgSubtle: '#F3EDE5', surface: '#FFFFFF',
  text: '#1C1811', textSub: '#6A5D52', textMuted: '#9E8E84',
  border: '#E6DDD3',
  shadow: '0 1px 3px rgba(28,24,17,0.06), 0 4px 14px rgba(28,24,17,0.05)',
};

export const DARK: Colors = {
  accent: '#E87840', accentLight: '#2D1A0E',
  green: '#4DC97A', greenBg: '#0D2018',
  red: '#E06050', redBg: '#2A1010',
  amber: '#E0A830', amberBg: '#241A08',
  blue: '#5098F0', blueBg: '#0A1C38',
  purple: '#A870E8', purpleBg: '#1A1030',
  bg: '#141210', bgSubtle: '#1C1916', surface: '#211E18',
  text: '#F4EEE4', textSub: '#B0A090', textMuted: '#7A6D62',
  border: '#2E2824',
  shadow: '0 1px 3px rgba(0,0,0,0.4), 0 4px 14px rgba(0,0,0,0.3)',
};

export function setDarkMode(dark: boolean) {
  localStorage.setItem('margopro-theme', dark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', dark);
  window.dispatchEvent(new Event('margopro-theme-change'));
}

export function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('margopro-theme') === 'dark';
}

export function useColors(): Colors {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDarkMode());
    const handler = () => setDark(isDarkMode());
    window.addEventListener('margopro-theme-change', handler);
    return () => window.removeEventListener('margopro-theme-change', handler);
  }, []);

  return dark ? DARK : LIGHT;
}
