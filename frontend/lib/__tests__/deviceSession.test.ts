import { describe, it, expect } from 'vitest';
import { parseDeviceName } from '../deviceSession';

describe('parseDeviceName', () => {
  it('identifie iPhone Safari', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
    expect(parseDeviceName(ua)).toBe('iPhone · Safari');
  });

  it('identifie Android Chrome', () => {
    const ua = 'Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';
    expect(parseDeviceName(ua)).toBe('Android · Chrome');
  });

  it('identifie Windows Chrome', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36';
    expect(parseDeviceName(ua)).toBe('Windows · Chrome');
  });

  it('identifie Mac Firefox', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/115.0';
    expect(parseDeviceName(ua)).toBe('Mac · Firefox');
  });

  it('retourne fallback pour UA inconnu', () => {
    expect(parseDeviceName('')).toBe('Appareil · Navigateur');
  });
});
