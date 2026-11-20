import { cn } from '@/lib/utils';

/** Wordmark: a ledger column mark next to the product name. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-lg font-semibold', className)} dir="ltr">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="#0F6E5A" />
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M14.5 6v12" stroke="#C8891B" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      TradeFlow
    </span>
  );
}
