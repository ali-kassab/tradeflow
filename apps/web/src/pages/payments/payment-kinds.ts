import { api } from '@/lib/api';
import type { CustomerPaymentListItem, Paginated, PaymentStatus, SupplierPaymentListItem } from '@/lib/types';

/**
 * Customer and supplier payments share one UI (list, record and void dialogs). Everything
 * that differs between them — endpoints, the billed order statuses, the caches to refresh —
 * lives here, mirroring the payments module in apps/api.
 */
export type PartyKind = 'customer' | 'supplier';

/** What the record dialog needs about a party; full Customer/Supplier rows satisfy it. */
export interface PickedParty {
  id: number;
  name: string;
  phone: string | null;
  /** Customer: what they owe you. Supplier: what you owe them. */
  balance?: string;
}

/** An order the payment can be applied to: billed, with money still outstanding. */
export interface PayableOrder {
  id: number;
  number: string;
  outstanding: string;
}

/** A payment row in the shape the shared list renders. */
export interface PaymentRow {
  id: number;
  amount: string;
  method: CustomerPaymentListItem['method'];
  paidAt: string;
  reference: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  party: { id: number; name: string };
  order: { id: number; number: string } | null;
}

interface KindConfig {
  /** Payments endpoint (list, record, `/:id/void`). */
  endpoint: string;
  /** The payments list page, filtered with `?{partyParam}=`. */
  listPath: string;
  /** Party detail pages (`/customers/:id`, `/suppliers/:id`) and API. */
  partyPath: string;
  /** Order detail pages and API. */
  orderPath: string;
  /** Query-string name used by the list pages to filter by party. */
  partyParam: 'customerId' | 'supplierId';
  /** Request body field naming the order. */
  orderField: 'salesOrderId' | 'purchaseOrderId';
  /** Order statuses that count toward the balance (payable). */
  billed: readonly string[];
  /** Query-cache roots a payment changes. */
  invalidate: readonly string[];
}

export const KINDS: Record<PartyKind, KindConfig> = {
  customer: {
    endpoint: '/payments/customer',
    listPath: '/payments',
    partyPath: '/customers',
    orderPath: '/sales-orders',
    partyParam: 'customerId',
    orderField: 'salesOrderId',
    billed: ['CONFIRMED', 'DELIVERED'],
    invalidate: ['payments', 'customers', 'sales-orders', 'dashboard'],
  },
  supplier: {
    endpoint: '/payments/supplier',
    listPath: '/supplier-payments',
    partyPath: '/suppliers',
    orderPath: '/purchase-orders',
    partyParam: 'supplierId',
    orderField: 'purchaseOrderId',
    billed: ['RECEIVED'],
    invalidate: ['payments', 'suppliers', 'purchase-orders', 'dashboard'],
  },
};

interface OrderRow {
  id: number;
  number: string;
  orderDate: string;
  outstanding: string;
  paymentStatus: PaymentStatus;
}

/** Billed orders of one party that still have money outstanding, oldest first (up to 100 per status). */
export async function fetchPayableOrders(kind: PartyKind, partyId: number): Promise<PayableOrder[]> {
  const k = KINDS[kind];
  const pages = await Promise.all(
    k.billed.map(
      async (status) =>
        (await api.get<Paginated<OrderRow>>(k.orderPath, { params: { [k.partyParam]: partyId, status, pageSize: 100 } })).data.data,
    ),
  );
  return pages
    .flat()
    .filter((o) => Number(o.outstanding) > 0)
    .toSorted((a, b) => a.orderDate.localeCompare(b.orderDate) || a.id - b.id)
    .map((o) => ({ id: o.id, number: o.number, outstanding: o.outstanding }));
}

/** Normalises either payment list row into the shared shape. */
export function toPaymentRow(p: CustomerPaymentListItem | SupplierPaymentListItem): PaymentRow {
  const { id, amount, method, paidAt, reference, voidedAt, voidReason } = p;
  const isCustomer = 'customer' in p;
  return {
    id,
    amount,
    method,
    paidAt,
    reference,
    voidedAt,
    voidReason,
    party: isCustomer ? p.customer : p.supplier,
    order: isCustomer ? p.salesOrder : p.purchaseOrder,
  };
}
