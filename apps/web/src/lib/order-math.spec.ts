import { describe, expect, it } from 'vitest';
import { computeTotals, fromCents, toCents } from './order-math';

describe('toCents / fromCents', () => {
  it('parses amounts with up to two decimals', () => {
    expect(toCents('12')).toBe(1200n);
    expect(toCents('12.5')).toBe(1250n);
    expect(toCents(' 0.07 ')).toBe(7n);
    expect(toCents('1.234')).toBeNull();
    expect(toCents('-1')).toBeNull();
    expect(toCents('abc')).toBeNull();
    expect(fromCents(1250n)).toBe('12.50');
    expect(fromCents(-7n)).toBe('-0.07');
  });
});

describe('computeTotals (mirrors the API)', () => {
  it('computes subtotal, discount, tax and total', () => {
    const t = computeTotals({
      lines: [
        { quantity: 3, unitPrice: '175.00' },
        { quantity: 2, unitPrice: '42.50' },
      ],
      discount: '25',
      taxRate: '14',
    })!;
    expect(t.lineTotals).toEqual(['525.00', '85.00']);
    expect(t.subtotal).toBe('610.00');
    expect(t.taxAmount).toBe('81.90'); // (610 − 25) × 14% = 81.90
    expect(t.total).toBe('666.90');
    expect(t.discountTooLarge).toBe(false);
  });

  it('rounds tax half-up to the cent', () => {
    // 0.25 × 14% = 0.035 → 0.04 (half-up), as Decimal.ROUND_HALF_UP on the server
    expect(computeTotals({ lines: [{ quantity: 1, unitPrice: '0.25' }], discount: '0', taxRate: '14' })!.taxAmount).toBe('0.04');
    // 0.24 × 14% = 0.0336 → 0.03
    expect(computeTotals({ lines: [{ quantity: 1, unitPrice: '0.24' }], discount: '0', taxRate: '14' })!.taxAmount).toBe('0.03');
  });

  it('handles fractional VAT rates and an empty discount', () => {
    const t = computeTotals({ lines: [{ quantity: 4, unitPrice: '99.99' }], discount: '', taxRate: '12.5' })!;
    expect(t.subtotal).toBe('399.96');
    expect(t.taxAmount).toBe('50.00'); // 49.995 → 50.00
    expect(t.total).toBe('449.96');
  });

  it('flags a discount larger than the subtotal and rejects invalid input', () => {
    expect(computeTotals({ lines: [{ quantity: 1, unitPrice: '10' }], discount: '11', taxRate: '0' })!.discountTooLarge).toBe(true);
    expect(computeTotals({ lines: [{ quantity: 1, unitPrice: '1.001' }], discount: '0', taxRate: '0' })).toBeNull();
    expect(computeTotals({ lines: [{ quantity: 0, unitPrice: '1' }], discount: '0', taxRate: '0' })).toBeNull();
  });
});
