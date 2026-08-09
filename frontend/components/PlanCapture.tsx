'use client';

import { useEffect } from 'react';
import { storePlanPromis } from '@/lib/planPromis';

export function PlanCapture() {
  useEffect(() => {
    storePlanPromis();
  }, []);

  return null;
}
