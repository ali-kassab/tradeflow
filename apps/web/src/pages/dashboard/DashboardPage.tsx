import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { useSession } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, formatMoney, formatNumber, formatShortDay } from '@/lib/format';
import { cn } from '@/lib/utils';

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

const STATUS_STYLE: Record<OrderStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  CONFIRMED: 'bg-accent text-accent-foreground',
  DELIVERED: 'bg-primary text-primary-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'warning' }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={cn('tabular mt-1 text-2xl font-semibold', tone === 'warning' && 'text-warning-foreground')}>{value}</p>
      {note ? <p className="text-muted-foreground mt-0.5 text-xs">{note}</p> : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('greeting', { name: user.name })}</p>
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

      {query.data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              label={t('kpi.salesToday')}
              value={money(query.data.salesToday)}
              note={t('kpi.orders', { count: query.data.ordersToday })}
            />
            <Kpi
              label={t('kpi.salesThisMonth')}
              value={money(query.data.salesThisMonth)}
              note={t('kpi.orders', { count: query.data.ordersThisMonth })}
            />
            <Kpi label={t('kpi.receivables')} value={money(query.data.receivables)} />
            <Kpi
              label={t('kpi.lowStock')}
              value={formatNumber(query.data.lowStockCount, lang)}
              tone={query.data.lowStockCount > 0 ? 'warning' : undefined}
            />
            {query.data.grossProfitThisMonth !== undefined ? (
              <Kpi label={t('kpi.grossProfitThisMonth')} value={money(query.data.grossProfitThisMonth)} />
            ) : null}
            {query.data.inventoryValue !== undefined ? (
              <Kpi label={t('kpi.inventoryValue')} value={money(query.data.inventoryValue)} />
            ) : null}
            {query.data.payables !== undefined ? (
              <Kpi label={t('kpi.payables')} value={money(query.data.payables)} />
            ) : null}
            <Kpi label={t('kpi.customerCredit')} value={money(query.data.customerCredit)} />
          </section>

          <section className="bg-card rounded-lg border p-4">
            <h2 className="mb-4 font-semibold">{t('chart.title')}</h2>
            <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" dir="ltr">
              <AreaChart
                data={query.data.salesLast30Days.map((d) => ({ ...d, revenue: Number(d.revenue) }))}
                margin={{ left: 8, right: 8 }}
              >
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
                  content={
                    <ChartTooltipContent
                      labelFormatter={(v) => formatDate(String(v), lang)}
                      formatter={(v) => money(String(v))}
                    />
                  }
                />
                <Area
                  dataKey="revenue"
                  type="monotone"
                  stroke="var(--color-revenue)"
                  fill="var(--color-revenue)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="bg-card rounded-lg border">
              <h2 className="border-b px-4 py-3 font-semibold">{t('recentOrders.title')}</h2>
              {query.data.recentOrders.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">{t('recentOrders.empty')}</p>
              ) : (
                <ul className="divide-y">
                  {query.data.recentOrders.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium" dir="ltr">
                          {o.number}
                        </p>
                        <p className="text-muted-foreground truncate">{o.customer.name}</p>
                      </div>
                      <Badge className={STATUS_STYLE[o.status]}>{tc(`orderStatus.${o.status}`)}</Badge>
                      <span className="tabular w-32 text-end font-medium">{money(o.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="bg-card rounded-lg border">
              <h2 className="border-b px-4 py-3 font-semibold">{t('recentPayments.title')}</h2>
              {query.data.recentPayments.length === 0 ? (
                <p className="text-muted-foreground p-4 text-sm">{t('recentPayments.empty')}</p>
              ) : (
                <ul className="divide-y">
                  {query.data.recentPayments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.customer.name}</p>
                        <p className="text-muted-foreground">
                          {formatDate(p.paidAt, lang)} · {tc(`paymentMethod.${p.method}`)}
                        </p>
                      </div>
                      <span className="tabular w-32 text-end font-medium">{money(p.amount)}</span>
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
