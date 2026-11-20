import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { formatDate, formatMoney } from '@/lib/format';
import type { Statement, StatementEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props {
  statement: Statement;
  currency: string;
  /** Accessible table caption, e.g. "Account statement for X". */
  caption: string;
  /** Shown instead of the table when there are no entries. */
  emptyText: string;
  /** Optional link target for an entry's reference (e.g. the order it came from). */
  referenceHref?: (entry: StatementEntry) => string | undefined;
}

/**
 * The ledger-style account statement (the app's signature element): debit, credit and a
 * running balance in tabular numerals, closed by a double-ruled closing balance.
 * Used for customers now and suppliers later; the API (LedgerService) computes every figure.
 */
export function LedgerStatement({ statement, currency, caption, emptyText, referenceHref }: Props) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, currency, lang);
  // A zero column stays blank, as on a paper ledger, so the eye only finds real amounts.
  const amount = (v: string) => (Number(v) === 0 ? '' : money(v));

  if (statement.entries.length === 0) {
    return <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">{emptyText}</p>;
  }

  return (
    <div className="bg-card overflow-x-auto rounded-lg border border-s-4 border-s-primary">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-muted-foreground border-b text-xs">
            <th scope="col" className="px-4 py-2.5 text-start font-medium">{t('statement.date')}</th>
            <th scope="col" className="px-4 py-2.5 text-start font-medium">{t('statement.entry')}</th>
            <th scope="col" className="px-4 py-2.5 text-start font-medium">{t('statement.reference')}</th>
            <th scope="col" className="px-4 py-2.5 text-end font-medium">{t('statement.debit')}</th>
            <th scope="col" className="px-4 py-2.5 text-end font-medium">{t('statement.credit')}</th>
            <th scope="col" className="bg-muted/50 px-4 py-2.5 text-end font-medium">{t('statement.balance')}</th>
          </tr>
        </thead>
        <tbody>
          {statement.entries.map((e, i) => {
            const reversal = e.type === 'ORDER_CANCELLED' || e.type === 'PAYMENT_VOIDED';
            const href = referenceHref?.(e);
            return (
              <tr key={`${e.type}-${e.refId}-${i}`} className="border-border/60 border-b border-dashed last:border-solid">
                <td className="tabular text-muted-foreground px-4 py-2 whitespace-nowrap">{formatDate(e.date, lang)}</td>
                <td className={cn('px-4 py-2', reversal && 'text-muted-foreground')}>{t(`statement.type.${e.type}`)}</td>
                <td className="px-4 py-2 text-start whitespace-nowrap">
                  {href ? (
                    <Link to={href} className="tabular hover:text-primary underline-offset-4 hover:underline" dir="ltr">
                      {e.reference}
                    </Link>
                  ) : (
                    <span className="tabular" dir="ltr">{e.reference}</span>
                  )}
                </td>
                <td className="tabular px-4 py-2 text-end whitespace-nowrap">{amount(e.debit)}</td>
                <td className="tabular px-4 py-2 text-end whitespace-nowrap">{amount(e.credit)}</td>
                <td className={cn('tabular bg-muted/50 px-4 py-2 text-end font-medium whitespace-nowrap', Number(e.balance) < 0 && 'text-primary')}>
                  {money(e.balance)}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-foreground/70 border-t-[3px] border-double">
            <th scope="row" colSpan={5} className="px-4 py-3 text-start font-semibold">{t('statement.closing')}</th>
            <td className={cn('tabular bg-muted/50 px-4 py-3 text-end text-base font-semibold whitespace-nowrap', Number(statement.balance) < 0 && 'text-primary')}>
              {money(statement.balance)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
