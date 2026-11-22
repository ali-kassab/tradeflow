import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { Prisma } from '../../generated/prisma/client.js';
import { SalesOrderStatus } from '../../common/enums.js';
import { type AuthUser, CurrentUser, ManagerOrAbove, canSeeCosts } from '../../common/auth.js';
import { dec, money } from '../../common/money.js';
import { parseMetadata } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BILLED_SALES, LedgerService } from '../payments/ledger.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

class RangeQueryDto {
  @ApiPropertyOptional({ example: '2026-01-01', description: 'Inclusive. Defaults to 30 days ago.' })
  @IsOptional()
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({ example: '2026-01-31', description: 'Inclusive. Defaults to today.' })
  @IsOptional()
  @IsDateString({ strict: true })
  to?: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** Local YYYY-MM-DD key, the same calendar the day boundaries above use. */
export const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/**
 * Reads a `from`/`to` query value as a *local* calendar day. `new Date('2026-01-31')`
 * would be UTC midnight, which shifts the range by the server's UTC offset and drops
 * orders confirmed shortly after local midnight (or a whole day west of UTC).
 */
export function parseDay(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : startOfDay(new Date(value));
}
const str = (v: Prisma.Decimal | number | bigint | null | undefined) => money(dec(v === null || v === undefined ? 0 : v.toString())).toFixed(2);
const BILLED_SQL = Prisma.join(BILLED_SALES);

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** Role-aware: STAFF gets sales figures only — no costs, profit, payables or stock value. */
  async dashboard(actor: AuthUser) {
    const t = actor.tenantId;
    const today = startOfDay(new Date());
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const from30 = addDays(today, -29);

    const billedSince = (since: Date) =>
      this.prisma.salesOrder.aggregate({
        where: { tenantId: t, status: { in: BILLED_SALES }, confirmedAt: { gte: since } },
        _sum: { total: true },
        _count: true,
      });

    const [todayAgg, monthAgg, balances, lowStock, recentOrders, recentPayments, daily] = await Promise.all([
      billedSince(today),
      billedSince(monthStart),
      this.ledger.customerBalances(t),
      this.prisma.product.count({
        where: { tenantId: t, isActive: true, stockQty: { lte: this.prisma.product.fields.reorderLevel } },
      }),
      this.prisma.salesOrder.findMany({
        where: { tenantId: t },
        select: { id: true, number: true, status: true, total: true, createdAt: true, customer: { select: { id: true, name: true } } },
        orderBy: { id: 'desc' },
        take: 6,
      }),
      this.prisma.customerPayment.findMany({
        where: { tenantId: t, voidedAt: null },
        select: { id: true, amount: true, method: true, paidAt: true, customer: { select: { id: true, name: true } } },
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        take: 6,
      }),
      this.dailySales(t, from30, addDays(today, 1)),
    ]);

    let receivables = dec(0);
    let customerCredit = dec(0);
    for (const b of balances.values()) {
      if (b.balance.greaterThan(0)) receivables = receivables.plus(b.balance);
      else customerCredit = customerCredit.plus(b.balance.abs());
    }

    const base = {
      salesToday: str(todayAgg._sum.total),
      ordersToday: todayAgg._count,
      salesThisMonth: str(monthAgg._sum.total),
      ordersThisMonth: monthAgg._count,
      receivables: money(receivables).toFixed(2),
      customerCredit: money(customerCredit).toFixed(2),
      lowStockCount: lowStock,
      salesLast30Days: daily,
      recentOrders,
      recentPayments,
    };
    if (!canSeeCosts(actor)) return base;

    const [supplierBalances, inventory, monthProfit] = await Promise.all([
      this.ledger.supplierBalances(t),
      this.inventoryTotals(t),
      this.salesSummary(t, monthStart, addDays(today, 1)),
    ]);
    let payables = dec(0);
    for (const b of supplierBalances.values()) if (b.balance.greaterThan(0)) payables = payables.plus(b.balance);

    return {
      ...base,
      payables: money(payables).toFixed(2),
      inventoryValue: inventory.value,
      grossProfitThisMonth: monthProfit.grossProfit,
    };
  }

  async sales(actor: AuthUser, q: RangeQueryDto) {
    const t = actor.tenantId;
    const to = q.to ? addDays(parseDay(q.to), 1) : addDays(startOfDay(new Date()), 1);
    const from = q.from ? parseDay(q.from) : addDays(to, -30);

    const [summary, byDay, byCustomer, byProduct] = await Promise.all([
      this.salesSummary(t, from, to),
      this.dailySales(t, from, to),
      this.prisma.$queryRaw<{ id: number; name: string; orders: bigint; revenue: Prisma.Decimal }[]>`
        SELECT TOP (20) c.id, c.name, COUNT(*) AS orders, SUM(o.total) AS revenue
        FROM SalesOrder o JOIN Customer c ON c.id = o.customerId AND c.tenantId = o.tenantId
        WHERE o.tenantId = ${t} AND o.status IN (${BILLED_SQL})
          AND o.confirmedAt >= ${from} AND o.confirmedAt < ${to}
        GROUP BY c.id, c.name ORDER BY revenue DESC`,
      this.prisma.$queryRaw<{ id: number; name: string; sku: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal; cost: Prisma.Decimal }[]>`
        SELECT TOP (20) p.id, p.name, p.sku, SUM(i.quantity) AS quantity, SUM(i.lineTotal) AS revenue,
               SUM(i.unitCost * i.quantity) AS cost
        FROM SalesOrderItem i
        JOIN SalesOrder o ON o.id = i.salesOrderId AND o.tenantId = i.tenantId
        JOIN Product p ON p.id = i.productId AND p.tenantId = i.tenantId
        WHERE i.tenantId = ${t} AND o.status IN (${BILLED_SQL})
          AND o.confirmedAt >= ${from} AND o.confirmedAt < ${to}
        GROUP BY p.id, p.name, p.sku ORDER BY revenue DESC`,
    ]);

    return {
      from: from.toISOString(),
      to: addDays(to, -1).toISOString(),
      summary,
      byDay,
      byCustomer: byCustomer.map((r) => ({ ...r, orders: Number(r.orders), revenue: str(r.revenue) })),
      byProduct: byProduct.map((r) => ({
        id: r.id,
        name: r.name,
        sku: r.sku,
        quantity: Number(r.quantity),
        revenue: str(r.revenue),
        cost: str(r.cost),
        grossProfit: str(dec(r.revenue.toString()).minus(r.cost.toString())),
      })),
    };
  }

  async inventory(actor: AuthUser) {
    const products = await this.prisma.product.findMany({
      where: { tenantId: actor.tenantId, isActive: true },
      select: { id: true, sku: true, name: true, unit: true, stockQty: true, reorderLevel: true, costPrice: true, salePrice: true },
      orderBy: { name: 'asc' },
    });
    const rows = products.map((p) => ({
      ...p,
      value: money(dec(p.costPrice).times(p.stockQty)).toFixed(2),
      isLowStock: p.stockQty <= p.reorderLevel,
    }));
    return { rows, ...(await this.inventoryTotals(actor.tenantId)) };
  }

  async balances(actor: AuthUser) {
    const t = actor.tenantId;
    const [customers, suppliers, cMap, sMap] = await Promise.all([
      this.prisma.customer.findMany({ where: { tenantId: t }, select: { id: true, name: true, phone: true, creditLimit: true } }),
      this.prisma.supplier.findMany({ where: { tenantId: t }, select: { id: true, name: true, phone: true } }),
      this.ledger.customerBalances(t),
      this.ledger.supplierBalances(t),
    ]);
    const pick = <T extends { id: number }>(rows: T[], map: Map<number, { balance: Prisma.Decimal }>) =>
      rows
        .map((r) => ({ ...r, balance: map.get(r.id)?.balance ?? dec(0) }))
        .filter((r) => !r.balance.isZero())
        .sort((a, b) => b.balance.comparedTo(a.balance))
        .map((r) => ({ ...r, balance: r.balance.toFixed(2) }));
    return { customers: pick(customers, cMap), suppliers: pick(suppliers, sMap) };
  }

  async activity(actor: AuthUser) {
    const rows = await this.prisma.activityLog.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { id: 'desc' },
      take: 100,
    });
    const users = await this.prisma.user.findMany({
      where: { tenantId: actor.tenantId, id: { in: [...new Set(rows.map((r) => r.userId))] } },
      select: { id: true, name: true },
    });
    const names = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({ ...r, metadata: parseMetadata(r.metadata), userName: names.get(r.userId) ?? null }));
  }

  // ---------- shared queries ----------

  private async dailySales(tenantId: number, from: Date, to: Date) {
    // Bucketed in JS by *local* day: confirmedAt is stored in UTC, so SQL's
    // CAST(confirmedAt AS date) would put orders confirmed just after local
    // midnight on the previous (UTC) day, out of step with the range and the
    // dashboard's "today" figures.
    const rows = await this.prisma.salesOrder.findMany({
      where: { tenantId, status: { in: BILLED_SALES }, confirmedAt: { gte: from, lt: to } },
      select: { confirmedAt: true, total: true },
    });
    const byDay = new Map<string, { orders: number; revenue: Prisma.Decimal }>();
    for (const r of rows) {
      const key = localDayKey(r.confirmedAt!);
      const day = byDay.get(key) ?? { orders: 0, revenue: dec(0) };
      day.orders += 1;
      day.revenue = day.revenue.plus(r.total);
      byDay.set(key, day);
    }
    // Fill gaps so charts get a continuous series.
    const out: { date: string; orders: number; revenue: string }[] = [];
    for (let d = startOfDay(from); d < to; d = addDays(d, 1)) {
      const key = localDayKey(d);
      const day = byDay.get(key);
      out.push({ date: key, orders: day?.orders ?? 0, revenue: str(day?.revenue) });
    }
    return out;
  }

  private async salesSummary(tenantId: number, from: Date, to: Date) {
    const where = { tenantId, status: { in: BILLED_SALES }, confirmedAt: { gte: from, lt: to } };
    const [agg, cost] = await Promise.all([
      this.prisma.salesOrder.aggregate({
        where,
        _sum: { subtotal: true, discount: true, taxAmount: true, total: true },
        _count: true,
      }),
      this.prisma.$queryRaw<{ cost: Prisma.Decimal | null }[]>`
        SELECT SUM(i.unitCost * i.quantity) AS cost
        FROM SalesOrderItem i JOIN SalesOrder o ON o.id = i.salesOrderId AND o.tenantId = i.tenantId
        WHERE i.tenantId = ${tenantId} AND o.status IN (${BILLED_SQL})
          AND o.confirmedAt >= ${from} AND o.confirmedAt < ${to}`,
    ]);
    const netSales = dec(agg._sum.subtotal).minus(dec(agg._sum.discount));
    const costTotal = dec(cost[0]?.cost?.toString() ?? 0);
    return {
      orders: agg._count,
      subtotal: str(agg._sum.subtotal),
      discount: str(agg._sum.discount),
      tax: str(agg._sum.taxAmount),
      total: str(agg._sum.total),
      netSales: str(netSales),
      cost: str(costTotal),
      grossProfit: str(netSales.minus(costTotal)),
    };
  }

  private async inventoryTotals(tenantId: number) {
    const [row] = await this.prisma.$queryRaw<{ value: Prisma.Decimal | null; units: Prisma.Decimal | null }[]>`
      SELECT SUM(stockQty * costPrice) AS value, SUM(stockQty) AS units
      FROM Product WHERE tenantId = ${tenantId} AND isActive = 1`;
    return { value: str(row?.value), units: Number(row?.units ?? 0) };
  }
}

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() u: AuthUser) {
    return this.reports.dashboard(u);
  }

  @ManagerOrAbove()
  @Get('reports/sales')
  sales(@CurrentUser() u: AuthUser, @Query() q: RangeQueryDto) {
    return this.reports.sales(u, q);
  }

  @ManagerOrAbove()
  @Get('reports/inventory')
  inventory(@CurrentUser() u: AuthUser) {
    return this.reports.inventory(u);
  }

  @ManagerOrAbove()
  @Get('reports/balances')
  balances(@CurrentUser() u: AuthUser) {
    return this.reports.balances(u);
  }

  @ManagerOrAbove()
  @Get('reports/activity')
  activity(@CurrentUser() u: AuthUser) {
    return this.reports.activity(u);
  }
}

@Module({
  imports: [PaymentsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}

// Re-exported for tests that assert role-based shapes.
export { SalesOrderStatus };
