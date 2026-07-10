'use client';

const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function suffixeAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  return Array.from(octets, o => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
}

export function generateAffiliateCode(nom: string): string {
  const lettres = nom
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const prefixe = (lettres.slice(0, 3) || 'MGP').padEnd(3, 'X');
  return `${prefixe}-${suffixeAleatoire(4)}`;
}
