'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { checkAndRegisterDevice } from '@/lib/deviceSession';

export function DeviceSessionStarter() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function run() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!active || !data.user) return;

      try {
        const result = await checkAndRegisterDevice(supabase, data.user.id);
        if (active && result === 'blocked') {
          sessionStorage.setItem('margo_bloque', '1');
          await supabase.auth.signOut();
          router.replace('/auth');
        }
      } catch {
        // Réseau absent ou Supabase indisponible : ne pas bloquer le démarrage.
      }
    }

    run();
    return () => { active = false; };
  }, [router]);

  return null;
}
