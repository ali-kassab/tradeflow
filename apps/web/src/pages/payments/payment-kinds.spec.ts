import { describe, expect, it } from 'vitest';
import type { CustomerPaymentListItem, SupplierPaymentListItem } from '@/lib/types';
import { KINDS, toPaymentRow } from './payment-kinds';

const base = {
  id: 7,
  amount: '100.00',
  method: 'CASH' as const,
  paidAt: '2026-11-20T10:00:00.000Z',
  reference: 'R-1',
  notes: null,
  voidedAt: null,
  voidReason: null,
};

describe('toPaymentRow', () => {
  it('maps a customer payment to party + sales order', () => {
    const p: CustomerPaymentListItem = {
      ...base,
      customerId: 2,
      salesOrderId: 9,
      customer: { id: 2, name: 'C' },
      salesOrder: { id: 9, number: 'SO-00009' },
    };
    expect(toPaymentRow(p)).toMatchObject({ id: 7, party: { id: 2, name: 'C' }, order: { id: 9, number: 'SO-00009' } });
  });

  it('maps a supplier payment to party + purchase order (or on account)', () => {
    const p: SupplierPaymentListItem = {
      ...base,
      supplierId: 1,
      purchaseOrderId: null,
      supplier: { id: 1, name: 'S' },
      purchaseOrder: null,
    };
    expect(toPaymentRow(p)).toMatchObject({ party: { id: 1, name: 'S' }, order: null });
  });
});

describe('KINDS', () => {
  it('bills the same order statuses as the API balance rules', () => {
    expect(KINDS.customer.billed).toEqual(['CONFIRMED', 'DELIVERED']);
    expect(KINDS.supplier.billed).toEqual(['RECEIVED']);
  });
});
