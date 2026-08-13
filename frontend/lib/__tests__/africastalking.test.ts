import { describe, it, expect, vi } from 'vitest';

// Mock the africastalking module before importing our module
vi.mock('africastalking', () => ({
  default: vi.fn(() => ({
    SMS: { send: vi.fn() },
  })),
}));

import { buildSmsOptions } from '../africastalking';

describe('buildSmsOptions', () => {
  it('construit les options avec le numero et le message tels quels', () => {
    const options = buildSmsOptions('+2250123456789', 'Votre code MargoPro : 123456');
    expect(options).toEqual({
      to: '+2250123456789',
      message: 'Votre code MargoPro : 123456',
    });
  });
});
