'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useColors } from '@/lib/hooks/useColors';

const HIDDEN_PATHS = ['/onboarding', '/auth', '/alertes', '/parametres', '/abonnement', '/sauvegarde', '/aide'];

const tabs = [
  {
    href: '/',
    label: 'Accueil',
    icon: (color: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
        <path d="M9 21V12h6v9" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/marges',
    label: 'Marge',
    icon: (color: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 3v18h18" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
        <path d="M7 14l4-5 4 3.5 4-6" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/stock',
    label: 'Stock',
    icon: (color: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" stroke={color} strokeWidth="1.75" strokeLinejoin="round"/>
        <path d="M12 3v18M3 8l9 5 9-5" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: '/ventes',
    label: 'Ventes',
    icon: (color: string) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="1.75"/>
        <path d="M8 7h8M8 11h8M8 15h5" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function BottomNav() {
  const T = useColors();
  const pathname = usePathname();
  const router = useRouter();

  if (HIDDEN_PATHS.some(p => pathname.startsWith(p))) return null;

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: 480,
      background: T.surface,
      borderTop: `1px solid ${T.border}`,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', height: 72, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          const color = isActive ? T.accent : T.textMuted;
          return (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  width: 36,
                  height: 3,
                  borderRadius: '0 0 3px 3px',
                  background: T.accent,
                }} />
              )}
              {tab.icon(color)}
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color,
                fontFamily: 'Manrope, sans-serif',
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
