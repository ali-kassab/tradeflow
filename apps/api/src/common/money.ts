import { Prisma } from '../generated/prisma/client.js';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export type DecimalLike = Decimal | string | number;

export const dec = (v: DecimalLike | null | undefined): Decimal => new Decimal(v ?? 0);

/** Rounds half-up to 2 decimal places, the precision of every money column. */
export const money = (v: DecimalLike): Decimal =>
  dec(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

export const sum = (values: DecimalLike[]): Decimal =>
  values.reduce<Decimal>((acc, v) => acc.plus(dec(v)), new Decimal(0));

export interface OrderTotalsInput {
  lines: { quantity: number; unitPrice: DecimalLike }[];
  discount: DecimalLike;
  taxRate: DecimalLike;
}

export interface OrderTotals {
  lineTotals: Decimal[];
  subtotal: Decimal;
  discount: Decimal;
  taxAmount: Decimal;
  total: Decimal;
}

/**
 * Single source of truth for order arithmetic:
 * subtotal = Σ qty × unitPrice; tax = (subtotal − discount) × rate%; total = subtotal − discount + tax.
 */
export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const lineTotals = input.lines.map((l) => money(dec(l.unitPrice).times(l.quantity)));
  const subtotal = money(sum(lineTotals));
  const discount = money(input.discount);
  const taxable = subtotal.minus(discount);
  const taxAmount = money(taxable.times(dec(input.taxRate)).dividedBy(100));
  const total = money(taxable.plus(taxAmount));
  return { lineTotals, subtotal, discount, taxAmount, total };
}
