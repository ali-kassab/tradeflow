import type { ReactNode } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** A blank ledger page: the logo's ruled lines and amber column, drawn quietly. */
export function EmptyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('size-12', className)} aria-hidden="true" fill="none">
      <rect x="8" y="5" width="32" height="38" rx="6" className="fill-muted stroke-border" strokeWidth="1.5" />
      <path d="M15 16h18M15 23h18M15 30h11" className="stroke-muted-foreground/35" strokeWidth="2" strokeLinecap="round" />
      <path d="M29 11v26" className="stroke-rule/70" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Centered empty message with the glyph; `action` invites the next step when there is one. */
export function EmptyState({ children, action, className, tone = 'muted' }: { children: ReactNode; action?: ReactNode; className?: string; tone?: 'muted' | 'error' }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center text-sm',
        tone === 'error' ? 'border-destructive/60 text-destructive' : 'text-muted-foreground',
        className,
      )}
    >
      <EmptyGlyph />
      <div className="max-w-sm text-balance">{children}</div>
      {action}
    </div>
  );
}

/** Empty-table row spanning every column. */
export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-12">
        <div className="text-muted-foreground flex flex-col items-center gap-3 text-center text-sm whitespace-normal">
          <EmptyGlyph />
          <p className="max-w-sm text-balance">{children}</p>
        </div>
      </TableCell>
    </TableRow>
  );
}
