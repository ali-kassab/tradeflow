import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { StockMovementType } from '../../common/enums.js';
import { type AuthUser, canSeeCosts } from '../../common/auth.js';
import { ErrorCode, conflict, notFound } from '../../common/errors.js';
import { paginated, skipTake } from '../../common/pagination.js';
import { assertOwned } from '../../common/tx.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import type {
  CategoryDto,
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './catalog.dto.js';

const productSelect = {
  id: true,
  sku: true,
  name: true,
  unit: true,
  categoryId: true,
  category: { select: { id: true, name: true } },
  costPrice: true,
  salePrice: true,
  stockQty: true,
  reorderLevel: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

/** STAFF must never receive cost data, so it is removed before serialisation. */
export function presentProduct(user: AuthUser, p: ProductRow) {
  const isLowStock = p.stockQty <= p.reorderLevel;
  if (canSeeCosts(user)) return { ...p, isLowStock };
  const { costPrice: _hidden, ...rest } = p;
  return { ...rest, isLowStock };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockService,
  ) {}

  // ---------- categories ----------

  async listCategories(actor: AuthUser) {
    const rows = await this.prisma.category.findMany({
      where: { tenantId: actor.tenantId },
      include: { _count: { select: { products: true } } },
      orderBy: { name: 'asc' },
    });
    return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
  }

  async createCategory(actor: AuthUser, dto: CategoryDto) {
    try {
      return await this.prisma.category.create({ data: { tenantId: actor.tenantId, name: dto.name } });
    } catch (e) {
      throw this.mapUnique(e, ErrorCode.NAME_TAKEN);
    }
  }

  async updateCategory(actor: AuthUser, id: number, dto: CategoryDto) {
    await assertOwned(this.prisma, 'category', actor.tenantId, id, 'Category');
    try {
      return await this.prisma.category.update({ where: { id }, data: { name: dto.name } });
    } catch (e) {
      throw this.mapUnique(e, ErrorCode.NAME_TAKEN);
    }
  }

  async deleteCategory(actor: AuthUser, id: number) {
    await assertOwned(this.prisma, 'category', actor.tenantId, id, 'Category');
    // Products keep existing; their categoryId is set to NULL by the FK rule.
    await this.prisma.category.delete({ where: { id } });
  }

  // ---------- products ----------

  async listProducts(actor: AuthUser, q: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      tenantId: actor.tenantId,
      ...(q.status !== 'all' ? { isActive: q.status === 'active' } : {}),
      ...(q.categoryId ? { categoryId: q.categoryId } : {}),
      ...(q.search ? { OR: [{ name: { contains: q.search } }, { sku: { contains: q.search } }] } : {}),
    };

    if (q.lowStock) {
      // Column-to-column comparison (stockQty <= reorderLevel).
      where.stockQty = { lte: this.prisma.product.fields.reorderLevel };
    }

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({ where, select: productSelect, orderBy: { name: 'asc' }, ...skipTake(q) }),
      this.prisma.product.count({ where }),
    ]);
    return paginated(rows.map((p) => presentProduct(actor, p)), total, q);
  }

  async getProduct(actor: AuthUser, id: number) {
    const p = await this.prisma.product.findFirst({
      where: { id, tenantId: actor.tenantId },
      select: productSelect,
    });
    if (!p) throw notFound('Product');
    return presentProduct(actor, p);
  }

  async createProduct(actor: AuthUser, dto: CreateProductDto) {
    const { openingStock = 0, categoryId, ...data } = dto;
    if (categoryId) await assertOwned(this.prisma, 'category', actor.tenantId, categoryId, 'Category');
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: { ...data, categoryId: categoryId ?? null, tenantId: actor.tenantId },
        });
        if (openingStock > 0) {
          await this.stock.apply(tx, {
            tenantId: actor.tenantId,
            productId: product.id,
            delta: openingStock,
            type: StockMovementType.OPENING,
            userId: actor.id,
          });
        }
        return product.id;
      });
      return this.getProduct(actor, id);
    } catch (e) {
      throw this.mapUnique(e, ErrorCode.SKU_TAKEN);
    }
  }

  async updateProduct(actor: AuthUser, id: number, dto: UpdateProductDto) {
    await assertOwned(this.prisma, 'product', actor.tenantId, id, 'Product');
    if (dto.categoryId) {
      await assertOwned(this.prisma, 'category', actor.tenantId, dto.categoryId, 'Category');
    }
    try {
      await this.prisma.product.update({ where: { id }, data: dto });
    } catch (e) {
      throw this.mapUnique(e, ErrorCode.SKU_TAKEN);
    }
    return this.getProduct(actor, id);
  }

  /** Products that appear on any order are kept for history; deactivate them instead. */
  async deleteProduct(actor: AuthUser, id: number) {
    await assertOwned(this.prisma, 'product', actor.tenantId, id, 'Product');
    const [sales, purchases] = await Promise.all([
      this.prisma.salesOrderItem.count({ where: { tenantId: actor.tenantId, productId: id } }),
      this.prisma.purchaseOrderItem.count({ where: { tenantId: actor.tenantId, productId: id } }),
    ]);
    if (sales + purchases > 0) {
      throw conflict(ErrorCode.IN_USE, 'Product is used by orders; deactivate it instead');
    }
    await this.prisma.$transaction([
      this.prisma.stockMovement.deleteMany({ where: { tenantId: actor.tenantId, productId: id } }),
      this.prisma.customerPrice.deleteMany({ where: { tenantId: actor.tenantId, productId: id } }),
      this.prisma.product.delete({ where: { id } }),
    ]);
  }

  private mapUnique(e: unknown, code: ErrorCode) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return conflict(code, 'Value already in use');
    }
    return e;
  }
}
