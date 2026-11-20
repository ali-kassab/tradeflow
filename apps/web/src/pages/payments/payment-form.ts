import { toCents } from '@/lib/order-math';
import type { PaymentMethod } from '@/lib/types';

/** Today as YYYY-MM-DD in the user's local time (the value of an `<input type="date">`). */
export const localToday = () => new Date().toLocaleDateString('en-CA');

/**
 * The `paidAt` sent to the API. Today is omitted so the server stamps the exact time;
 * an earlier day is sent as local noon, so the date never shifts across time zones.
 */
export function paidAtForApi(date: string, today = localToday()): string | undefined {
  if (date === today) return undefined;
  return new Date(`${date}T12:00:00`).toISOString();
}

export type AmountCheck = 'invalid' | 'zero' | 'exceeds' | 'ok';

/** Validates a typed amount (≤ 2 decimals, > 0) and, for an order payment, that it fits the outstanding amount. */
export function checkAmount(amount: string, outstanding?: string): AmountCheck {
  const cents = toCents(amount);
  if (cents === null) return 'invalid';
  if (cents === 0n) return 'zero';
  if (outstanding !== undefined) {
    const max = toCents(outstanding);
    if (max !== null && cents > max) return 'exceeds';
  }
  return 'ok';
}

export const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'] as const satisfies readonly PaymentMethod[];
