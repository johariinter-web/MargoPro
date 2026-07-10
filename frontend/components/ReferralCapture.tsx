'use client';

import { useEffect } from 'react';
import { storeReferralCode } from '@/lib/parrainage';

export function ReferralCapture() {
  useEffect(() => {
    storeReferralCode();
  }, []);

  return null;
}
