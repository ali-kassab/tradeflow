import { useQuery } from '@tanstack/react-query';
import { ArrowUpLeftIcon, ArrowUpRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useSession } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { EmptyState } from '@/components/EmptyState';
import { MoneyFigure } from '@/components/Money';
import { Button } from '@/components/ui/button';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, formatMoney, formatNumber, formatShortDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import { OrderStatusBadge } from '@/pages/sales-orders/badges';

type OrderStatus = 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

/** Shape of GET /api/dashboard. Cost-related fields are absent for STAFF. */
export interface DashboardData {
  salesToday: string;
  ordersToday: number;
  salesThisMonth: string;
  ordersThisMonth: number;
  receivables: string;
  customerCredit: string;
  lowStockCount: number;
  salesLast30Days: { date: string; orders: number; revenue: string }[];
  recentOrders: {
    id: number;
    number: string;
    status: OrderStatus;
    total: string;
    createdAt: string;
    customer: { id: number; name: string };
  }[];
  recentPayments: {
    id: number;
    amount: string;
    method: PaymentMethod;
    paidAt: string;
    customer: { id: number; name: string };
  }[];
  payables?: string;
  inventoryValue?: string;
  grossProfitThisMonth?: string;
}

/** A labelled figure inside a panel; panels group figures by meaning, not one card each. */
function Stat({ label, children, note, tone }: { label: string; children: ReactNode; note?: string; tone?: 'warning' }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={cn('tabular mt-1 text-xl font-semibold tracking-tight', tone === 'warning' && 'text-warning-foreground')}>{children}</p>
      {note ? <p className="text-muted-foreground mt-0.5 text-xs">{note}</p> : null}
    </div>
  );
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">{children}</h2>
      {action}
    </div>
  );
}

function ViewAll({ to }: { to: string }) {
  const { t, i18n } = useTranslation('dashboard');
  const Icon = i18n.dir() === 'rtl' ? ArrowUpLeftIcon : ArrowUpRightIcon;
  return (
    <Button variant="ghost" size="sm" asChild className="text-muted-foreground -me-2">
      <Link to={to}>
        {t('viewAll')}
        <Icon aria-hidden="true" />
      </Link>
    </Button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        <div className="grid gap-4">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const { t: tc } = useTranslation();
  const { user, tenant } = useSession();
  const lang = i18n.language;
  const money = (v: string) => formatMoney(v, tenant.currency, lang);

  const query = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/dashboard')).data,
  });

  const chartConfig = { revenue: { label: t('chart.revenue'), color: 'var(--chart-1)' } } satisfies ChartConfig;
  const d = query.data;

  // Money position: what customers owe, what we owe suppliers (manager+), credit held for customers.
  const position = d
    ? [
        { key: 'receivables', label: t('kpi.receivables'), value: d.receivables },
        ...(d.payables !== undefined ? [{ key: 'payables', label: t('kpi.payables'), value: d.payables }] : []),
        { key: 'credit', label: t('kpi.customerCredit'), value: d.customerCredit },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.625rem] leading-tight font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{t('greeting', { name: user.name })}</p>
      </div>

      {query.isPending ? <DashboardSkeleton /> : null}

      {query.isError ? (
        <div className="space-y-3">
          <Alert>{t('loadError')}</Alert>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {tc('actions.retry')}
          </Button>
        </div>
      ) : null}

      {d ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
            {/* The month's sales lead the page, with the 30-day trend that produced them. */}
            <section className="panel p-5 sm:p-6 lg:col-span-2" aria-labelledby="dash-month">
              <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                <div>
                  <h2 id="dash-month" className="text-muted-foreground text-sm">
                    {t('kpi.salesThisMonth')}
                  </h2>
                  <p className="mt-1 text-[2.5rem] leading-none font-semibold">
                    <MoneyFigure value={d.salesThisMonth} />
                  </p>
                  <p className="text-muted-foreground mt-2 text-sm">{t('kpi.orders', { count: d.ordersThisMonth })}</p>
                </div>
                {d.grossProfitThisMonth !== undefined ? (
                  <div className="border-rule border-s-2 ps-4">
                    <Stat label={t('kpi.grossProfit')}>{money(d.grossProfitThisMonth)}</Stat>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 border-t pt-5">
                <p className="text-muted-foreground mb-3 text-xs">{t('chart.title')}</p>
                <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full" dir="ltr">
                  <BarChart data={d.salesLast30Days.map((x) => ({ ...x, revenue: Number(x.revenue) }))} margin={{ left: 4, right: 4, top: 4 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 4" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={28}
                      tickMargin={8}
                      reversed={lang === 'ar'}
                      tickFormatter={(v: string) => formatShortDay(v, lang)}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      orientation={lang === 'ar' ? 'right' : 'left'}
                      tickFormatter={(v: number) => formatNumber(v, lang)}
                    />
                    <ChartTooltip
                      cursor={{ fill: 'var(--muted)', radius: 4 }}
                      content={<ChartTooltipContent labelFormatter={(v) => formatDate(String(v), lang)} formatter={(v) => money(String(v))} />}
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={16} />
                  </BarChart>
                </ChartContainer>
              </div>
            </section>

            <div className="grid content-start gap-4">
              <section className="panel space-y-4 p-5" aria-labelledby="dash-today">
                <h2 id="dash-today" className="text-sm font-semibold">
                  {t('sections.today')}
                </h2>
                <Stat label={t('kpi.salesToday')} note={t('kpi.orders', { count: d.ordersToday })}>
                  {money(d.salesToday)}
                </Stat>
              </section>

              <section className="panel space-y-4 p-5" aria-labelledby="dash-stock">
                <h2 id="dash-stock" className="text-sm font-semibold">
                  {t('sections.stock')}
                </h2>
                {d.inventoryValue !== undefined ? <Stat label={t('kpi.inventoryValue')}>{money(d.inventoryValue)}</Stat> : null}
                <Stat label={t('kpi.lowStock')} tone={d.lowStockCount > 0 ? 'warning' : undefined}>
                  {formatNumber(d.lowStockCount, lang)}
                </Stat>
              </section>
            </div>
          </div>

          <section className="panel" aria-labelledby="dash-position">
            <h2 id="dash-position" className="border-b px-5 py-3 text-sm font-semibold">
              {t('sections.position')}
            </h2>
            <div className={cn('grid divide-y sm:divide-y-0 sm:divide-x sm:rtl:divide-x-reverse', position.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
              {position.map((p) => (
                <div key={p.key} className="px-5 py-4">
                  <Stat label={p.label}>{money(p.value)}</Stat>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
            <section className="panel" aria-labelledby="dash-orders">
              <div className="border-b px-5 py-2.5">
                <SectionTitle action={<ViewAll to="/sales-orders" />}>
                  <span id="dash-orders">{t('recentOrders.title')}</span>
                </SectionTitle>
              </div>
              {d.recentOrders.length === 0 ? (
                <EmptyState className="m-4 border-0">{t('recentOrders.empty')}</EmptyState>
              ) : (
                <ul className="divide-border/70 divide-y">
                  {d.recentOrders.map((o) => (
                    <li key={o.id}>
                      <Link to={`/sales-orders/${o.id}`} className="hover:bg-muted/45 focus-visible:bg-muted/45 flex items-center gap-3 px-5 py-3 text-sm outline-none">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">
                            <bdi dir="ltr">{o.number}</bdi>
                          </p>
                          <p className="text-muted-foreground truncate">{o.customer.name}</p>
                        </div>
                        <OrderStatusBadge status={o.status} />
                        <span className="tabular w-28 text-end font-medium">{money(o.total)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel" aria-labelledby="dash-payments">
              <div className="border-b px-5 py-2.5">
                <SectionTitle action={<ViewAll to="/payments" />}>
                  <span id="dash-payments">{t('recentPayments.title')}</span>
                </SectionTitle>
              </div>
              {d.recentPayments.length === 0 ? (
                <EmptyState className="m-4 border-0">{t('recentPayments.empty')}</EmptyState>
              ) : (
                <ul className="divide-border/70 divide-y">
                  {d.recentPayments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.customer.name}</p>
                        <p className="text-muted-foreground">
                          {formatDate(p.paidAt, lang)}
                          <span className="text-border mx-1.5" aria-hidden="true">
                            |
                          </span>
                          {tc(`paymentMethod.${p.method}`)}
                        </p>
                      </div>
                      <span className="tabular text-primary w-28 text-end font-medium">{money(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
