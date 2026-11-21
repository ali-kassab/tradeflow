import { useTranslation } from 'react-i18next';
import { useSession } from '@/auth/context';
import { formatMoneyParts } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A headline amount: the figure at full size, the currency symbol smaller and muted.
 * Reads exactly like `formatMoney` (same formatter, same order of parts).
 */
export function MoneyFigure({ value, className }: { value: string; className?: string }) {
  const { i18n } = useTranslation();
  const { tenant } = useSession();
  // Merge the figure parts (digits, separators) into one run; keep the currency apart.
  const runs: { text: string; currency: boolean }[] = [];
  for (const p of formatMoneyParts(value, tenant.currency, i18n.language)) {
    const last = runs.at(-1);
    if (last && last.currency === p.currency) last.text += p.text;
    else runs.push({ ...p });
  }
  return (
    <span className={cn('tabular inline-flex items-baseline gap-1 tracking-tight', className)}>
      {runs.map((p, i) =>
        p.currency ? (
          <span key={i} className="text-muted-foreground text-[0.5em] font-medium tracking-normal">
            {p.text}
          </span>
        ) : p.text.trim() === '' ? null : (
          <span key={i}>{p.text.trim()}</span>
        ),
      )}
    </span>
  );
}
