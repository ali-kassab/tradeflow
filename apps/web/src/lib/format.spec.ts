import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, formatPercent } from './format';

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

  it('formats signed percentages with Western digits', () => {
    expect(formatPercent(-10, 'en')).toBe('-10%');
    expect(formatPercent(5.56, 'en')).toBe('+5.6%');
    expect(formatPercent(0, 'en')).toBe('0%');
    expect(formatPercent(12.5, 'ar')).not.toMatch(/[٠-٩]/);
  });
});
