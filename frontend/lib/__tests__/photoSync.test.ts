import { describe, test, expect } from 'vitest';
import { cheminPhoto, peutSyncerPhotos } from '../photoSync';

describe('cheminPhoto', () => {
  test('construit le chemin userId/produitId/version.jpg', () => {
    expect(cheminPhoto('user1', 'prod1', 1234)).toBe('user1/prod1/1234.jpg');
  });

  test('préserve les valeurs exactes (tirets, chiffres)', () => {
    expect(cheminPhoto('abc-123', 'xyz-456', 0)).toBe('abc-123/xyz-456/0.jpg');
  });
});

describe('peutSyncerPhotos', () => {
  test('retourne true en bêta', () => {
    expect(peutSyncerPhotos()).toBe(true);
  });
});
