'use client';

import { useState, useEffect, useCallback } from 'react';
import { useColors } from '@/lib/hooks/useColors';
import { createClient } from '@/lib/supabase/client';
import {
  fetchDevices,
  blockDevice,
  unblockDevice,
  getOrCreateDeviceId,
  type DeviceSession,
} from '@/lib/deviceSession';

function tempsRelatif(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  return `il y a ${j} j`;
}

function iconeAppareil(deviceName: string): string {
  if (/iPhone|iPad|Android|Tablette/.test(deviceName)) return '📱';
  return '💻';
}

export function Appareils() {
  const T = useColors();
  const [devices, setDevices] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [currentDeviceId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return getOrCreateDeviceId();
  });

  const loadDevices = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const list = await fetchDevices(supabase, data.user.id);
      setDevices(list);
      setError(null);
    } catch {
      setError('Impossible de charger les appareils. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDevices(); }, [loadDevices]);

  async function handleBlock(session: DeviceSession) {
    setConfirmingId(null);
    setActionId(session.id);
    try {
      const supabase = createClient();
      await blockDevice(supabase, session.id);
      setDevices(d => d.map(s => s.id === session.id ? { ...s, is_blocked: true } : s));
    } catch {
      setError('Erreur lors du blocage. Réessayez.');
    } finally {
      setActionId(null);
    }
  }

  async function handleUnblock(session: DeviceSession) {
    setActionId(session.id);
    try {
      const supabase = createClient();
      await unblockDevice(supabase, session.id);
      setDevices(d => d.map(s => s.id === session.id ? { ...s, is_blocked: false } : s));
    } catch {
      setError('Erreur lors du déblocage. Réessayez.');
    } finally {
      setActionId(null);
    }
  }

  return (
    <div style={{ margin: '0 16px 12px' }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: T.textMuted,
        marginBottom: 6, paddingLeft: 4,
        fontFamily: 'Manrope, sans-serif',
        textTransform: 'uppercase', letterSpacing: '0.5px',
      }}>
        Appareils connectés
      </div>
      <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.shadow, overflow: 'hidden' }}>

        {loading && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: T.textMuted, fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>
            Chargement…
          </div>
        )}

        {error && (
          <div style={{ padding: '12px 16px', color: T.red, fontSize: 13, fontFamily: 'Manrope, sans-serif', background: T.redBg }}>
            {error}
          </div>
        )}

        {!loading && !error && devices.length === 0 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: T.textMuted, fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>
            Aucun appareil enregistré.
          </div>
        )}

        {devices.map((session, idx) => {
          const isCurrent = session.device_id === currentDeviceId;
          const isLast = idx === devices.length - 1;
          const isConfirming = confirmingId === session.id;

          return (
            <div
              key={session.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: isLast ? 'none' : `1px solid ${T.border}`,
                background: T.surface,
              }}
            >
              <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>
                {iconeAppareil(session.device_name)}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: T.text, fontFamily: 'Manrope, sans-serif' }}>
                    {session.device_name}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: T.accent,
                      background: T.accentLight, borderRadius: 20,
                      padding: '2px 8px', flexShrink: 0, fontFamily: 'Manrope, sans-serif',
                    }}>
                      Cet appareil
                    </span>
                  )}
                  {session.is_blocked && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: T.red,
                      background: T.redBg, borderRadius: 20,
                      padding: '2px 8px', flexShrink: 0, fontFamily: 'Manrope, sans-serif',
                    }}>
                      Bloqué
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2, fontFamily: 'Manrope, sans-serif' }}>
                  {tempsRelatif(session.last_seen_at)}
                </div>
              </div>

              {!isCurrent && (
                <>
                  {isConfirming ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => setConfirmingId(null)}
                        style={{
                          padding: '6px 10px', borderRadius: 10, height: 34,
                          border: `1.5px solid ${T.border}`, background: T.bg,
                          color: T.textMuted, fontSize: 12, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        Annuler
                      </button>
                      <button
                        onClick={() => handleBlock(session)}
                        disabled={actionId === session.id}
                        style={{
                          padding: '6px 12px', borderRadius: 10, height: 34,
                          border: `1.5px solid ${T.red}`, background: T.redBg,
                          color: T.red, fontSize: 12, fontWeight: 700,
                          cursor: 'pointer', opacity: actionId === session.id ? 0.5 : 1,
                          fontFamily: 'Manrope, sans-serif',
                        }}
                      >
                        Confirmer
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (session.is_blocked) handleUnblock(session);
                        else setConfirmingId(session.id);
                      }}
                      disabled={actionId === session.id}
                      style={{
                        padding: '6px 14px', borderRadius: 10, height: 34, flexShrink: 0,
                        border: `1.5px solid ${session.is_blocked ? T.green : T.red}`,
                        background: session.is_blocked ? T.greenBg : T.redBg,
                        color: session.is_blocked ? T.green : T.red,
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        opacity: actionId === session.id ? 0.5 : 1,
                        fontFamily: 'Manrope, sans-serif',
                      }}
                    >
                      {actionId === session.id ? '…' : session.is_blocked ? 'Débloquer' : 'Bloquer'}
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
