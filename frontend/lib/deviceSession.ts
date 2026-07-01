'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'margo_device_id';

export function parseDeviceName(ua: string): string {
  let browser = 'Navigateur';
  if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';

  let platform = 'Appareil';
  if (/iPhone/.test(ua)) platform = 'iPhone';
  else if (/iPad/.test(ua)) platform = 'iPad';
  else if (/Android/.test(ua) && /Mobile/.test(ua)) platform = 'Android';
  else if (/Android/.test(ua)) platform = 'Tablette Android';
  else if (/Windows/.test(ua)) platform = 'Windows';
  else if (/Macintosh/.test(ua)) platform = 'Mac';
  else if (/Linux/.test(ua)) platform = 'Linux';

  return `${platform} · ${browser}`;
}

export function getDeviceName(): string {
  return parseDeviceName(navigator.userAgent);
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export type DeviceSession = {
  id: string;
  device_id: string;
  device_name: string;
  last_seen_at: string;
  is_blocked: boolean;
};

export async function checkAndRegisterDevice(
  supabase: SupabaseClient,
  userId: string,
): Promise<'ok' | 'blocked'> {
  const deviceId = getOrCreateDeviceId();

  const { data } = await supabase
    .from('device_sessions')
    .select('is_blocked')
    .eq('user_id', userId)
    .eq('device_id', deviceId)
    .maybeSingle();

  if (data?.is_blocked === true) return 'blocked';

  await supabase
    .from('device_sessions')
    .upsert(
      {
        user_id: userId,
        device_id: deviceId,
        device_name: getDeviceName(),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_id' },
    );

  return 'ok';
}

export async function fetchDevices(
  supabase: SupabaseClient,
  userId: string,
): Promise<DeviceSession[]> {
  const { data, error } = await supabase
    .from('device_sessions')
    .select('id, device_id, device_name, last_seen_at, is_blocked')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DeviceSession[];
}

export async function blockDevice(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('device_sessions')
    .update({ is_blocked: true })
    .eq('id', sessionId);
  if (error) throw error;
}

export async function unblockDevice(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('device_sessions')
    .update({ is_blocked: false })
    .eq('id', sessionId);
  if (error) throw error;
}
