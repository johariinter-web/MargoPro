import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

export async function POST() {
  const service = createServiceClient();
  await service.from('simulateur_visites').insert({});
  return NextResponse.json({ ok: true });
}
