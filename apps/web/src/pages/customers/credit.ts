import type { Customer } from '@/lib/types';

/** The credit limit is a warning only (the API never blocks on it). No limit means no warning. */
export function isOverLimit(c: Pick<Customer, 'balance' | 'creditLimit'>) {
  return c.creditLimit != null && Number(c.balance) > Number(c.creditLimit);
}

/** Customer price vs. standard price, as a signed percentage (null when the standard price is 0). */
export function priceDifference(special: number, standard: number) {
  if (!(standard > 0)) return null;
  return ((special - standard) / standard) * 100;
}
