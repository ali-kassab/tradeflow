import { describe, expect, it } from 'vitest';
import { isOverLimit, priceDifference } from './credit';

describe('isOverLimit', () => {
  it('warns only when the balance is above a set limit', () => {
    expect(isOverLimit({ balance: '1000.01', creditLimit: '1000.00' })).toBe(true);
    expect(isOverLimit({ balance: '1000.00', creditLimit: '1000.00' })).toBe(false);
    expect(isOverLimit({ balance: '5000.00', creditLimit: null })).toBe(false);
    expect(isOverLimit({ balance: '-20.00', creditLimit: '0.00' })).toBe(false);
    expect(isOverLimit({ balance: '0.01', creditLimit: '0.00' })).toBe(true);
  });
});

describe('priceDifference', () => {
  it('returns the signed percentage against the standard price', () => {
    expect(priceDifference(90, 100)).toBeCloseTo(-10);
    expect(priceDifference(110, 100)).toBeCloseTo(10);
    expect(priceDifference(5, 0)).toBeNull();
  });
});
