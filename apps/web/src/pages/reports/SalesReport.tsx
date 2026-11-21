import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useSession } from '@/auth/context';
import { TableEmpty } from '@/components/EmptyState';
import { Alert } from '@/components/Alert';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDate, formatMoney, formatNumber, formatShortDay } from '@/lib/format';
import type { SalesReport as SalesReportData } from '@/lib/types';
import { cn } from '@/lib/utils';
import { defaultRange, isValidRange, marginPercent } from './report-utils';

const pct = (v: number | null, lang: string) =>
  v === null ? '—' : new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', { style: 'percent', maximumFractionDigits: 1 }).format(v / 100);

export function SalesReport() {
  const { t, i18n } = useTranslation('reports');
  const { t: tc } = useTranslation();
  const { tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);
  const [range, setRange] = useState(defaultRange);
  const valid = isValidRange(range.from, range.to);

  const report = useQuery({
    queryKey: ['reports', 'sales', range.from, range.to],
    queryFn: async () => (await api.get<SalesReportData>('/reports/sales', { params: range })).data,
    enabled: valid,
    placeholderData: keepPreviousData,
  });
  const chartConfig = { revenue: { label: t('sales.chartSeries'), color: 'var(--chart-1)' } } satisfies ChartConfig;
  const d = report.data;
  const margin = d ? marginPercent(d.summary.grossProfit, d.summary.netSales) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-3">
        <Field className="w-44">
          <FieldLabel htmlFor="rep-from">{t('sales.from')}</FieldLabel>
          <Input
            id="rep-from"
            type="date"
            value={range.from}
            max={range.to || undefined}
            onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
            aria-invalid={!valid ? true : undefined}
            className="tabular"
          />
        </Field>
        <Field className="w-44">
          <FieldLabel htmlFor="rep-to">{t('sales.to')}</FieldLabel>
          <Input
            id="rep-to"
            type="date"
            value={range.to}
            min={range.from || undefined}
            onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
            aria-invalid={!valid ? true : undefined}
            className="tabular"
          />
        </Field>
        {!valid ? <FieldError className="w-full">{t('sales.invalidRange')}</FieldError> : null}
      </div>

      {report.isError ? <Alert>{tc('status.loadError')}</Alert> : null}
      {report.isPending && valid ? <Skeleton className="h-72" /> : null}

      {d ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
            {/* The period's result, read as a sum: net sales − cost = gross profit. */}
            <section aria-labelledby="rep-summary" className="panel h-fit p-4">
              <h2 id="rep-summary" className="mb-3 font-semibold">
                {t('sales.summaryTitle')}
              </h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('sales.orders')}</dt>
                  <dd className="tabular">{formatNumber(d.summary.orders, lang)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('sales.subtotal')}</dt>
                  <dd className="tabular">{money(d.summary.subtotal)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('sales.discount')}</dt>
                  <dd className="tabular">−{money(d.summary.discount)}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t pt-2 font-medium">
                  <dt>{t('sales.netSales')}</dt>
                  <dd className="tabular">{money(d.summary.netSales)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{t('sales.cost')}</dt>
                  <dd className="tabular">−{money(d.summary.cost)}</dd>
                </div>
                <div className="border-foreground/70 flex items-baseline justify-between gap-3 border-t-[3px] border-double pt-2">
                  <dt className="font-semibold">
                    {t('sales.grossProfit')}
                    <span className="text-muted-foreground ms-2 text-xs font-normal">{t('sales.margin', { value: pct(margin, lang) })}</span>
                  </dt>
                  <dd className={cn('tabular text-lg font-semibold', Number(d.summary.grossProfit) < 0 && 'text-destructive')}>
                    {money(d.summary.grossProfit)}
                  </dd>
                </div>
                <div className="text-muted-foreground flex justify-between gap-3 pt-2 text-xs">
                  <dt>{t('sales.taxAndTotal', { tax: money(d.summary.tax) })}</dt>
                  <dd className="tabular">{money(d.summary.total)}</dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="rep-chart" className="panel min-w-0 p-4">
              <h2 id="rep-chart" className="mb-4 font-semibold">
                {t('sales.chartTitle', { from: formatDate(d.from, lang), to: formatDate(d.to, lang) })}
              </h2>
              <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" dir="ltr">
                <BarChart data={d.byDay.map((r) => ({ ...r, revenue: Number(r.revenue) }))} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={24}
                    reversed={lang === 'ar'}
                    tickFormatter={(v: string) => formatShortDay(v, lang)}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={64}
                    orientation={lang === 'ar' ? 'right' : 'left'}
                    tickFormatter={(v: number) => formatNumber(v, lang)}
                  />
                  <ChartTooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={<ChartTooltipContent labelFormatter={(v) => formatDate(String(v), lang)} formatter={(v) => money(String(v))} />}
                  />
                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[3, 3, 0, 0]} maxBarSize={18} />
                </BarChart>
              </ChartContainer>
              {/* The same numbers as a table, for screen readers and exact reading. */}
              <details className="mt-3 text-sm">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer">{t('sales.dailyTable')}</summary>
                <div className="mt-2 max-h-72 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('sales.day')}</TableHead>
                        <TableHead className="text-end">{t('sales.orders')}</TableHead>
                        <TableHead className="text-end">{t('sales.chartSeries')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.byDay
                        .filter((r) => r.orders > 0)
                        .map((r) => (
                          <TableRow key={r.date}>
                            <TableCell className="tabular">{formatDate(r.date, lang)}</TableCell>
                            <TableCell className="tabular text-end">{formatNumber(r.orders, lang)}</TableCell>
                            <TableCell className="tabular text-end">{money(r.revenue)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </details>
            </section>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
            <section aria-labelledby="rep-customers">
              <h2 id="rep-customers" className="mb-2 font-semibold">
                {t('sales.topCustomers')}
              </h2>
              <div className="panel overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('sales.customer')}</TableHead>
                      <TableHead className="text-end">{t('sales.orders')}</TableHead>
                      <TableHead className="text-end">{t('sales.revenue')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.byCustomer.length === 0 ? (
                      <TableEmpty colSpan={3}>{t('sales.empty')}</TableEmpty>
                    ) : null}
                    {d.byCustomer.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          <Link to={`/customers/${c.id}`} className="hover:text-primary underline-offset-4 hover:underline">
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="tabular text-end">{formatNumber(c.orders, lang)}</TableCell>
                        <TableCell className="tabular text-end whitespace-nowrap">{money(c.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>

            <section aria-labelledby="rep-products">
              <h2 id="rep-products" className="mb-2 font-semibold">
                {t('sales.topProducts')}
              </h2>
              <div className="panel overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('sales.product')}</TableHead>
                      <TableHead className="text-end">{t('sales.quantity')}</TableHead>
                      <TableHead className="text-end">{t('sales.revenue')}</TableHead>
                      <TableHead className="text-end">{t('sales.grossProfit')}</TableHead>
                      <TableHead className="text-end">{t('sales.marginColumn')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.byProduct.length === 0 ? (
                      <TableEmpty colSpan={5}>{t('sales.empty')}</TableEmpty>
                    ) : null}
                    {d.byProduct.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ms-2 text-xs" dir="ltr">
                            {p.sku}
                          </span>
                        </TableCell>
                        <TableCell className="tabular text-end">{formatNumber(p.quantity, lang)}</TableCell>
                        <TableCell className="tabular text-end whitespace-nowrap">{money(p.revenue)}</TableCell>
                        <TableCell className={cn('tabular text-end whitespace-nowrap', Number(p.grossProfit) < 0 && 'text-destructive')}>
                          {money(p.grossProfit)}
                        </TableCell>
                        <TableCell className="tabular text-muted-foreground text-end">{pct(marginPercent(p.grossProfit, p.revenue), lang)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-muted-foreground mt-2 text-xs">{t('sales.productsHint')}</p>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
