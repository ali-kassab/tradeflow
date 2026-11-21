import { describe, expect, it } from 'vitest';
import { activityHref, defaultRange, isKnownAction, isOverLimit, isValidRange, marginPercent, metaValue, splitBalances, toReportTab } from './report-utils';

describe('report-utils', () => {
  it('defaults to the last 30 days including today', () => {
    expect(defaultRange(new Date(2026, 10, 21))).toEqual({ from: '2026-10-23', to: '2026-11-21' });
    expect(defaultRange(new Date(2026, 2, 1))).toEqual({ from: '2026-01-31', to: '2026-03-01' });
  });

  it('accepts only complete ranges with from ≤ to', () => {
    expect(isValidRange('2026-11-01', '2026-11-01')).toBe(true);
    expect(isValidRange('2026-11-02', '2026-11-01')).toBe(false);
    expect(isValidRange('', '2026-11-01')).toBe(false);
  });

  it('computes margin on net sales, null without sales', () => {
    expect(marginPercent('25.00', '100.00')).toBe(25);
    expect(marginPercent('0.00', '0.00')).toBeNull();
  });

  it('links activity entries to their source', () => {
    expect(activityHref({ entityType: 'salesOrder', entityId: 4 })).toBe('/sales-orders/4');
    expect(activityHref({ entityType: 'purchaseOrder', entityId: 3 })).toBe('/purchase-orders/3');
    expect(activityHref({ entityType: 'supplierPayment', entityId: 1 })).toBe('/supplier-payments');
    expect(activityHref({ entityType: 'product', entityId: 9 })).toBe('/inventory?productId=9');
    expect(activityHref({ entityType: 'unknown', entityId: 1 })).toBeUndefined();
  });

  it('reads metadata safely', () => {
    expect(metaValue({ number: 'SO-00001', quantity: -3 }, 'quantity')).toBe('-3');
    expect(metaValue({ nested: { a: 1 } }, 'nested')).toBeUndefined();
    expect(metaValue(null, 'number')).toBeUndefined();
    expect(isKnownAction('stock.adjusted')).toBe(true);
    expect(isKnownAction('user.deleted')).toBe(false);
  });
});

describe('balances and tabs', () => {
  it('sums owed and credit exactly', () => {
    expect(splitBalances([{ balance: '0.10' }, { balance: '0.20' }, { balance: '-5.05' }, { balance: '-0.01' }])).toEqual({
      owed: '0.30',
      credit: '5.06',
    });
    expect(splitBalances([])).toEqual({ owed: '0.00', credit: '0.00' });
  });

  it('flags balances above the credit limit only', () => {
    expect(isOverLimit('1000.01', '1000.00')).toBe(true);
    expect(isOverLimit('1000.00', '1000.00')).toBe(false);
    expect(isOverLimit('5000.00', null)).toBe(false);
    expect(isOverLimit('-10.00', '0.00')).toBe(false);
  });

  it('falls back to the sales tab', () => {
    expect(toReportTab('balances')).toBe('balances');
    expect(toReportTab('nope')).toBe('sales');
    expect(toReportTab(null)).toBe('sales');
  });
});
