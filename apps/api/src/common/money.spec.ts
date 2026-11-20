import { computeOrderTotals, money } from './money.js';

describe('computeOrderTotals', () => {
  it('computes subtotal, discount, VAT and total with 2-dp rounding', () => {
    const t = computeOrderTotals({
      lines: [
        { quantity: 3, unitPrice: '19.99' },
        { quantity: 10, unitPrice: '7.5' },
      ],
      discount: '5',
      taxRate: '14',
    });
    expect(t.lineTotals.map((l) => l.toFixed(2))).toEqual(['59.97', '75.00']);
    expect(t.subtotal.toFixed(2)).toBe('134.97');
    expect(t.discount.toFixed(2)).toBe('5.00');
    // (134.97 - 5) * 14% = 18.1958 -> 18.20
    expect(t.taxAmount.toFixed(2)).toBe('18.20');
    expect(t.total.toFixed(2)).toBe('148.17');
  });

  it('avoids binary floating point errors', () => {
    const t = computeOrderTotals({
      lines: [{ quantity: 3, unitPrice: '0.1' }],
      discount: 0,
      taxRate: 0,
    });
    expect(t.total.toFixed(2)).toBe('0.30');
  });

  it('handles zero tax and zero discount', () => {
    const t = computeOrderTotals({ lines: [{ quantity: 1, unitPrice: 100 }], discount: 0, taxRate: 0 });
    expect(t.total.toFixed(2)).toBe('100.00');
    expect(t.taxAmount.toFixed(2)).toBe('0.00');
  });

  it('rounds half up', () => {
    expect(money('2.345').toFixed(2)).toBe('2.35');
    expect(money('2.344').toFixed(2)).toBe('2.34');
  });
});
