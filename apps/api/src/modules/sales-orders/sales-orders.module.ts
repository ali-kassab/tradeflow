import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { type Prisma } from '../../generated/prisma/client.js';
import { Role, SalesOrderStatus, StockMovementType } from '../../common/enums.js';
import { type AuthUser, CurrentUser, canSeeCosts } from '../../common/auth.js';
import { AppException, ErrorCode, badRequest, conflict, notFound } from '../../common/errors.js';
import { computeOrderTotals, dec, money } from '../../common/money.js';
import { PageQueryDto, paginated, skipTake } from '../../common/pagination.js';
import { assertOwned, logActivity, nextDocumentNumber } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ParseIdPipe } from '../../common/validation.js';
import { MAX_MONEY } from '../catalog/catalog.dto.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { StockService } from '../inventory/stock.service.js';

class OrderItemDto {
  @ApiProperty()
  @IsInt()
  productId: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Manager/Owner price override. Otherwise the customer price or product price is used.',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  unitPrice?: number;
}

class CreateSalesOrderDto {
  @ApiProperty()
  @IsInt()
  customerId: number;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @ApiPropertyOptional({ default: 0, description: 'Fixed amount off the subtotal' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_MONEY)
  discount?: number;

  @ApiPropertyOptional({ description: 'VAT %. Defaults to the business setting.' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString({ strict: true })
  orderDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class UpdateSalesOrderDto extends CreateSalesOrderDto {}

class SalesOrderQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SalesOrderStatus })
  @IsOptional()
  @IsIn(Object.values(SalesOrderStatus))
  status?: SalesOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;
}

const detailInclude = {
  customer: { select: { id: true, name: true, phone: true, address: true, taxNumber: true, creditLimit: true } },
  items: { orderBy: { id: 'asc' } },
  payments: { orderBy: { paidAt: 'asc' } },
} as const satisfies Prisma.SalesOrderInclude;

type OrderDetail = Prisma.SalesOrderGetPayload<{ include: typeof detailInclude }>;

@Injectable()
export class SalesOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async list(actor: AuthUser, q: SalesOrderQueryDto) {
    const where: Prisma.SalesOrderWhereInput = {
      tenantId: actor.tenantId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.search ? { OR: [{ number: { contains: q.search } }, { customer: { name: { contains: q.search } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where,
        include: { customer: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: { id: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.salesOrder.count({ where }),
    ]);
    const paid = await this.paidByOrder(actor.tenantId, rows.map((r) => r.id));
    return paginated(
      rows.map(({ _count, ...o }) => ({
        ...o,
        itemCount: _count.items,
        ...this.paymentSummary(o.status, o.total, paid.get(o.id)),
      })),
      total,
      q,
    );
  }

  async get(actor: AuthUser, id: number) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: detailInclude,
    });
    if (!order) throw notFound('Sales order');
    return this.present(actor, order);
  }

  async create(actor: AuthUser, dto: CreateSalesOrderDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      await assertOwned(tx, 'customer', actor.tenantId, dto.customerId, 'Customer');
      const priced = await this.priceLines(tx, actor, dto);
      const number = await nextDocumentNumber(tx, actor.tenantId, 'SALES_ORDER');
      const order = await tx.salesOrder.create({
        data: {
          tenantId: actor.tenantId,
          number,
          customerId: dto.customerId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          notes: dto.notes,
          createdById: actor.id,
          ...priced.header,
          items: { create: priced.items }, // tenantId comes from the parent (composite FK)
        },
      });
      return order.id;
    });
    return this.get(actor, id);
  }

  /** Only drafts are editable; the item list is replaced as a whole. */
  async update(actor: AuthUser, id: number, dto: UpdateSalesOrderDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, actor.tenantId, id);
      if (order.status !== SalesOrderStatus.DRAFT) throw invalidStatus(order.status);
      await assertOwned(tx, 'customer', actor.tenantId, dto.customerId, 'Customer');
      const priced = await this.priceLines(tx, actor, dto);
      await tx.salesOrderItem.deleteMany({ where: { tenantId: actor.tenantId, salesOrderId: id } });
      await tx.salesOrder.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : undefined,
          notes: dto.notes,
          ...priced.header,
          items: { create: priced.items }, // tenantId comes from the parent (composite FK)
        },
      });
    });
    return this.get(actor, id);
  }

  /**
   * DRAFT → CONFIRMED. Deducts stock for every line in one transaction; if any
   * line lacks stock the whole confirmation rolls back. Cost is snapshotted for
   * profit reporting.
   */
  async confirm(actor: AuthUser, id: number) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, actor.tenantId, id);
      if (order.status !== SalesOrderStatus.DRAFT) throw invalidStatus(order.status);
      const items = await tx.salesOrderItem.findMany({
        where: { tenantId: actor.tenantId, salesOrderId: id },
        // Consistent lock order across concurrent confirmations avoids deadlocks.
        orderBy: { productId: 'asc' },
      });
      if (items.length === 0) throw badRequest(ErrorCode.EMPTY_ORDER, 'Order has no items');

      for (const item of items) {
        await this.stock.apply(tx, {
          tenantId: actor.tenantId,
          productId: item.productId,
          delta: -item.quantity,
          type: StockMovementType.SALE,
          refType: 'SALES_ORDER',
          refId: id,
          userId: actor.id,
        });
        const product = await tx.product.findFirstOrThrow({
          where: { id: item.productId, tenantId: actor.tenantId },
          select: { costPrice: true },
        });
        await tx.salesOrderItem.update({ where: { id: item.id }, data: { unitCost: product.costPrice } });
      }
      await tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CONFIRMED, confirmedAt: new Date() },
      });
      await logActivity(tx, {
        tenantId: actor.tenantId, userId: actor.id, action: 'salesOrder.confirmed',
        entityType: 'salesOrder', entityId: id, metadata: { number: order.number, total: order.total.toFixed(2) },
      });
    });
    return this.get(actor, id);
  }

  async deliver(actor: AuthUser, id: number) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, actor.tenantId, id);
      if (order.status !== SalesOrderStatus.CONFIRMED) throw invalidStatus(order.status);
      await tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.DELIVERED, deliveredAt: new Date() },
      });
      await logActivity(tx, {
        tenantId: actor.tenantId, userId: actor.id, action: 'salesOrder.delivered',
        entityType: 'salesOrder', entityId: id, metadata: { number: order.number },
      });
    });
    return this.get(actor, id);
  }

  /**
   * DRAFT → CANCELLED (anyone), CONFIRMED → CANCELLED (manager/owner, restocks).
   * Payments already recorded against the order are kept and become customer
   * credit (see LedgerService). Delivered orders cannot be cancelled.
   */
  async cancel(actor: AuthUser, id: number) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lockOrder(tx, actor.tenantId, id);
      if (order.status === SalesOrderStatus.CONFIRMED) {
        if (actor.role === Role.STAFF) {
          throw new AppException(403, ErrorCode.FORBIDDEN, 'Only managers can cancel confirmed orders');
        }
        const items = await tx.salesOrderItem.findMany({
          where: { tenantId: actor.tenantId, salesOrderId: id },
          orderBy: { productId: 'asc' },
        });
        for (const item of items) {
          await this.stock.apply(tx, {
            tenantId: actor.tenantId,
            productId: item.productId,
            delta: item.quantity,
            type: StockMovementType.SALE_CANCEL,
            refType: 'SALES_ORDER',
            refId: id,
            userId: actor.id,
          });
        }
      } else if (order.status !== SalesOrderStatus.DRAFT) {
        throw invalidStatus(order.status);
      }
      await tx.salesOrder.update({
        where: { id },
        data: { status: SalesOrderStatus.CANCELLED, cancelledAt: new Date() },
      });
      await logActivity(tx, {
        tenantId: actor.tenantId, userId: actor.id, action: 'salesOrder.cancelled',
        entityType: 'salesOrder', entityId: id, metadata: { number: order.number, previousStatus: order.status },
      });
    });
    return this.get(actor, id);
  }

  // ---------- helpers ----------

  /** SELECT … WITH (UPDLOCK) serialises state transitions on the same order. */
  private async lockOrder(tx: Prisma.TransactionClient, tenantId: number, id: number) {
    await tx.$queryRaw`SELECT id FROM SalesOrder WITH (UPDLOCK, ROWLOCK) WHERE id = ${id} AND tenantId = ${tenantId}`;
    const order = await tx.salesOrder.findFirst({
      where: { id, tenantId },
      select: { id: true, number: true, status: true, total: true },
    });
    if (!order) throw notFound('Sales order');
    return order;
  }

  private async priceLines(tx: Prisma.TransactionClient, actor: AuthUser, dto: CreateSalesOrderDto) {
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    if (productIds.length !== dto.items.length) {
      throw badRequest(ErrorCode.VALIDATION_ERROR, 'Each product may appear only once per order');
    }
    if (actor.role === Role.STAFF && dto.items.some((i) => i.unitPrice !== undefined)) {
      throw new AppException(403, ErrorCode.FORBIDDEN, 'Only managers can override prices');
    }
    const [products, customerPrices, tenant] = await Promise.all([
      tx.product.findMany({
        where: { tenantId: actor.tenantId, id: { in: productIds }, isActive: true },
        select: { id: true, name: true, sku: true, salePrice: true },
      }),
      tx.customerPrice.findMany({
        where: { tenantId: actor.tenantId, customerId: dto.customerId, productId: { in: productIds } },
      }),
      tx.tenant.findUniqueOrThrow({ where: { id: actor.tenantId }, select: { defaultTaxRate: true } }),
    ]);
    if (products.length !== productIds.length) throw notFound('Product');

    const byId = new Map(products.map((p) => [p.id, p]));
    const special = new Map(customerPrices.map((c) => [c.productId, c.price]));
    const lines = dto.items.map((i) => {
      const p = byId.get(i.productId)!;
      const unitPrice = money(i.unitPrice ?? special.get(p.id) ?? p.salePrice);
      return { productId: p.id, productName: p.name, sku: p.sku, quantity: i.quantity, unitPrice };
    });

    const totals = computeOrderTotals({
      lines,
      discount: dto.discount ?? 0,
      taxRate: dto.taxRate ?? tenant.defaultTaxRate,
    });
    if (totals.discount.greaterThan(totals.subtotal)) {
      throw badRequest(ErrorCode.DISCOUNT_EXCEEDS_SUBTOTAL, 'Discount cannot exceed the subtotal');
    }
    return {
      items: lines.map((l, idx) => ({ ...l, lineTotal: totals.lineTotals[idx] })),
      header: {
        subtotal: totals.subtotal,
        discount: totals.discount,
        taxRate: dec(dto.taxRate ?? tenant.defaultTaxRate),
        taxAmount: totals.taxAmount,
        total: totals.total,
      },
    };
  }

  private async paidByOrder(tenantId: number, orderIds: number[]) {
    if (orderIds.length === 0) return new Map<number, Prisma.Decimal>();
    const rows = await this.prisma.customerPayment.groupBy({
      by: ['salesOrderId'],
      where: { tenantId, salesOrderId: { in: orderIds }, voidedAt: null },
      _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.salesOrderId!, dec(r._sum.amount)]));
  }

  private paymentSummary(status: string, total: Prisma.Decimal, paidRaw?: Prisma.Decimal) {
    const paid = money(paidRaw ?? 0);
    const billed = status === SalesOrderStatus.CONFIRMED || status === SalesOrderStatus.DELIVERED;
    const outstanding = billed ? money(dec(total).minus(paid)) : dec(0);
    const paymentStatus = !billed
      ? 'NOT_BILLED'
      : outstanding.lessThanOrEqualTo(0)
        ? 'PAID'
        : paid.greaterThan(0)
          ? 'PARTIAL'
          : 'UNPAID';
    return { paidAmount: paid.toFixed(2), outstanding: outstanding.toFixed(2), paymentStatus };
  }

  private present(actor: AuthUser, order: OrderDetail) {
    const paid = order.payments
      .filter((p) => !p.voidedAt)
      .reduce((acc, p) => acc.plus(p.amount), dec(0));
    const showCost = canSeeCosts(actor);
    return {
      ...order,
      items: order.items.map(({ unitCost, ...item }) => (showCost ? { ...item, unitCost } : item)),
      ...this.paymentSummary(order.status, order.total, paid),
    };
  }
}

const invalidStatus = (status: string) =>
  conflict(ErrorCode.INVALID_STATUS, `Action not allowed while order is ${status}`, { status });

@ApiTags('sales-orders')
@ApiBearerAuth()
@Controller('sales-orders')
export class SalesOrdersController {
  constructor(private readonly orders: SalesOrdersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: SalesOrderQueryDto) {
    return this.orders.list(u, q);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: number) {
    return this.orders.get(u, id);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateSalesOrderDto) {
    return this.orders.create(u, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: number, @Body() dto: UpdateSalesOrderDto) {
    return this.orders.update(u, id, dto);
  }

  @Post(':id/confirm')
  confirm(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: number) {
    return this.orders.confirm(u, id);
  }

  @Post(':id/deliver')
  deliver(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: number) {
    return this.orders.deliver(u, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseIdPipe) id: number) {
    return this.orders.cancel(u, id);
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService],
})
export class SalesOrdersModule {}
