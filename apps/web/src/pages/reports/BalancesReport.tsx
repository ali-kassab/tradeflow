import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '@/auth/context';
import { TableEmpty } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import type { BalancesReport as BalancesReportData } from '@/lib/types';
import { isOverLimit, splitBalances } from './report-utils';

type Party = 'customers' | 'suppliers';

/** Balance with its direction spelled out: a negative balance is credit / paid in advance. */
function BalanceCell({ balance, party, money }: { balance: string; party: Party; money: (v: string) => string }) {
  const { t } = useTranslation('reports');
  const negative = balance.startsWith('-');
  return (
    <TableCell className="tabular text-end whitespace-nowrap">
      <span className={negative ? 'text-primary' : 'font-medium'}>{money(negative ? balance.slice(1) : balance)}</span>
      {negative ? <span className="text-muted-foreground ms-2 text-xs">{t(`balances.${party}.creditTag`)}</span> : null}
    </TableCell>
  );
}

export function BalancesReport() {
  const { t, i18n } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);

  const report = useQuery({
    queryKey: ['reports', 'balances'],
    queryFn: async () => (await api.get<BalancesReportData>('/reports/balances')).data,
  });

  if (report.isError) return <Alert>{tc('status.loadError')}</Alert>;
  if (report.isPending) return <Skeleton className="h-72" />;

  const { customers, suppliers } = report.data;
  const c = splitBalances(customers);
  const s = splitBalances(suppliers);

  return (
    <div className="space-y-4">
      <dl className="panel grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-sm">{t('balances.customers.owed')}</dt>
          <dd className="tabular text-xl font-semibold">{money(c.owed)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('balances.customers.credit')}</dt>
          <dd className="tabular text-xl font-semibold">{money(c.credit)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('balances.suppliers.owed')}</dt>
          <dd className="tabular text-xl font-semibold">{money(s.owed)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('balances.suppliers.credit')}</dt>
          <dd className="tabular text-xl font-semibold">{money(s.credit)}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        <section aria-labelledby="rep-bal-customers">
          <h2 id="rep-bal-customers" className="mb-2 font-semibold">
            {t('balances.customers.title')}
          </h2>
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('balances.name')}</TableHead>
                  <TableHead>{t('balances.phone')}</TableHead>
                  <TableHead className="text-end">{t('balances.creditLimit')}</TableHead>
                  <TableHead className="text-end">{t('balances.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableEmpty colSpan={4}>{t('balances.customers.empty')}</TableEmpty>
                ) : null}
                {customers.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/customers/${r.id}`} className="hover:text-primary font-medium underline-offset-4 hover:underline">
                        {r.name}
                      </Link>
                      {isOverLimit(r.balance, r.creditLimit) ? (
                        <Badge className="bg-warning/15 text-warning-foreground ms-2">{t('balances.overLimit')}</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular">
                      <span dir="ltr">{r.phone ?? '—'}</span>
                    </TableCell>
                    <TableCell className="tabular text-muted-foreground text-end whitespace-nowrap">
                      {r.creditLimit === null ? '—' : money(r.creditLimit)}
                    </TableCell>
                    <BalanceCell balance={r.balance} party="customers" money={money} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="rep-bal-suppliers">
          <h2 id="rep-bal-suppliers" className="mb-2 font-semibold">
            {t('balances.suppliers.title')}
          </h2>
          <div className="panel overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('balances.name')}</TableHead>
                  <TableHead>{t('balances.phone')}</TableHead>
                  <TableHead className="text-end">{t('balances.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.length === 0 ? (
                  <TableEmpty colSpan={3}>{t('balances.suppliers.empty')}</TableEmpty>
                ) : null}
                {suppliers.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link to={`/suppliers/${r.id}`} className="hover:text-primary font-medium underline-offset-4 hover:underline">
                        {r.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular">
                      <span dir="ltr">{r.phone ?? '—'}</span>
                    </TableCell>
                    <BalanceCell balance={r.balance} party="suppliers" money={money} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
      <p className="text-muted-foreground text-xs">{t('balances.hint')}</p>
    </div>
  );
}
