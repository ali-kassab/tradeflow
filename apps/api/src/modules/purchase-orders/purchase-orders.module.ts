import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
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
import {
  type Prisma,
  PurchaseOrderStatus,
  StockMovementType,
} from '../../generated/prisma/client.js';
import { type AuthUser, CurrentUser, ManagerOrAbove } from '../../common/auth.js';
import { ErrorCode, badRequest, conflict, notFound } from '../../common/errors.js';
import { dec, money, sum } from '../../common/money.js';
import { PageQueryDto, paginated, skipTake } from '../../common/pagination.js';
import { assertOwned, logActivity, nextDocumentNumber } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { StockService } from '../inventory/stock.service.js';

class PurchaseItemDto {
  @ApiProperty()
  @IsInt()
  productId: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity: number;

  @ApiPropertyOptional({ description: "Defaults to the product's current cost price" })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitCost?: number;
}

class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsInt()
  supplierId: number;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class PurchaseOrderQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PurchaseOrderStatus })
  @IsOptional()
  @IsIn(Object.values(PurchaseOrderStatus))
  status?: PurchaseOrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  supplierId?: number;
}

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async list(actor: AuthUser, q: PurchaseOrderQueryDto) {
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId: actor.tenantId,
      ...(q.status ? { status: q.status } : {}),
      ...(q.supplierId ? { supplierId: q.supplierId } : {}),
      ...(q.search ? { OR: [{ number: { contains: q.search } }, { supplier: { name: { contains: q.search } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        include: { supplier: { select: { id: true, name: true } }, _count: { select: { items: true } } },
        orderBy: { id: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);
    return paginated(rows.map(({ _count, ...o }) => ({ ...o, itemCount: _count.items })), total, q);
  }

  async get(actor: AuthUser, id: number) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, tenantId: actor.tenantId },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        items: { orderBy: { id: 'asc' } },
        payments: { orderBy: { paidAt: 'asc' } },
      },
    });
    if (!order) throw notFound('Purchase order');
    const paid = money(order.payments.filter((p) => !p.voidedAt).reduce((a, p) => a.plus(p.amount), dec(0)));
    const billed = order.status === PurchaseOrderStatus.RECEIVED;
    return {
      ...order,
      paidAmount: paid.toFixed(2),
      outstanding: (billed ? money(dec(order.total).minus(paid)) : dec(0)).toFixed(2),
    };
  }

  async create(actor: AuthUser, dto: CreatePurchaseOrderDto) {
    const id = await this.prisma.$transaction(async (tx) => {
      await assertOwned(tx, 'supplier', actor.tenantId, dto.supplierId, 'Supplier');
      const priced = await this.priceLines(tx, actor.tenantId, dto);
      const number = await nextDocumentNumber(tx, actor.tenantId, 'PURCHASE_ORDER');
      const order = await tx.purchaseOrder.create({
        data: {
          tenantId: actor.tenantId,
          number,
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          notes: dto.notes,
          createdById: actor.id,
          total: priced.total,
          items: { create: priced.items.map((i) => ({ ...i, tenantId: actor.tenantId })) },
        },
      });
      return order.id;
    });
    return this.get(actor, id);
  }

  async update(actor: AuthUser, id: number, dto: CreatePurchaseOrderDto) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, actor.tenantId, id);
      if (order.status !== PurchaseOrderStatus.DRAFT) throw invalidStatus(order.status);
      await assertOwned(tx, 'supplier', actor.tenantId, dto.supplierId, 'Supplier');
      const priced = await this.priceLines(tx, actor.tenantId, dto);
      await tx.purchaseOrderItem.deleteMany({ where: { tenantId: actor.tenantId, purchaseOrderId: id } });
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: dto.supplierId,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          notes: dto.notes,
          total: priced.total,
          items: { create: priced.items.map((i) => ({ ...i, tenantId: actor.tenantId })) },
        },
      });
    });
    return this.get(actor, id);
  }

  async markOrdered(actor: AuthUser, id: number) {
    await this.transition(actor, id, [PurchaseOrderStatus.DRAFT], {
      status: PurchaseOrderStatus.ORDERED,
      orderedAt: new Date(),
    }, 'purchaseOrder.ordered');
    return this.get(actor, id);
  }

  /** Adds stock and updates each product's cost price to the latest purchase cost. */
  async receive(actor: AuthUser, id: number) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, actor.tenantId, id);
      if (order.status !== PurchaseOrderStatus.DRAFT && order.status !== PurchaseOrderStatus.ORDERED) {
        throw invalidStatus(order.status);
      }
      const items = await tx.purchaseOrderItem.findMany({
        where: { tenantId: actor.tenantId, purchaseOrderId: id },
        orderBy: { productId: 'asc' },
      });
      for (const item of items) {
        await this.stock.apply(tx, {
          tenantId: actor.tenantId,
          productId: item.productId,
          delta: item.quantity,
          type: StockMovementType.PURCHASE_RECEIPT,
          refType: 'PURCHASE_ORDER',
          refId: id,
          userId: actor.id,
        });
        await tx.product.update({ where: { id: item.productId }, data: { costPrice: item.unitCost } });
      }
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: PurchaseOrderStatus.RECEIVED, receivedAt: new Date() },
      });
      await logActivity(tx, {
        tenantId: actor.tenantId, userId: actor.id, action: 'purchaseOrder.received',
        entityType: 'purchaseOrder', entityId: id, metadata: { number: order.number },
      });
    });
    return this.get(actor, id);
  }

  /** Received purchase orders cannot be cancelled (returns are out of MVP scope). */
  async cancel(actor: AuthUser, id: number) {
    await this.transition(actor, id, [PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED], {
      status: PurchaseOrderStatus.CANCELLED,
      cancelledAt: new Date(),
    }, 'purchaseOrder.cancelled');
    return this.get(actor, id);
  }

  private async transition(
    actor: AuthUser,
    id: number,
    from: PurchaseOrderStatus[],
    data: Prisma.PurchaseOrderUpdateInput,
    action: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const order = await this.lock(tx, actor.tenantId, id);
      if (!from.includes(order.status)) throw invalidStatus(order.status);
      await tx.purchaseOrder.update({ where: { id }, data });
      await logActivity(tx, {
        tenantId: actor.tenantId, userId: actor.id, action,
        entityType: 'purchaseOrder', entityId: id, metadata: { number: order.number },
      });
    });
  }

  private async lock(tx: Prisma.TransactionClient, tenantId: number, id: number) {
    await tx.$queryRaw`SELECT id FROM PurchaseOrder WHERE id = ${id} AND tenantId = ${tenantId} FOR UPDATE`;
    const order = await tx.purchaseOrder.findFirst({
      where: { id, tenantId },
      select: { id: true, number: true, status: true },
    });
    if (!order) throw notFound('Purchase order');
    return order;
  }

  private async priceLines(tx: Prisma.TransactionClient, tenantId: number, dto: CreatePurchaseOrderDto) {
    const ids = [...new Set(dto.items.map((i) => i.productId))];
    if (ids.length !== dto.items.length) {
      throw badRequest(ErrorCode.VALIDATION_ERROR, 'Each product may appear only once per order');
    }
    const products = await tx.product.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true, sku: true, costPrice: true },
    });
    if (products.length !== ids.length) throw notFound('Product');
    const byId = new Map(products.map((p) => [p.id, p]));
    const items = dto.items.map((i) => {
      const p = byId.get(i.productId)!;
      const unitCost = money(i.unitCost ?? p.costPrice);
      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        quantity: i.quantity,
        unitCost,
        lineTotal: money(unitCost.times(i.quantity)),
      };
    });
    return { items, total: money(sum(items.map((i) => i.lineTotal))) };
  }
}

const invalidStatus = (status: PurchaseOrderStatus) =>
  conflict(ErrorCode.INVALID_STATUS, `Action not allowed while order is ${status}`, { status });

@ApiTags('purchase-orders')
@ApiBearerAuth()
@ManagerOrAbove()
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly orders: PurchaseOrdersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PurchaseOrderQueryDto) {
    return this.orders.list(u, q);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orders.get(u, id);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.orders.create(u, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CreatePurchaseOrderDto) {
    return this.orders.update(u, id, dto);
  }

  @Post(':id/order')
  markOrdered(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orders.markOrdered(u, id);
  }

  @Post(':id/receive')
  receive(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orders.receive(u, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orders.cancel(u, id);
  }
}

@Module({
  imports: [InventoryModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
