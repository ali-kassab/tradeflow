import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaymentMethod,
  PurchaseOrderStatus,
  type Prisma,
} from '../../generated/prisma/client.js';
import { type AuthUser, CurrentUser, ManagerOrAbove } from '../../common/auth.js';
import { ErrorCode, badRequest, conflict, notFound } from '../../common/errors.js';
import { dec, money } from '../../common/money.js';
import { PageQueryDto, paginated, skipTake } from '../../common/pagination.js';
import { assertOwned, logActivity } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { BILLED_SALES, LedgerService } from './ledger.service.js';

class RecordPaymentBase {
  @ApiProperty({ example: 1500.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}

class RecordCustomerPaymentDto extends RecordPaymentBase {
  @ApiProperty()
  @IsInt()
  customerId: number;

  @ApiPropertyOptional({ description: 'Apply to a specific confirmed order; omit to pay on account' })
  @IsOptional()
  @IsInt()
  salesOrderId?: number;
}

class RecordSupplierPaymentDto extends RecordPaymentBase {
  @ApiProperty()
  @IsInt()
  supplierId: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  purchaseOrderId?: number;
}

class VoidPaymentDto {
  @ApiProperty()
  @IsString()
  @Length(2, 255)
  reason: string;
}

class PaymentQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  partyId?: number;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCustomer(actor: AuthUser, q: PaymentQueryDto) {
    const where: Prisma.CustomerPaymentWhereInput = {
      tenantId: actor.tenantId,
      ...(q.partyId ? { customerId: q.partyId } : {}),
      ...(q.search ? { OR: [{ reference: { contains: q.search } }, { customer: { name: { contains: q.search } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.customerPayment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          salesOrder: { select: { id: true, number: true } },
        },
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        ...skipTake(q),
      }),
      this.prisma.customerPayment.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  async listSupplier(actor: AuthUser, q: PaymentQueryDto) {
    const where: Prisma.SupplierPaymentWhereInput = {
      tenantId: actor.tenantId,
      ...(q.partyId ? { supplierId: q.partyId } : {}),
      ...(q.search ? { OR: [{ reference: { contains: q.search } }, { supplier: { name: { contains: q.search } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.supplierPayment.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          purchaseOrder: { select: { id: true, number: true } },
        },
        orderBy: [{ paidAt: 'desc' }, { id: 'desc' }],
        ...skipTake(q),
      }),
      this.prisma.supplierPayment.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  async recordCustomer(actor: AuthUser, dto: RecordCustomerPaymentDto) {
    const amount = money(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      await assertOwned(tx, 'customer', actor.tenantId, dto.customerId, 'Customer');
      if (dto.salesOrderId) {
        // Lock the order row so two concurrent payments cannot both pass the
        // "does not exceed outstanding" check.
        await tx.$queryRaw`SELECT id FROM SalesOrder WHERE id = ${dto.salesOrderId} AND tenantId = ${actor.tenantId} FOR UPDATE`;
        const order = await tx.salesOrder.findFirst({
          where: { id: dto.salesOrderId, tenantId: actor.tenantId },
          select: { id: true, customerId: true, status: true, total: true },
        });
        if (!order) throw notFound('Sales order');
        if (order.customerId !== dto.customerId) {
          throw badRequest(ErrorCode.INVALID_REFERENCE, 'Order belongs to a different customer');
        }
        if (!BILLED_SALES.includes(order.status as (typeof BILLED_SALES)[number])) {
          throw conflict(ErrorCode.INVALID_STATUS, 'Payments can only be applied to confirmed or delivered orders', { status: order.status });
        }
        const paid = await tx.customerPayment.aggregate({
          where: { tenantId: actor.tenantId, salesOrderId: order.id, voidedAt: null },
          _sum: { amount: true },
        });
        const outstanding = money(dec(order.total).minus(dec(paid._sum.amount)));
        if (amount.greaterThan(outstanding)) {
          throw badRequest(ErrorCode.AMOUNT_EXCEEDS_OUTSTANDING, 'Amount exceeds the order outstanding balance', {
            outstanding: outstanding.toFixed(2),
          });
        }
      }
      const payment = await tx.customerPayment.create({
        data: {
          tenantId: actor.tenantId,
          customerId: dto.customerId,
          salesOrderId: dto.salesOrderId ?? null,
          amount,
          method: dto.method,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          reference: dto.reference,
          notes: dto.notes,
          createdById: actor.id,
        },
      });
      await logActivity(tx, {
        tenantId: actor.tenantId, userId: actor.id, action: 'payment.received',
        entityType: 'customerPayment', entityId: payment.id, metadata: { amount: amount.toFixed(2) },
      });
      return payment;
    });
  }

  async recordSupplier(actor: AuthUser, dto: RecordSupplierPaymentDto) {
    const amount = money(dto.amount);
    return this.prisma.$transaction(async (tx) => {
      await assertOwned(tx, 'supplier', actor.tenantId, dto.supplierId, 'Supplier');
      if (dto.purchaseOrderId) {
        await tx.$queryRaw`SELECT id FROM PurchaseOrder WHERE id = ${dto.purchaseOrderId} AND tenantId = ${actor.tenantId} FOR UPDATE`;
        const order = await tx.purchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, tenantId: actor.tenantId },
          select: { id: true, supplierId: true, status: true, total: true },
        });
        if (!order) throw notFound('Purchase order');
        if (order.supplierId !== dto.supplierId) {
          throw badRequest(ErrorCode.INVALID_REFERENCE, 'Order belongs to a different supplier');
        }
        if (order.status !== PurchaseOrderStatus.RECEIVED) {
          throw conflict(ErrorCode.INVALID_STATUS, 'Payments can only be applied to received purchase orders', { status: order.status });
        }
        const paid = await tx.supplierPayment.aggregate({
          where: { tenantId: actor.tenantId, purchaseOrderId: order.id, voidedAt: null },
          _sum: { amount: true },
        });
        const outstanding = money(dec(order.total).minus(dec(paid._sum.amount)));
        if (amount.greaterThan(outstanding)) {
          throw badRequest(ErrorCode.AMOUNT_EXCEEDS_OUTSTANDING, 'Amount exceeds the order outstanding balance', {
            outstanding: outstanding.toFixed(2),
          });
        }
      }
      const payment = await tx.supplierPayment.create({
        data: {
          tenantId: actor.tenantId,
          supplierId: dto.supplierId,
          purchaseOrderId: dto.purchaseOrderId ?? null,
          amount,
          method: dto.method,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          reference: dto.reference,
          notes: dto.notes,
          createdById: actor.id,
        },
      });
      await logActivity(tx, {
        tenantId: actor.tenantId, userId: actor.id, action: 'payment.sent',
        entityType: 'supplierPayment', entityId: payment.id, metadata: { amount: amount.toFixed(2) },
      });
      return payment;
    });
  }

  /** Payments are never deleted. Voiding keeps the record and excludes it from balances. */
  async voidCustomer(actor: AuthUser, id: number, dto: VoidPaymentDto) {
    const { count } = await this.prisma.customerPayment.updateMany({
      where: { id, tenantId: actor.tenantId, voidedAt: null },
      data: { voidedAt: new Date(), voidedById: actor.id, voidReason: dto.reason },
    });
    if (count === 0) await this.voidFailure('customerPayment', actor.tenantId, id);
    await logActivity(this.prisma, {
      tenantId: actor.tenantId, userId: actor.id, action: 'payment.voided',
      entityType: 'customerPayment', entityId: id, metadata: { reason: dto.reason },
    });
    return this.prisma.customerPayment.findUniqueOrThrow({ where: { id } });
  }

  async voidSupplier(actor: AuthUser, id: number, dto: VoidPaymentDto) {
    const { count } = await this.prisma.supplierPayment.updateMany({
      where: { id, tenantId: actor.tenantId, voidedAt: null },
      data: { voidedAt: new Date(), voidedById: actor.id, voidReason: dto.reason },
    });
    if (count === 0) await this.voidFailure('supplierPayment', actor.tenantId, id);
    await logActivity(this.prisma, {
      tenantId: actor.tenantId, userId: actor.id, action: 'payment.voided',
      entityType: 'supplierPayment', entityId: id, metadata: { reason: dto.reason },
    });
    return this.prisma.supplierPayment.findUniqueOrThrow({ where: { id } });
  }

  private async voidFailure(model: 'customerPayment' | 'supplierPayment', tenantId: number, id: number): Promise<never> {
    const exists =
      model === 'customerPayment'
        ? await this.prisma.customerPayment.count({ where: { id, tenantId } })
        : await this.prisma.supplierPayment.count({ where: { id, tenantId } });
    if (exists === 0) throw notFound('Payment');
    throw conflict(ErrorCode.ALREADY_VOIDED, 'Payment is already voided');
  }
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('customer')
  listCustomer(@CurrentUser() user: AuthUser, @Query() q: PaymentQueryDto) {
    return this.payments.listCustomer(user, q);
  }

  @Post('customer')
  recordCustomer(@CurrentUser() user: AuthUser, @Body() dto: RecordCustomerPaymentDto) {
    return this.payments.recordCustomer(user, dto);
  }

  @ManagerOrAbove()
  @Post('customer/:id/void')
  voidCustomer(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: VoidPaymentDto) {
    return this.payments.voidCustomer(user, id, dto);
  }

  @ManagerOrAbove()
  @Get('supplier')
  listSupplier(@CurrentUser() user: AuthUser, @Query() q: PaymentQueryDto) {
    return this.payments.listSupplier(user, q);
  }

  @ManagerOrAbove()
  @Post('supplier')
  recordSupplier(@CurrentUser() user: AuthUser, @Body() dto: RecordSupplierPaymentDto) {
    return this.payments.recordSupplier(user, dto);
  }

  @ManagerOrAbove()
  @Post('supplier/:id/void')
  voidSupplier(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: VoidPaymentDto) {
    return this.payments.voidSupplier(user, id, dto);
  }
}

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, LedgerService],
  exports: [LedgerService],
})
export class PaymentsModule {}
