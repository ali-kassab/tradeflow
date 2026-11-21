import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '@/auth/context';
import { TableEmpty } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney, formatNumber } from '@/lib/format';
import type { ActivityEntry } from '@/lib/types';
import { activityHref, isKnownAction, metaValue } from './report-utils';

export function ActivityReport() {
  const { t, i18n } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);

  const report = useQuery({
    queryKey: ['reports', 'activity'],
    queryFn: async () => (await api.get<ActivityEntry[]>('/reports/activity')).data,
  });

  if (report.isError) return <Alert>{tc('status.loadError')}</Alert>;
  if (report.isPending) return <Skeleton className="h-72" />;

  /** What the entry's link says: the document number, or the kind of record. */
  const reference = (e: ActivityEntry) => metaValue(e.metadata, 'number') ?? t(`activity.entity.${e.entityType === 'product' ? 'product' : 'payment'}`);

  /** The one figure or note that matters for each action. */
  const details = (e: ActivityEntry) => {
    const total = metaValue(e.metadata, 'total');
    const amount = metaValue(e.metadata, 'amount');
    const reason = metaValue(e.metadata, 'reason');
    const qty = metaValue(e.metadata, 'quantity');
    const note = metaValue(e.metadata, 'note');
    if (e.action === 'stock.adjusted' && qty !== undefined) {
      const n = Number(qty);
      return (
        <>
          <span className="tabular font-medium" dir="ltr">
            {n > 0 ? '+' : ''}
            {formatNumber(n, lang)}
          </span>
          {note ? <span className="text-muted-foreground ms-2">{note}</span> : null}
        </>
      );
    }
    if (reason) return <span className="text-muted-foreground">{t('activity.reason', { reason })}</span>;
    const figure = amount ?? total;
    return figure ? <span className="tabular whitespace-nowrap">{money(figure)}</span> : null;
  };

  const rows = report.data;

  return (
    <div className="space-y-2">
      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('activity.when')}</TableHead>
              <TableHead>{t('activity.user')}</TableHead>
              <TableHead>{t('activity.action')}</TableHead>
              <TableHead>{t('activity.reference')}</TableHead>
              <TableHead>{t('activity.details')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={5}>{t('activity.empty')}</TableEmpty>
            ) : null}
            {rows.map((e) => {
              const href = activityHref(e);
              return (
                <TableRow key={e.id}>
                  <TableCell className="tabular text-muted-foreground whitespace-nowrap">{formatDateTime(e.createdAt, lang)}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.userName ?? t('activity.unknownUser')}</TableCell>
                  <TableCell className="whitespace-nowrap">{isKnownAction(e.action) ? t(`activity.actions.${e.action}`) : e.action}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {href ? (
                      <Link to={href} className="hover:text-primary underline-offset-4 hover:underline">
                        <bdi>{reference(e)}</bdi>
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="min-w-48">{details(e)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">{t('activity.hint')}</p>
    </div>
  );
}
