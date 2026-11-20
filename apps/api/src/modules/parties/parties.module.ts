import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type { Prisma } from '../../generated/prisma/client.js';
import { type AuthUser, CurrentUser, ManagerOrAbove } from '../../common/auth.js';
import { ErrorCode, conflict, notFound } from '../../common/errors.js';
import { dec } from '../../common/money.js';
import { PageQueryDto, paginated, skipTake } from '../../common/pagination.js';
import { assertOwned } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { LedgerService } from '../payments/ledger.service.js';
import { PaymentsModule } from '../payments/payments.module.js';

const trim = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value));

class PartyDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 160)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @trim()
  @IsEmail()
  @MaxLength(190)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(60)
  taxNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class CreateCustomerDto extends PartyDto {
  @ApiPropertyOptional({ description: 'Shown as a warning when exceeded; not enforced' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditLimit?: number | null;
}

class UpdateCustomerDto extends PartialType(CreateCustomerDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateSupplierDto extends PartialType(PartyDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class PartyQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive', 'all'], default: 'active' })
  @IsOptional()
  @IsIn(['active', 'inactive', 'all'])
  status: 'active' | 'inactive' | 'all' = 'active';
}

class CustomerPriceItemDto {
  @ApiProperty()
  @IsInt()
  productId: number;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;
}

class SetCustomerPricesDto {
  @ApiProperty({ type: [CustomerPriceItemDto], description: 'Replaces the full list' })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CustomerPriceItemDto)
  prices: CustomerPriceItemDto[];
}

function partyWhere(tenantId: number, q: PartyQueryDto) {
  return {
    tenantId,
    ...(q.status !== 'all' ? { isActive: q.status === 'active' } : {}),
    ...(q.search
      ? { OR: [{ name: { contains: q.search } }, { phone: { contains: q.search } }, { email: { contains: q.search } }] }
      : {}),
  };
}

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async list(actor: AuthUser, q: PartyQueryDto) {
    const where: Prisma.CustomerWhereInput = partyWhere(actor.tenantId, q);
    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, ...skipTake(q) }),
      this.prisma.customer.count({ where }),
    ]);
    const balances = await this.ledger.customerBalances(actor.tenantId, rows.map((r) => r.id));
    return paginated(
      rows.map((c) => ({ ...c, balance: (balances.get(c.id)?.balance ?? dec(0)).toFixed(2) })),
      total,
      q,
    );
  }

  async get(actor: AuthUser, id: number) {
    const customer = await this.prisma.customer.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!customer) throw notFound('Customer');
    const b = (await this.ledger.customerBalances(actor.tenantId, [id])).get(id);
    return {
      ...customer,
      totalBilled: (b?.billed ?? dec(0)).toFixed(2),
      totalPaid: (b?.paid ?? dec(0)).toFixed(2),
      balance: (b?.balance ?? dec(0)).toFixed(2),
    };
  }

  create(actor: AuthUser, dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: { ...dto, tenantId: actor.tenantId } });
  }

  async update(actor: AuthUser, id: number, dto: UpdateCustomerDto) {
    await assertOwned(this.prisma, 'customer', actor.tenantId, id, 'Customer');
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async remove(actor: AuthUser, id: number) {
    await assertOwned(this.prisma, 'customer', actor.tenantId, id, 'Customer');
    const [orders, payments] = await Promise.all([
      this.prisma.salesOrder.count({ where: { tenantId: actor.tenantId, customerId: id } }),
      this.prisma.customerPayment.count({ where: { tenantId: actor.tenantId, customerId: id } }),
    ]);
    if (orders + payments > 0) {
      throw conflict(ErrorCode.IN_USE, 'Customer has orders or payments; deactivate instead');
    }
    await this.prisma.customer.delete({ where: { id } });
  }

  async statement(actor: AuthUser, id: number) {
    await assertOwned(this.prisma, 'customer', actor.tenantId, id, 'Customer');
    return this.ledger.customerStatement(actor.tenantId, id);
  }

  async prices(actor: AuthUser, id: number) {
    await assertOwned(this.prisma, 'customer', actor.tenantId, id, 'Customer');
    return this.prisma.customerPrice.findMany({
      where: { tenantId: actor.tenantId, customerId: id },
      include: { product: { select: { id: true, name: true, sku: true, salePrice: true } } },
      orderBy: { product: { name: 'asc' } },
    });
  }

  async setPrices(actor: AuthUser, id: number, dto: SetCustomerPricesDto) {
    await assertOwned(this.prisma, 'customer', actor.tenantId, id, 'Customer');
    // One price per product; the first entry wins (SQL Server has no INSERT … IGNORE / skipDuplicates).
    const prices = [...new Map(dto.prices.toReversed().map((p) => [p.productId, p])).values()];
    const productIds = prices.map((p) => p.productId);
    const owned = await this.prisma.product.count({ where: { tenantId: actor.tenantId, id: { in: productIds } } });
    if (owned !== productIds.length) throw notFound('Product');
    await this.prisma.$transaction([
      this.prisma.customerPrice.deleteMany({ where: { tenantId: actor.tenantId, customerId: id } }),
      this.prisma.customerPrice.createMany({
        data: prices.map((p) => ({ tenantId: actor.tenantId, customerId: id, productId: p.productId, price: p.price })),
      }),
    ]);
    return this.prices(actor, id);
  }
}

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async list(actor: AuthUser, q: PartyQueryDto) {
    const where: Prisma.SupplierWhereInput = partyWhere(actor.tenantId, q);
    const [rows, total] = await Promise.all([
      this.prisma.supplier.findMany({ where, orderBy: { name: 'asc' }, ...skipTake(q) }),
      this.prisma.supplier.count({ where }),
    ]);
    const balances = await this.ledger.supplierBalances(actor.tenantId, rows.map((r) => r.id));
    return paginated(
      rows.map((s) => ({ ...s, balance: (balances.get(s.id)?.balance ?? dec(0)).toFixed(2) })),
      total,
      q,
    );
  }

  async get(actor: AuthUser, id: number) {
    const supplier = await this.prisma.supplier.findFirst({ where: { id, tenantId: actor.tenantId } });
    if (!supplier) throw notFound('Supplier');
    const b = (await this.ledger.supplierBalances(actor.tenantId, [id])).get(id);
    return {
      ...supplier,
      totalBilled: (b?.billed ?? dec(0)).toFixed(2),
      totalPaid: (b?.paid ?? dec(0)).toFixed(2),
      balance: (b?.balance ?? dec(0)).toFixed(2),
    };
  }

  create(actor: AuthUser, dto: PartyDto) {
    return this.prisma.supplier.create({ data: { ...dto, tenantId: actor.tenantId } });
  }

  async update(actor: AuthUser, id: number, dto: UpdateSupplierDto) {
    await assertOwned(this.prisma, 'supplier', actor.tenantId, id, 'Supplier');
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(actor: AuthUser, id: number) {
    await assertOwned(this.prisma, 'supplier', actor.tenantId, id, 'Supplier');
    const [orders, payments] = await Promise.all([
      this.prisma.purchaseOrder.count({ where: { tenantId: actor.tenantId, supplierId: id } }),
      this.prisma.supplierPayment.count({ where: { tenantId: actor.tenantId, supplierId: id } }),
    ]);
    if (orders + payments > 0) {
      throw conflict(ErrorCode.IN_USE, 'Supplier has orders or payments; deactivate instead');
    }
    await this.prisma.supplier.delete({ where: { id } });
  }

  async statement(actor: AuthUser, id: number) {
    await assertOwned(this.prisma, 'supplier', actor.tenantId, id, 'Supplier');
    return this.ledger.supplierStatement(actor.tenantId, id);
  }
}

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PartyQueryDto) {
    return this.customers.list(u, q);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.customers.get(u, id);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateCustomerDto) {
    return this.customers.create(u, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(u, id, dto);
  }

  @ManagerOrAbove()
  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.customers.remove(u, id);
  }

  @Get(':id/statement')
  statement(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.customers.statement(u, id);
  }

  @Get(':id/prices')
  prices(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.customers.prices(u, id);
  }

  @ManagerOrAbove()
  @Put(':id/prices')
  setPrices(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: SetCustomerPricesDto) {
    return this.customers.setPrices(u, id, dto);
  }
}

@ApiTags('suppliers')
@ApiBearerAuth()
@ManagerOrAbove()
@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PartyQueryDto) {
    return this.suppliers.list(u, q);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.suppliers.get(u, id);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: PartyDto) {
    return this.suppliers.create(u, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSupplierDto) {
    return this.suppliers.update(u, id, dto);
  }

  @HttpCode(204)
  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.suppliers.remove(u, id);
  }

  @Get(':id/statement')
  statement(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.suppliers.statement(u, id);
  }
}

@Module({
  imports: [PaymentsModule],
  controllers: [CustomersController, SuppliersController],
  providers: [CustomersService, SuppliersService],
})
export class PartiesModule {}
