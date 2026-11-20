import { Injectable } from '@nestjs/common';
import {
  type Prisma,
  PurchaseOrderStatus,
  SalesOrderStatus,
} from '../../generated/prisma/client.js';

type Decimal = Prisma.Decimal;
import { dec, money } from '../../common/money.js';
import type { Db } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/** Sales orders that create a receivable. DRAFT and CANCELLED never do. */
export const BILLED_SALES = [SalesOrderStatus.CONFIRMED, SalesOrderStatus.DELIVERED];

export type StatementEntryType =
  | 'ORDER_CONFIRMED'
  | 'ORDER_CANCELLED'
  | 'PURCHASE_RECEIVED'
  | 'PAYMENT'
  | 'PAYMENT_VOIDED';

export interface StatementEntry {
  date: Date;
  type: StatementEntryType;
  reference: string;
  refId: number;
  /** Increases what the party owes us (customer) / what we owe them (supplier). */
  debit: string;
  /** Decreases the balance. */
  credit: string;
  balance: string;
}

/**
 * Balance rules (the single place they are defined):
 *
 *   customer balance = Σ total of CONFIRMED/DELIVERED sales orders
 *                    − Σ amount of non-voided customer payments
 *   supplier balance = Σ total of RECEIVED purchase orders
 *                    − Σ amount of non-voided supplier payments
 *
 * Cancelling a confirmed order removes it from the first sum while its payments
 * stay in the second, so the money becomes customer credit (negative balance)
 * automatically. Voided payments are excluded everywhere.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async customerBalances(tenantId: number, customerIds?: number[], db: Db = this.prisma) {
    const idFilter = customerIds ? { customerId: { in: customerIds } } : {};
    const [billed, paid] = await Promise.all([
      db.salesOrder.groupBy({
        by: ['customerId'],
        where: { tenantId, status: { in: BILLED_SALES }, ...idFilter },
        _sum: { total: true },
      }),
      db.customerPayment.groupBy({
        by: ['customerId'],
        where: { tenantId, voidedAt: null, ...idFilter },
        _sum: { amount: true },
      }),
    ]);
    return combine(
      billed.map((r) => [r.customerId, r._sum.total]),
      paid.map((r) => [r.customerId, r._sum.amount]),
    );
  }

  async supplierBalances(tenantId: number, supplierIds?: number[], db: Db = this.prisma) {
    const idFilter = supplierIds ? { supplierId: { in: supplierIds } } : {};
    const [billed, paid] = await Promise.all([
      db.purchaseOrder.groupBy({
        by: ['supplierId'],
        where: { tenantId, status: PurchaseOrderStatus.RECEIVED, ...idFilter },
        _sum: { total: true },
      }),
      db.supplierPayment.groupBy({
        by: ['supplierId'],
        where: { tenantId, voidedAt: null, ...idFilter },
        _sum: { amount: true },
      }),
    ]);
    return combine(
      billed.map((r) => [r.supplierId, r._sum.total]),
      paid.map((r) => [r.supplierId, r._sum.amount]),
    );
  }

  async customerStatement(tenantId: number, customerId: number) {
    const [orders, payments] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: { tenantId, customerId, confirmedAt: { not: null } },
        select: { id: true, number: true, total: true, status: true, confirmedAt: true, cancelledAt: true },
      }),
      this.prisma.customerPayment.findMany({
        where: { tenantId, customerId },
        select: { id: true, amount: true, paidAt: true, voidedAt: true, reference: true },
      }),
    ]);
    const raw: Omit<StatementEntry, 'balance'>[] = [];
    for (const o of orders) {
      raw.push({ date: o.confirmedAt!, type: 'ORDER_CONFIRMED', reference: o.number, refId: o.id, debit: o.total.toFixed(2), credit: '0.00' });
      if (o.status === SalesOrderStatus.CANCELLED && o.cancelledAt) {
        raw.push({ date: o.cancelledAt, type: 'ORDER_CANCELLED', reference: o.number, refId: o.id, debit: '0.00', credit: o.total.toFixed(2) });
      }
    }
    pushPayments(raw, payments);
    return withRunningBalance(raw);
  }

  async supplierStatement(tenantId: number, supplierId: number) {
    const [orders, payments] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { tenantId, supplierId, status: PurchaseOrderStatus.RECEIVED },
        select: { id: true, number: true, total: true, receivedAt: true },
      }),
      this.prisma.supplierPayment.findMany({
        where: { tenantId, supplierId },
        select: { id: true, amount: true, paidAt: true, voidedAt: true, reference: true },
      }),
    ]);
    const raw: Omit<StatementEntry, 'balance'>[] = orders.map((o) => ({
      date: o.receivedAt!,
      type: 'PURCHASE_RECEIVED' as const,
      reference: o.number,
      refId: o.id,
      debit: o.total.toFixed(2),
      credit: '0.00',
    }));
    pushPayments(raw, payments);
    return withRunningBalance(raw);
  }
}

function combine(
  billed: [number, Decimal | null][],
  paid: [number, Decimal | null][],
): Map<number, { billed: Decimal; paid: Decimal; balance: Decimal }> {
  const out = new Map<number, { billed: Decimal; paid: Decimal; balance: Decimal }>();
  const get = (id: number) => {
    let v = out.get(id);
    if (!v) {
      v = { billed: dec(0), paid: dec(0), balance: dec(0) };
      out.set(id, v);
    }
    return v;
  };
  for (const [id, total] of billed) get(id).billed = dec(total);
  for (const [id, amount] of paid) get(id).paid = dec(amount);
  for (const v of out.values()) v.balance = money(v.billed.minus(v.paid));
  return out;
}

function pushPayments(
  raw: Omit<StatementEntry, 'balance'>[],
  payments: { id: number; amount: Decimal; paidAt: Date; voidedAt: Date | null; reference: string | null }[],
) {
  for (const p of payments) {
    const ref = p.reference ?? `#${p.id}`;
    raw.push({ date: p.paidAt, type: 'PAYMENT', reference: ref, refId: p.id, debit: '0.00', credit: p.amount.toFixed(2) });
    if (p.voidedAt) {
      // A void is shown as a reversing entry, so the history stays complete.
      raw.push({ date: p.voidedAt, type: 'PAYMENT_VOIDED', reference: ref, refId: p.id, debit: p.amount.toFixed(2), credit: '0.00' });
    }
  }
}

function withRunningBalance(raw: Omit<StatementEntry, 'balance'>[]) {
  raw.sort((a, b) => a.date.getTime() - b.date.getTime() || a.refId - b.refId);
  let running = dec(0);
  const entries: StatementEntry[] = raw.map((e) => {
    running = money(running.plus(e.debit).minus(e.credit));
    return { ...e, balance: running.toFixed(2) };
  });
  return { entries, balance: running.toFixed(2) };
}
