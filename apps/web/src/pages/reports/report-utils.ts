import type { ActivityEntry } from '@/lib/types';
import { fromCents, toCents } from '@/lib/order-math';

/** YYYY-MM-DD in local time. */
export const toDay = (d: Date) => d.toLocaleDateString('en-CA');

/** The default sales range: the last 30 days including today (the API's own default). */
export function defaultRange(today = new Date()) {
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  return { from: toDay(from), to: toDay(today) };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A usable range: two dates, from ≤ to. ISO day strings compare correctly as text. */
export function isValidRange(from: string, to: string) {
  return DAY.test(from) && DAY.test(to) && from <= to;
}

/** Gross margin in percent of net sales; null when there are no sales. */
export function marginPercent(grossProfit: string, netSales: string): number | null {
  const net = Number(netSales);
  if (!net) return null;
  return (Number(grossProfit) / net) * 100;
}

/** Known activity actions; anything else is shown with a generic label. */
export const ACTIVITY_ACTIONS = [
  'salesOrder.confirmed',
  'salesOrder.delivered',
  'salesOrder.cancelled',
  'purchaseOrder.ordered',
  'purchaseOrder.received',
  'purchaseOrder.cancelled',
  'payment.received',
  'payment.sent',
  'payment.voided',
  'stock.adjusted',
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

export const isKnownAction = (a: string): a is ActivityAction => (ACTIVITY_ACTIONS as readonly string[]).includes(a);

/** Where an activity entry leads: the order, the payments list, or the product's stock history. */
export function activityHref(e: Pick<ActivityEntry, 'entityType' | 'entityId'>): string | undefined {
  switch (e.entityType) {
    case 'salesOrder':
      return `/sales-orders/${e.entityId}`;
    case 'purchaseOrder':
      return `/purchase-orders/${e.entityId}`;
    case 'customerPayment':
      return '/payments';
    case 'supplierPayment':
      return '/supplier-payments';
    case 'product':
      return `/inventory?productId=${e.entityId}`;
    default:
      return undefined;
  }
}

/** Reads one string/number field from free-form metadata. */
export function metaValue(metadata: ActivityEntry['metadata'], key: string): string | undefined {
  const v = metadata?.[key];
  return typeof v === 'string' || typeof v === 'number' ? String(v) : undefined;
}

/** "-12.50" → -1250n; toCents only accepts non-negative amounts. Invalid input counts as 0. */
function signedCents(value: string): bigint {
  const v = value.trim();
  const neg = v.startsWith('-');
  return (toCents(neg ? v.slice(1) : v) ?? 0n) * (neg ? -1n : 1n);
}

/**
 * Splits balances into what is owed (positive) and what is held as credit (negative, returned
 * as a positive figure), summed exactly in cents.
 */
export function splitBalances(rows: { balance: string }[]) {
  let owed = 0n;
  let credit = 0n;
  for (const r of rows) {
    const c = signedCents(r.balance);
    if (c > 0n) owed += c;
    else credit -= c;
  }
  return { owed: fromCents(owed), credit: fromCents(credit) };
}

/** A customer whose balance is above a set credit limit (the limit is a warning only). */
export function isOverLimit(balance: string, creditLimit: string | null) {
  return creditLimit !== null && signedCents(balance) > signedCents(creditLimit);
}

export const REPORT_TABS = ['sales', 'inventory', 'balances', 'activity'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];
export const toReportTab = (v: string | null): ReportTab => ((REPORT_TABS as readonly string[]).includes(v ?? '') ? (v as ReportTab) : 'sales');
