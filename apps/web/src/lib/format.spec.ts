import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber } from './format';

describe('format', () => {
  it('uses Western digits in Arabic', () => {
    const s = formatMoney('1234.5', 'EGP', 'ar');
    expect(s).toMatch(/1,234\.50/);
    expect(s).not.toMatch(/[٠-٩]/);
  });

  it('formats English money with two decimals', () => {
    expect(formatMoney('99', 'EGP', 'en')).toMatch(/99\.00/);
  });

  it('formats integers without decimals', () => {
    expect(formatNumber(12000, 'ar')).toBe('12,000');
  });
});
