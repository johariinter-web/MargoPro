'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/', label: 'Accueil', icon: '🏠' },
  { href: '/stock', label: 'Stock', icon: '📦' },
  { href: '/ventes', label: 'Ventes', icon: '📊' },
  { href: '/marges', label: 'Marges', icon: '💰' },
  { href: '/parametres', label: 'Réglages', icon: '⚙️' },
];

export default function BottomNav() {
  const pathname = usePathname();

  if (pathname === '/onboarding' || pathname === '/auth' || pathname === '/alertes') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-stone-800 border-t border-stone-200 dark:border-stone-700 z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center min-h-[64px] gap-1 text-xs font-medium transition-colors ${
                isActive
                  ? 'text-emerald dark:text-emerald-light'
                  : 'text-stone-600 dark:text-stone-400'
              }`}
            >
              <span className="text-2xl leading-none">{tab.icon}</span>
              <span className={isActive ? 'font-bold' : ''}>{tab.label}</span>
              {isActive && (
                <span className="absolute bottom-0 h-0.5 w-12 bg-emerald rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
