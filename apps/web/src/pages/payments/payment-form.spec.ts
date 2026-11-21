import { describe, expect, it } from 'vitest';
import { checkAmount, paidAtForApi } from './payment-form';

describe('checkAmount', () => {
  it('rejects malformed and zero amounts', () => {
    expect(checkAmount('')).toBe('invalid');
    expect(checkAmount('1.234')).toBe('invalid');
    expect(checkAmount('-5')).toBe('invalid');
    expect(checkAmount('0.00')).toBe('zero');
    expect(checkAmount('12.5')).toBe('ok');
  });

  it('compares against the outstanding amount to the cent', () => {
    expect(checkAmount('100.00', '100.00')).toBe('ok');
    expect(checkAmount('100.01', '100.00')).toBe('exceeds');
    expect(checkAmount('99.99', '100')).toBe('ok');
  });
});

describe('paidAtForApi', () => {
  it('omits today so the server records the exact time', () => {
    expect(paidAtForApi('2026-11-20', '2026-11-20')).toBeUndefined();
  });

  it('sends an earlier day as local noon', () => {
    const iso = paidAtForApi('2026-11-01', '2026-11-20')!;
    const d = new Date(iso);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(12);
  });
});
