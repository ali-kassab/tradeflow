/**
 * Client-side preview of order totals. Mirrors computeOrderTotals in apps/api
 * (src/common/money.ts) exactly — integer cents with BigInt, half-up rounding — so the
 * editor never shows a figure the server would compute differently. The server stays the
 * authority: the saved order's totals are what count.
 *
 *   subtotal = Σ qty × unitPrice; tax = (subtotal − discount) × rate%; total = subtotal − discount + tax
 */

const DECIMAL = /^(\d+)(?:\.(\d{1,2}))?$/;

/** "12.5" → 1250n. Returns null for anything that isn't a non-negative amount with ≤ 2 decimals. */
export function toCents(value: string | number): bigint | null {
  const m = DECIMAL.exec(String(value).trim());
  if (!m) return null;
  return BigInt(m[1]) * 100n + BigInt((m[2] ?? '').padEnd(2, '0'));
}

/** 1250n → "12.50" (the API's decimal-string format, accepted by formatMoney). */
export function fromCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  return `${neg ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

/** Rounds n / d half-up for non-negative n and positive d. */
function divRoundHalfUp(n: bigint, d: bigint) {
  return (n * 2n + d) / (2n * d);
}

export interface TotalsInput {
  lines: { quantity: number; unitPrice: string }[];
  discount: string;
  /** VAT percent, e.g. "14" or "14.00". */
  taxRate: string;
}

export interface Totals {
  lineTotals: string[];
  subtotal: string;
  discount: string;
  taxAmount: string;
  total: string;
  /** True when the discount is larger than the subtotal (the API rejects it). */
  discountTooLarge: boolean;
}

/** Returns null while any input is not a valid amount (the editor shows its own field errors). */
export function computeTotals(input: TotalsInput): Totals | null {
  const prices = input.lines.map((l) => toCents(l.unitPrice));
  const discount = toCents(input.discount === '' ? '0' : input.discount);
  const rate = toCents(input.taxRate); // percent × 100, e.g. 14% → 1400n
  if (discount === null || rate === null || prices.some((p) => p === null)) return null;
  if (input.lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) return null;

  const lineTotals = input.lines.map((l, i) => prices[i]! * BigInt(l.quantity));
  const subtotal = lineTotals.reduce((a, b) => a + b, 0n);
  const taxable = subtotal - discount;
  const taxAmount = taxable > 0n ? divRoundHalfUp(taxable * rate, 10_000n) : 0n;
  return {
    lineTotals: lineTotals.map(fromCents),
    subtotal: fromCents(subtotal),
    discount: fromCents(discount),
    taxAmount: fromCents(taxAmount),
    total: fromCents(taxable + taxAmount),
    discountTooLarge: discount > subtotal,
  };
}
