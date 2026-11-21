import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useSession } from '@/auth/context';
import { TableEmpty } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatMoney, formatNumber } from '@/lib/format';
import type { InventoryReport as InventoryReportData } from '@/lib/types';

export function InventoryReport() {
  const { t, i18n } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const [lowOnly, setLowOnly] = useState(false);

  const report = useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: async () => (await api.get<InventoryReportData>('/reports/inventory')).data,
  });

  if (report.isError) return <Alert>{tc('status.loadError')}</Alert>;
  if (report.isPending) return <Skeleton className="h-72" />;

  const d = report.data;
  const lowCount = d.rows.filter((r) => r.isLowStock).length;
  const rows = lowOnly ? d.rows.filter((r) => r.isLowStock) : d.rows;

  return (
    <div className="space-y-4">
      <dl className="panel grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-sm">{t('inventory.value')}</dt>
          <dd className="tabular text-xl font-semibold">{money(d.value)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('inventory.units')}</dt>
          <dd className="tabular text-xl font-semibold">{formatNumber(d.units, lang)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-sm">{t('inventory.lowStock')}</dt>
          <dd className={lowCount > 0 ? 'tabular text-warning-foreground text-xl font-semibold' : 'tabular text-xl font-semibold'}>
            {formatNumber(lowCount, lang)}
          </dd>
        </div>
      </dl>

      <div className="flex items-center gap-2">
        <Checkbox id="rep-low" checked={lowOnly} onCheckedChange={(v) => setLowOnly(v === true)} />
        <Label htmlFor="rep-low">{t('inventory.lowOnly')}</Label>
      </div>

      <div className="panel overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('inventory.product')}</TableHead>
              <TableHead className="text-end">{t('inventory.stock')}</TableHead>
              <TableHead className="text-end">{t('inventory.reorderLevel')}</TableHead>
              <TableHead className="text-end">{t('inventory.cost')}</TableHead>
              <TableHead className="text-end">{t('inventory.rowValue')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={5}>{lowOnly ? t('inventory.noLowStock') : t('inventory.empty')}</TableEmpty>
            ) : null}
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link to={`/inventory?productId=${p.id}`} className="hover:text-primary font-medium underline-offset-4 hover:underline">
                    {p.name}
                  </Link>
                  <span className="text-muted-foreground ms-2 text-xs" dir="ltr">
                    {p.sku}
                  </span>
                </TableCell>
                <TableCell className="tabular text-end whitespace-nowrap">
                  <span className={p.isLowStock ? 'text-warning-foreground font-semibold' : undefined}>{formatNumber(p.stockQty, lang)}</span>
                  <span className="text-muted-foreground ms-1 text-xs">{p.unit}</span>
                  {p.isLowStock ? <Badge className="bg-warning/15 text-warning-foreground ms-2">{t('inventory.lowBadge')}</Badge> : null}
                </TableCell>
                <TableCell className="tabular text-muted-foreground text-end">{formatNumber(p.reorderLevel, lang)}</TableCell>
                <TableCell className="tabular text-end whitespace-nowrap">{money(p.costPrice)}</TableCell>
                <TableCell className="tabular text-end whitespace-nowrap">{money(p.value)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {!lowOnly && rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  {t('inventory.total')}
                </TableCell>
                <TableCell className="tabular text-end font-semibold whitespace-nowrap">{money(d.value)}</TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
      <p className="text-muted-foreground text-xs">{t('inventory.hint')}</p>
    </div>
  );
}
