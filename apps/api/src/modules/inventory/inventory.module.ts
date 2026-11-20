import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Length, Min, NotEquals } from 'class-validator';
import { StockMovementType } from '../../generated/prisma/client.js';
import { type AuthUser, CurrentUser, ManagerOrAbove } from '../../common/auth.js';
import { PageQueryDto, paginated, skipTake } from '../../common/pagination.js';
import { assertOwned, logActivity } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockService } from './stock.service.js';

class AdjustStockDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId: number;

  @ApiProperty({ description: 'Signed whole-unit change, e.g. -3 for damaged goods' })
  @IsInt()
  @NotEquals(0)
  quantity: number;

  @ApiProperty({ description: 'Reason for the adjustment (required for audit)' })
  @IsString()
  @Length(2, 255)
  note: string;
}

class MovementQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @ApiPropertyOptional({ enum: StockMovementType })
  @IsOptional()
  @IsIn(Object.values(StockMovementType))
  type?: StockMovementType;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  async movements(actor: AuthUser, q: MovementQueryDto) {
    const where = {
      tenantId: actor.tenantId,
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.type ? { type: q.type } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
        orderBy: { id: 'desc' },
        ...skipTake(q),
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return paginated(rows, total, q);
  }

  async adjust(actor: AuthUser, dto: AdjustStockDto) {
    return this.prisma.$transaction(async (tx) => {
      await assertOwned(tx, 'product', actor.tenantId, dto.productId, 'Product');
      const balance = await this.stock.apply(tx, {
        tenantId: actor.tenantId,
        productId: dto.productId,
        delta: dto.quantity,
        type: StockMovementType.ADJUSTMENT,
        userId: actor.id,
        note: dto.note,
      });
      await logActivity(tx, {
        tenantId: actor.tenantId,
        userId: actor.id,
        action: 'stock.adjusted',
        entityType: 'product',
        entityId: dto.productId,
        metadata: { quantity: dto.quantity, note: dto.note },
      });
      return { productId: dto.productId, stockQty: balance };
    });
  }
}

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('movements')
  movements(@CurrentUser() user: AuthUser, @Query() q: MovementQueryDto) {
    return this.inventory.movements(user, q);
  }

  @ManagerOrAbove()
  @Post('adjustments')
  adjust(@CurrentUser() user: AuthUser, @Body() dto: AdjustStockDto) {
    return this.inventory.adjust(user, dto);
  }
}

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, StockService],
  exports: [StockService],
})
export class InventoryModule {}
